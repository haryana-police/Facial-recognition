"""
seed_database.py (v2 - ASCII safe, better progress)
Processes every image through ArcFace and stores 512-D embeddings in SQLite.
Run: python scripts/seed_database.py
"""

import os
import sqlite3
import sys
import time
import warnings
from pathlib import Path

# Suppress FutureWarning from insightface
warnings.filterwarnings("ignore")

import cv2
import numpy as np

# ── Config ────────────────────────────────────────────────
SUBSET_DIR  = Path("dataset/lfw_subset")
DB_PATH     = Path("forensic_suspects.db")
BATCH_PRINT = 25
# ─────────────────────────────────────────────────────────


def init_db(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS suspect (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            name             TEXT    NOT NULL,
            image_path       TEXT,
            embedding_vector TEXT    NOT NULL
        )
    """)
    conn.commit()
    print("DB table ready.")


def load_insightface():
    print("Loading InsightFace ArcFace (buffalo_l)...")
    from insightface.app import FaceAnalysis
    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=(640, 640))
    print("InsightFace loaded.\n")
    return app


def extract_embedding(app, img_bgr):
    faces = app.get(img_bgr)
    if not faces:
        return None
    if len(faces) > 1:
        faces = sorted(
            faces,
            key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]),
            reverse=True
        )
    emb = faces[0].normed_embedding
    return emb if emb is not None and len(emb) == 512 else None


def embedding_to_csv(emb):
    return ",".join("%.6f" % v for v in emb)


def seed(app, conn):
    all_images = sorted(SUBSET_DIR.rglob("*.jpg"))
    total      = len(all_images)
    print("Found %d images in %s\n" % (total, SUBSET_DIR))

    if total == 0:
        print("INFO: No sample images found in dataset/lfw_subset.")
        print("INFO: An empty database has been successfully created.")
        print("INFO: You can now use the Admin Panel or bulk import scripts to add your own data.")
        sys.exit(0)

    inserted = 0
    skipped  = 0
    start    = time.time()

    for idx, img_path in enumerate(all_images, 1):
        person_name = img_path.parent.name.replace("_", " ")
        img_bgr = cv2.imread(str(img_path))
        if img_bgr is None:
            skipped += 1
            continue

        emb = extract_embedding(app, img_bgr)
        if emb is None:
            skipped += 1
        else:
            conn.execute(
                "INSERT INTO suspect (name, image_path, embedding_vector) VALUES (?, ?, ?)",
                (person_name, str(img_path), embedding_to_csv(emb))
            )
            inserted += 1

        # Progress every BATCH_PRINT images
        if idx % BATCH_PRINT == 0 or idx == total:
            elapsed = time.time() - start
            rate    = idx / elapsed if elapsed > 0 else 1
            eta     = (total - idx) / rate
            pct     = idx * 100 // total
            bar     = "#" * (pct // 2) + "-" * (50 - pct // 2)
            print("[%s] %d/%d | Inserted: %d | Skipped: %d | ETA: %.0fs"
                  % (bar, idx, total, inserted, skipped, eta))
            # Commit every batch for safety
            conn.commit()

    conn.commit()
    elapsed = time.time() - start
    print("\n" + "=" * 55)
    print("Seeding COMPLETE in %.1fs" % elapsed)
    print("  Inserted : %d" % inserted)
    print("  Skipped  : %d (no face detected)" % skipped)
    print("  DB path  : %s" % str(DB_PATH.resolve()))
    print("=" * 55)


def main():
    print("=" * 55)
    print("  Forensic DB Seeder - ArcFace Embeddings")
    print("=" * 55 + "\n")

    if not SUBSET_DIR.exists():
        print("ERROR: Dataset not found. Run: python scripts/download_dataset.py")
        sys.exit(1)

    conn = sqlite3.connect(str(DB_PATH))
    init_db(conn)

    existing = conn.execute("SELECT COUNT(*) FROM suspect").fetchone()[0]
    if existing > 0:
        ans = input("DB already has %d records. Re-seed? (y/N): " % existing).strip().lower()
        if ans != "y":
            print("Aborted.")
            conn.close()
            sys.exit(0)
        conn.execute("DELETE FROM suspect")
        conn.commit()
        print("Cleared existing records.\n")

    app = load_insightface()
    seed(app, conn)
    conn.close()
    print("\nNext: python scripts/search_and_save.py <image.jpg>")


if __name__ == "__main__":
    main()
