"""
search_and_save.py
────────────────────────────────────────────────────────────
Searches a query face image against the SQLite suspect database.
Saves results as JSON + CSV in the results/ folder.

Usage:
    python scripts/search_and_save.py <path_to_image.jpg>
    python scripts/search_and_save.py                     (uses built-in demo)

Output files:
    results/result_<timestamp>.json
    results/result_<timestamp>.csv
"""

import csv
import json
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

# ── Config ────────────────────────────────────────────────
DB_PATH        = Path("forensic_suspects.db")
RESULTS_DIR    = Path("results")
MATCH_THRESHOLD = 0.65
TOP_N           = 5    # return top 5 candidates
# ─────────────────────────────────────────────────────────


def load_insightface():
    from insightface.app import FaceAnalysis
    print("Loading InsightFace ArcFace...")
    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=(640, 640))
    print("✅ Model ready.\n")
    return app


def extract_query_embedding(app, img_path: str):
    img_bgr = cv2.imread(img_path)
    if img_bgr is None:
        raise FileNotFoundError(f"Cannot read image: {img_path}")
    faces = app.get(img_bgr)
    if not faces:
        raise ValueError("No face detected in query image.")
    if len(faces) > 1:
        faces = sorted(faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]), reverse=True)
    emb = faces[0].normed_embedding
    if emb is None or len(emb) != 512:
        raise ValueError("Invalid embedding from query image.")
    print(f"✅ Query embedding extracted (dim=512)\n")
    return emb


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two L2-normalised vectors."""
    dot   = float(np.dot(a, b))
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 0.0
    return max(0.0, min(1.0, dot / denom))


def parse_embedding(csv_str: str) -> np.ndarray:
    return np.array([float(x) for x in csv_str.split(",")], dtype=np.float32)


def run_search(query_emb: np.ndarray, conn: sqlite3.Connection):
    """
    Iterates all suspect rows, computes cosine similarity,
    returns sorted list of top matches.
    """
    rows = conn.execute(
        "SELECT id, name, image_path, embedding_vector FROM suspect"
    ).fetchall()

    print(f"Comparing against {len(rows)} database records...")
    start   = time.time()
    scores  = []

    for row_id, name, img_path, emb_csv in rows:
        try:
            db_emb = parse_embedding(emb_csv)
            score  = cosine_similarity(query_emb, db_emb)
            scores.append({
                "id"         : row_id,
                "name"       : name,
                "image_path" : img_path,
                "score"      : round(score, 6),
                "is_match"   : score > MATCH_THRESHOLD,
            })
        except Exception:
            continue

    elapsed = time.time() - start
    scores.sort(key=lambda x: x["score"], reverse=True)
    top     = scores[:TOP_N]

    print(f"✅ Search complete in {elapsed:.2f}s\n")
    return top, len(rows)


def save_results(query_path: str, top_matches: list, total_searched: int):
    RESULTS_DIR.mkdir(exist_ok=True)
    ts        = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_name = f"result_{ts}"

    # ── Build result dict ─────────────────────────────────
    result = {
        "query_image"     : str(query_path),
        "timestamp"       : datetime.now().isoformat(),
        "total_searched"  : total_searched,
        "threshold"       : MATCH_THRESHOLD,
        "match_found"     : any(m["is_match"] for m in top_matches),
        "top_matches"     : [
            {
                "rank"       : i + 1,
                "id"         : m["id"],
                "name"       : m["name"],
                "score"      : m["score"],
                "is_match"   : m["is_match"],
                "image_path" : m["image_path"],
            }
            for i, m in enumerate(top_matches)
        ],
    }

    # ── Save JSON ─────────────────────────────────────────
    json_path = RESULTS_DIR / f"{base_name}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    # ── Save CSV ──────────────────────────────────────────
    csv_path = RESULTS_DIR / f"{base_name}.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "rank", "id", "name", "score", "is_match", "image_path"
        ])
        writer.writeheader()
        writer.writerows(result["top_matches"])

    return json_path, csv_path, result


def print_results(result: dict):
    print("=" * 55)
    print("  SEARCH RESULTS")
    print("=" * 55)
    print(f"  Query     : {result['query_image']}")
    print(f"  Searched  : {result['total_searched']} records")
    print(f"  Threshold : {result['threshold']}")
    print(f"  Match     : {'✅ YES' if result['match_found'] else '❌ NO'}")
    print("-" * 55)
    for m in result["top_matches"]:
        flag = "✅ MATCH" if m["is_match"] else "  ------"
        print(f"  #{m['rank']}  {flag}  {m['name']:<30}  score={m['score']:.4f}")
    print("=" * 55)


def main():
    # ── Query image ───────────────────────────────────────
    if len(sys.argv) >= 2:
        query_image = sys.argv[1]
    else:
        # Demo: pick the first image from the dataset itself
        subset = Path("dataset/lfw_subset")
        imgs   = list(subset.rglob("*.jpg"))
        if not imgs:
            print("❌ No query image provided and no dataset found.")
            print("Usage: python scripts/search_and_save.py <image.jpg>")
            sys.exit(1)
        query_image = str(imgs[0])
        print(f"ℹ  No image provided — using demo image: {query_image}\n")

    if not DB_PATH.exists():
        print(f"❌ Database not found at {DB_PATH}")
        print("Run: python scripts/seed_database.py")
        sys.exit(1)

    # ── Run pipeline ──────────────────────────────────────
    app       = load_insightface()
    query_emb = extract_query_embedding(app, query_image)

    conn = sqlite3.connect(str(DB_PATH))
    top_matches, total = run_search(query_emb, conn)
    conn.close()

    json_path, csv_path, result = save_results(query_image, top_matches, total)
    print_results(result)

    print(f"\n💾 Results saved:")
    print(f"   JSON → {json_path.resolve()}")
    print(f"   CSV  → {csv_path.resolve()}")


if __name__ == "__main__":
    main()
