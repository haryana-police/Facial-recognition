import re

with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace RetinaFace detect
old_retina = '''def _retinaface_detect(img_bgr: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
    """
    Fallback detector: RetinaFace with low confidence threshold.
    Returns (x1, y1, x2, y2) of the largest detected face, or None.
    """
    try:
        from retinaface import RetinaFace  # type: ignore

        faces = RetinaFace.detect_faces(img_bgr, threshold=RETINAFACE_CONF_THRESH)
        if not faces or isinstance(faces, tuple):
            return None

        # RetinaFace returns a dict. Find largest bbox.
        best_box = None
        max_area = 0
        for key, face_info in faces.items():
            facial_area = face_info["facial_area"]  # [x1, y1, x2, y2]
            area = (facial_area[2] - facial_area[0]) * (facial_area[3] - facial_area[1])
            if area > max_area:
                max_area = area
                best_box = tuple(facial_area)

        if best_box:
            log.info("Stage 2 RetinaFace (fallback) ✅")
        return best_box
    except Exception as exc:
        log.warning("RetinaFace detection error: %s", exc)
        return None'''

new_retina = '''def _retinaface_detect(img_bgr: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
    """
    Fallback detector: using InsightFace internally to avoid TensorFlow memory overhead.
    Returns (x1, y1, x2, y2) of the largest detected face, or None.
    """
    try:
        insight = _models.get("insightface")
        if insight is None:
            return None

        faces = insight.get(img_bgr)
        if not faces:
            return None

        # Return bbox of the largest face
        best_face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        x1, y1, x2, y2 = map(int, best_face.bbox)
        log.info("Stage 2 RetinaFace (fallback via InsightFace) ✅")
        return (x1, y1, x2, y2)
    except Exception as exc:
        log.warning("Fallback detection error: %s", exc)
        return None'''

content = content.replace(old_retina, new_retina)

old_stage3 = '''def stage3_extract_embedding(face_bgr: np.ndarray) -> List[float]:
    """
    Extract the 512-D ArcFace embedding vector for the given face crop.
    If multiple faces appear in the crop, uses the one with the largest bbox.

    Args:
        face_bgr : BGR face crop (numpy array).
    Returns:
        List of 512 float values representing the ArcFace embedding.
    Raises:
        ValueError : If InsightFace is not loaded or no embedding is obtained.
    """
    insight = _models.get("insightface")
    if insight is None:
        raise ValueError("InsightFace (ArcFace) model is not loaded. Check startup logs.")

    # InsightFace expects BGR — already our format
    faces = insight.get(face_bgr)

    if not faces:
        raise ValueError("No face detected by ArcFace in the cropped region.")

    # Sort faces by size descending
    faces = sorted(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]), reverse=True)
    
    embedding: np.ndarray = faces[0].normed_embedding  # already L2-normalised
    if embedding is None or len(embedding) != EMBEDDING_DIM:
        raise ValueError(f"Unexpected embedding dimension: {len(embedding) if embedding is not None else 'None'}")

    log.info("Stage 3 ArcFace ✅ [dim=%d]", EMBEDDING_DIM)
    return embedding.tolist()'''

new_stage3 = '''def stage3_extract_embedding(face_bgr: np.ndarray) -> List[float]:
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
        raise ValueError("No face detected by ArcFace in the cropped region.")

    faces = sorted(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]), reverse=True)
    
    embedding: np.ndarray = faces[0].normed_embedding
    if embedding is None or len(embedding) != EMBEDDING_DIM:
        raise ValueError(f"Unexpected embedding dimension: {len(embedding) if embedding is not None else 'None'}")

    log.info("Stage 3 ArcFace ✅ [dim=%d]", EMBEDDING_DIM)
    return embedding.tolist()'''

content = content.replace(old_stage3, new_stage3)

with open('main.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Successfully patched main.py!')
