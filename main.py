"""
==============================================================================
  Forensic Facial Recognition System — FastAPI Microservice
  main.py
==============================================================================

WEIGHT DOWNLOAD INSTRUCTIONS
─────────────────────────────
Place all model weights in the  ./weights/  directory.

[Stage 1 — CodeFormer]
  File   : weights/CodeFormer/codeformer.pth
  Source : https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/codeformer.pth
  Also needed (detection net used by CodeFormer):
  File   : weights/facelib/detection_Resnet50_Final.pth
           weights/facelib/parsing_parsenet.pth
  Source : auto-downloaded by facexlib on first run, OR grab from
           https://github.com/xinntao/facexlib/releases

[Stage 1 — GFPGAN (pre-processing fallback)]
  File   : weights/GFPGANv1.4.pth
  Source : https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth

[Stage 2 — YOLOv8-Face]
  File   : weights/yolov8n-face.pt
  Source : https://github.com/akanametov/yolo-face/releases  (yolov8n-face.pt)
  NOTE   : Any YOLOv8-face variant (n/s/m/l) works; replace path in config.

[Stage 2 — RetinaFace]
  Weights are automatically managed by the retina-face package. No manual
  download required.

[Stage 3 — InsightFace buffalo_l (ArcFace)]
  Directory : ~/.insightface/models/buffalo_l/
  The InsightFace SDK auto-downloads buffalo_l on first FaceAnalysis.prepare()
  call if the directory is missing. Ensure internet access on first boot, or
  pre-place the bundle from:
  https://github.com/deepinsight/insightface/releases/tag/v0.7
==============================================================================
"""

from __future__ import annotations

import io
import logging
import os
import sys
import uuid
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from scipy.spatial.distance import cosine as cosine_distance

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
log = logging.getLogger("forensic_api")

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR        = Path(__file__).resolve().parent
WEIGHTS_DIR     = BASE_DIR / "weights"
ENHANCED_DIR    = BASE_DIR / "enhanced_frames"   # saved Stage-1 outputs
ENHANCED_DIR.mkdir(parents=True, exist_ok=True)

CODEFORMER_PATH = WEIGHTS_DIR / "CodeFormer" / "codeformer.pth"
GFPGAN_PATH     = WEIGHTS_DIR / "GFPGANv1.4.pth"
YOLO_FACE_PATH  = WEIGHTS_DIR / "yolov8n-face.pt"

# ── Forensic Constants ────────────────────────────────────────────────────────
MATCH_THRESHOLD         = 0.65   # Cosine similarity must EXCEED this to be a match
DEFAULT_FIDELITY_W      = 0.85   # High fidelity → preserve original structure
RETINAFACE_CONF_THRESH  = 0.5    # Low threshold so RetinaFace catches obscured faces
EMBEDDING_DIM           = 512

# ── Device ────────────────────────────────────────────────────────────────────
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
log.info("Using compute device: %s", DEVICE)

# ==============================================================================
#  GLOBAL MODEL REGISTRY — loaded ONCE at startup, reused for every request
# ==============================================================================
_models: dict = {}


def _load_codeformer() -> object:
    """
    Load the CodeFormer network from its checkpoint.
    CodeFormer repo must be cloned / installed so that
    `basicsr` can locate the arch.
    Install: pip install basicsr facexlib gfpgan
    Clone  : git clone https://github.com/sczhou/CodeFormer  (then add to sys.path)
    """
    try:
        # If CodeFormer was cloned next to this file:
        cf_repo = BASE_DIR / "CodeFormer"
        if cf_repo.exists():
            sys.path.insert(0, str(cf_repo))

        from basicsr.utils.download_util import load_file_from_url  # noqa: F401
        from basicsr.archs.rrdbnet_arch import RRDBNet               # noqa: F401

        # CodeFormer-specific arch (from its own repo)
        from basicsr.archs.codeformer_arch import CodeFormer         # type: ignore

        net = CodeFormer(
            dim_embd=512,
            codebook_size=1024,
            n_head=8,
            n_layers=9,
            connect_list=["32", "64", "128", "256"],
        ).to(DEVICE)

        if not CODEFORMER_PATH.exists():
            raise FileNotFoundError(
                f"CodeFormer weights not found at {CODEFORMER_PATH}. "
                "See download instructions at the top of main.py."
            )

        checkpoint = torch.load(
            str(CODEFORMER_PATH), map_location=DEVICE, weights_only=False
        )
        net.load_state_dict(checkpoint["params_ema"])
        net.eval()
        log.info("✅ CodeFormer loaded from %s", CODEFORMER_PATH)
        return net
    except Exception as exc:
        log.warning("⚠️  CodeFormer unavailable: %s", exc)
        return None


def _load_gfpgan() -> object:
    """
    Load GFPGANer as the CCTV noise / artefact pre-processor before CodeFormer.
    """
    try:
        from gfpgan import GFPGANer  # type: ignore

        if not GFPGAN_PATH.exists():
            raise FileNotFoundError(
                f"GFPGAN weights not found at {GFPGAN_PATH}. "
                "See download instructions at the top of main.py."
            )

        enhancer = GFPGANer(
            model_path=str(GFPGAN_PATH),
            upscale=2,
            arch="clean",
            channel_multiplier=2,
            bg_upsampler=None,
        )
        log.info("✅ GFPGAN loaded from %s", GFPGAN_PATH)
        return enhancer
    except Exception as exc:
        log.warning("⚠️  GFPGAN unavailable: %s", exc)
        return None


def _load_yolo_face() -> object:
    """
    Load YOLOv8-Face detector. Handles side-profiles and angled faces well.
    """
    try:
        from ultralytics import YOLO  # type: ignore

        if not YOLO_FACE_PATH.exists():
            raise FileNotFoundError(
                f"YOLOv8-Face weights not found at {YOLO_FACE_PATH}. "
                "See download instructions at the top of main.py."
            )
        model = YOLO(str(YOLO_FACE_PATH))
        log.info("✅ YOLOv8-Face loaded from %s", YOLO_FACE_PATH)
        return model
    except Exception as exc:
        log.warning("⚠️  YOLOv8-Face unavailable: %s", exc)
        return None


def _load_insightface() -> object:
    """
    Load InsightFace FaceAnalysis with the buffalo_l bundle (contains ArcFace).
    buffalo_l is auto-downloaded to ~/.insightface/models/buffalo_l/ on first run.
    """
    try:
        import insightface  # type: ignore
        from insightface.app import FaceAnalysis  # type: ignore

        app = FaceAnalysis(
            name="buffalo_l",
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"]
            if DEVICE == "cuda"
            else ["CPUExecutionProvider"],
        )
        app.prepare(ctx_id=0 if DEVICE == "cuda" else -1, det_size=(640, 640))
        log.info("✅ InsightFace (ArcFace buffalo_l) loaded")
        return app
    except Exception as exc:
        log.error("❌ InsightFace (ArcFace) failed to load: %s", exc)
        return None


# ==============================================================================
#  STAGE 1 — Image Enhancement & Restoration
# ==============================================================================

def _bgr_to_rgb(img: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def _rgb_to_bgr(img: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(img, cv2.COLOR_RGB2BGR)


def stage1_enhance(img_bgr: np.ndarray, fidelity_w: float = DEFAULT_FIDELITY_W) -> np.ndarray:
    """
    [PAUSED FOR FORENSIC INTEGRITY]
    Two-pass restoration pipeline (GFPGAN + CodeFormer) is disabled to prevent
    AI hallucination and strictly preserve original CCTV evidence.
    
    Returns:
        Exact copy of the input BGR image.
    """
    log.info("Stage 1 Enhancement bypassed (Forensic Integrity Mode) ✔")
    return img_bgr.copy()


def save_enhanced_image(img_bgr: np.ndarray) -> str:
    """Persist the Stage-1 output and return its relative path."""
    filename = f"enhanced_{uuid.uuid4().hex}.jpg"
    filepath = ENHANCED_DIR / filename
    cv2.imwrite(str(filepath), img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 95])
    return str(filepath)


# ==============================================================================
#  STAGE 2 — Robust Face Detection
# ==============================================================================

def _yolo_detect(img_bgr: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
    """
    Primary detector: YOLOv8-Face.
    Returns (x1, y1, x2, y2) of the highest-confidence detection, or None.
    """
    yolo = _models.get("yolo_face")
    if yolo is None:
        return None
    try:
        results = yolo(img_bgr, verbose=False)[0]
        boxes = results.boxes
        if boxes is None or len(boxes) == 0:
            return None
        # Pick detection with highest confidence
        confs = boxes.conf.cpu().numpy()
        best = int(np.argmax(confs))
        x1, y1, x2, y2 = boxes.xyxy[best].cpu().numpy().astype(int)
        log.info("Stage 2 YOLOv8-Face ✔ [conf=%.3f]", float(confs[best]))
        return int(x1), int(y1), int(x2), int(y2)
    except Exception as exc:
        log.warning("YOLOv8-Face detection error: %s", exc)
        return None


def _retinaface_detect(img_bgr: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
    """
    Fallback detector: using InsightFace internally to avoid TensorFlow memory overhead.
    """
    try:
        insight = _models.get("insightface")
        if insight is None:
            return None

        faces = insight.get(img_bgr)
        if not faces:
            return None

        best_face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        x1, y1, x2, y2 = map(int, best_face.bbox)
        log.info("Stage 2 RetinaFace (fallback via InsightFace) ✔")
        return (x1, y1, x2, y2)
    except Exception as exc:
        log.warning("Fallback detection error: %s", exc)
        return None


def stage2_detect_face(img_bgr: np.ndarray) -> Tuple[np.ndarray, Tuple[int, int, int, int]]:
    """
    Detect and crop the face region.
    Primary: YOLOv8-Face → Fallback: RetinaFace.

    Returns:
        face_crop  : Cropped BGR face image.
        bbox       : (x1, y1, x2, y2) bounding box in original image coordinates.
    Raises:
        ValueError : If no face is detected by either detector.
    """
    bbox = _yolo_detect(img_bgr)

    if bbox is None:
        log.info("YOLOv8-Face found no face — activating RetinaFace fallback")
        bbox = _retinaface_detect(img_bgr)

    if bbox is None:
        raise ValueError("No face detected by YOLOv8-Face or RetinaFace fallback.")

    x1, y1, x2, y2 = bbox
    h, w = img_bgr.shape[:2]

    # Clamp coordinates to image bounds with a small margin
    pad = 10
    x1 = max(0, x1 - pad)
    y1 = max(0, y1 - pad)
    x2 = min(w, x2 + pad)
    y2 = min(h, y2 + pad)

    face_crop = img_bgr[y1:y2, x1:x2]
    return face_crop, (x1, y1, x2, y2)


# ==============================================================================
#  STAGE 3 — ArcFace Embedding (InsightFace buffalo_l)
# ==============================================================================

def stage3_extract_embedding(face_bgr: np.ndarray) -> List[float]:
    """
    Extract the 512-D ArcFace embedding vector for the given face crop.
    """
    insight = _models.get("insightface")
    if insight is None:
        raise ValueError("InsightFace (ArcFace) model is not loaded. Check startup logs.")

    import numpy as np
    face_contiguous = np.ascontiguousarray(face_bgr)
    
    faces = insight.get(face_contiguous)

    if not faces:
        raise ValueError("InsightFace could not detect/embed any face in the crop.")

    if len(faces) > 1:
        def bbox_area(f):
            b = f.bbox.astype(int)
            return (b[2] - b[0]) * (b[3] - b[1])
        faces = sorted(faces, key=bbox_area, reverse=True)
        log.info("Multiple faces in crop; selected largest (area strategy)")

    embedding: np.ndarray = faces[0].normed_embedding  # already L2-normalised
    if embedding is None or len(embedding) != EMBEDDING_DIM:
        raise ValueError(f"Unexpected embedding dimension: {len(embedding) if embedding is not None else 'None'}")

    log.info("Stage 3 ArcFace ✔ [dim=%d]", EMBEDDING_DIM)
    return embedding.tolist()


# ==============================================================================
#  STAGE 4 — Cosine Similarity Matching
# ==============================================================================

def stage4_match(
    vec_a: List[float],
    vec_b: List[float],
    threshold: float = MATCH_THRESHOLD,
) -> Tuple[float, bool]:
    """
    Compute cosine similarity between two 512-D ArcFace vectors.

    The vectors produced by InsightFace are already L2-normalised, so:
        cosine_similarity = 1 - cosine_distance = dot(a, b)

    Args:
        vec_a, vec_b : 512-D embedding vectors.
        threshold    : Similarity must STRICTLY EXCEED this to be a valid match.
    Returns:
        (similarity_score [0–1], is_valid_match [bool])
    """
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)

    if a.shape[0] != EMBEDDING_DIM or b.shape[0] != EMBEDDING_DIM:
        raise ValueError(
            f"Both vectors must be {EMBEDDING_DIM}-dimensional. "
            f"Got shapes {a.shape} and {b.shape}."
        )

    similarity = float(1.0 - cosine_distance(a, b))
    # Clamp to [0, 1] to guard against floating-point edge cases
    similarity = max(0.0, min(1.0, similarity))
    is_match = similarity > threshold

    log.info(
        "Stage 4 Cosine Similarity=%.4f | threshold=%.2f | match=%s",
        similarity, threshold, is_match,
    )
    return similarity, is_match


# ==============================================================================
#  PYDANTIC SCHEMAS
# ==============================================================================

class ForensicExtractResponse(BaseModel):
    embedding: List[float] = Field(..., description="512-D ArcFace embedding vector")
    bounding_box: dict      = Field(..., description="Face bounding box {x1,y1,x2,y2}")
    enhanced_image_path: str = Field(..., description="Absolute path to Stage-1 enhanced image")
    fidelity_w_used: float  = Field(..., description="CodeFormer fidelity weight applied")


class MatchIdentityRequest(BaseModel):
    vector_a: List[float] = Field(..., min_length=512, max_length=512)
    vector_b: List[float] = Field(..., min_length=512, max_length=512)
    threshold: float      = Field(default=MATCH_THRESHOLD, ge=0.0, le=1.0)


class MatchIdentityResponse(BaseModel):
    similarity_score: float = Field(..., description="Cosine similarity in [0, 1]")
    is_valid_match: bool    = Field(..., description=f"True if similarity > {MATCH_THRESHOLD}")
    threshold_used: float   = Field(..., description="Threshold applied for this request")


# ==============================================================================
#  FASTAPI APPLICATION
# ==============================================================================

app = FastAPI(
    title="Forensic Facial Recognition API",
    description=(
        "4-Stage pipeline: Enhancement (CodeFormer+GFPGAN) → "
        "Detection (YOLOv8-Face/RetinaFace) → "
        "Embedding (ArcFace) → Matching (Cosine Similarity)"
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.on_event("startup")
async def load_models() -> None:
    """
    Load ALL models once at startup into the global _models registry.
    This prevents expensive re-initialisation on every API request.
    """
    log.info("═══════════════════════════════════════════")
    log.info("  Forensic API — Loading models at startup")
    log.info("═══════════════════════════════════════════")

    # PAUSED for forensic integrity - prevents AI hallucinations
    _models["gfpgan"]     = None # _load_gfpgan()
    _models["codeformer"] = None # _load_codeformer()
    
    _models["yolo_face"]  = _load_yolo_face()
    _models["insightface"] = _load_insightface()

    loaded = [k for k, v in _models.items() if v is not None]
    missing = [k for k, v in _models.items() if v is None]

    log.info("✅ Loaded  : %s", loaded)
    if missing:
        log.warning("⚠️  Missing : %s — see weight download instructions at top of main.py", missing)
    log.info("═══════════════════════════════════════════")


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Utility"])
async def health_check():
    """Returns the operational status of each model."""
    return {
        "status": "ok",
        "device": DEVICE,
        "models": {k: (v is not None) for k, v in _models.items()},
    }


# ── Endpoint 1: forensic-extract ──────────────────────────────────────────────
@app.post(
    "/api/v1/forensic-extract",
    response_model=ForensicExtractResponse,
    tags=["Pipeline"],
    summary="Stages 1→2→3: Enhance → Detect → Embed",
)
async def forensic_extract(
    file: UploadFile = File(..., description="CCTV frame image (JPEG/PNG)"),
    fidelity_w: float = Form(
        default=DEFAULT_FIDELITY_W,
        ge=0.0,
        le=1.0,
        description=(
            "CodeFormer fidelity slider [0.0–1.0]. "
            "High values (≥0.8) preserve original facial structure. "
            "Low values allow more AI restoration but may hallucinate features."
        ),
    ),
):
    """
    **POST /api/v1/forensic-extract**

    Runs the 3-stage extraction pipeline on an uploaded CCTV image:
    1. **Stage 1** — GFPGAN noise removal → CodeFormer face restoration
    2. **Stage 2** — YOLOv8-Face detection → RetinaFace fallback
    3. **Stage 3** — ArcFace 512-D embedding extraction

    Returns the embedding vector, bounding box, and path to the enhanced image.
    """
    # Validate file type
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported media type: {file.content_type}. Use JPEG or PNG.",
        )

    # Read and decode uploaded image
    raw_bytes = await file.read()
    np_arr = np.frombuffer(raw_bytes, dtype=np.uint8)
    img_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if img_bgr is None:
        raise HTTPException(status_code=400, detail="Could not decode the uploaded image.")

    log.info("Received image: %s  shape=%s  fidelity_w=%.2f", file.filename, img_bgr.shape, fidelity_w)

    # ── Stage 1: Enhancement ──────────────────────────────────────────────────
    try:
        enhanced_bgr = stage1_enhance(img_bgr, fidelity_w=fidelity_w)
    except Exception as exc:
        log.error("Stage 1 failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Stage 1 (Enhancement) error: {exc}")

    enhanced_path = save_enhanced_image(enhanced_bgr)

    # ── Stage 2: Face Detection ───────────────────────────────────────────────
    try:
        face_crop, bbox = stage2_detect_face(enhanced_bgr)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        log.error("Stage 2 failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Stage 2 (Detection) error: {exc}")

    # ── Stage 3: ArcFace Embedding ────────────────────────────────────────────
    # IMPORTANT: Use the ORIGINAL img_bgr (not enhanced_bgr) for embedding.
    # Reason: seed_database.py and add_suspect.py both extract embeddings from
    # original images. Using GFPGAN/CodeFormer enhanced images here would cause
    # a domain mismatch and produce near-zero similarity scores (~0.12).
    try:
        embedding = stage3_extract_embedding(img_bgr)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        log.error("Stage 3 failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Stage 3 (Embedding) error: {exc}")

    x1, y1, x2, y2 = bbox
    return ForensicExtractResponse(
        embedding=embedding,
        bounding_box={"x1": x1, "y1": y1, "x2": x2, "y2": y2},
        enhanced_image_path=enhanced_path,
        fidelity_w_used=fidelity_w,
    )


# ── Endpoint 2: match-identity ────────────────────────────────────────────────
@app.post(
    "/api/v1/match-identity",
    response_model=MatchIdentityResponse,
    tags=["Pipeline"],
    summary="Stage 4: Cosine Similarity Matching",
)
async def match_identity(payload: MatchIdentityRequest):
    """
    **POST /api/v1/match-identity**

    Compares two 512-D ArcFace embedding vectors using cosine similarity.
    A match is only declared **valid** when similarity **strictly exceeds 0.65**
    (configurable via the `threshold` field in the request body).
    """
    try:
        similarity, is_match = stage4_match(
            payload.vector_a,
            payload.vector_b,
            threshold=payload.threshold,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        log.error("Stage 4 failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Stage 4 (Matching) error: {exc}")

    return MatchIdentityResponse(
        similarity_score=round(similarity, 6),
        is_valid_match=is_match,
        threshold_used=payload.threshold,
    )


# ==============================================================================
#  ENTRY POINT
# ==============================================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,   # Disable reload in production — models load once at startup
        log_level="info",
    )
