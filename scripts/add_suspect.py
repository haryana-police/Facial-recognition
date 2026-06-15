"""
add_suspect.py
────────────────────────────────────────────────────────────
Adds a single suspect to the SQLite database.
Usage: python scripts/add_suspect.py "Suspect Name" "path/to/image.jpg"
"""

import sys
import sqlite3
import cv2
from pathlib import Path
import warnings

warnings.filterwarnings("ignore")

DB_PATH = Path("forensic_suspects.db")

def load_insightface():
    from insightface.app import FaceAnalysis
    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=(640, 640))
    return app

def main():
    if len(sys.argv) != 3:
        print("Usage: python scripts/add_suspect.py \"Suspect Name\" \"path/to/image.jpg\"")
        sys.exit(1)
        
    name = sys.argv[1]
    img_path = sys.argv[2]
    
    if not Path(img_path).exists():
        print(f"❌ Error: Image not found at {img_path}")
        sys.exit(1)
        
    print("Loading AI model...")
    app = load_insightface()
    
    img_bgr = cv2.imread(img_path)
    faces = app.get(img_bgr)
    
    if not faces:
        print("❌ Error: No face detected in the image.")
        sys.exit(1)
        
    # Get largest face
    if len(faces) > 1:
        faces = sorted(faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]), reverse=True)
        
    emb = faces[0].normed_embedding
    emb_csv = ",".join("%.6f" % v for v in emb)
    
    # Save to DB
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute(
        "INSERT INTO suspect (name, image_path, embedding_vector) VALUES (?, ?, ?)",
        (name, img_path, emb_csv)
    )
    conn.commit()
    conn.close()
    
    print(f"✅ Success! Added '{name}' to the database.")

if __name__ == "__main__":
    main()
