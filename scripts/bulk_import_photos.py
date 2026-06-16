"""
bulk_import_photos.py
──────────────────────────────────────────────────────────────────
Bulk imports all photos from a given folder into the Facial Recognition DB.
The filename (without extension) will be used as the suspect's name.

Usage:
  python scripts/bulk_import_photos.py "path/to/folder_with_photos"

Example:
  python scripts/bulk_import_photos.py "D:/My_Real_Data_Folder"
"""

import sys
import sqlite3
import shutil
import requests
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────
DB_PATH       = Path('forensic_suspects.db')
PHOTOS_DIR    = Path('suspect_photos')
PYTHON_AI_URL = 'http://127.0.0.1:8000/api/v1/forensic-extract'
NODE_RELOAD   = 'http://127.0.0.1:8080/api/reload-db'

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
# ─────────────────────────────────────────────────────────────────

PHOTOS_DIR.mkdir(exist_ok=True)

def main():
    if len(sys.argv) != 2:
        print('Usage: python scripts/bulk_import_photos.py "path/to/folder"')
        sys.exit(1)

    source_dir = Path(sys.argv[1])
    if not source_dir.is_dir():
        print(f"ERROR: Directory '{source_dir}' does not exist.")
        sys.exit(1)

    # Collect all image files (recursively scans subfolders)
    image_files = [f for f in source_dir.rglob('*') if f.is_file() and f.suffix.lower() in ALLOWED_EXTENSIONS]
    
    if not image_files:
        print(f"No valid image files found in '{source_dir}'.")
        sys.exit(0)

    print(f"Found {len(image_files)} image(s) to process. Starting import...\n")

    conn = sqlite3.connect(str(DB_PATH))
    success_count = 0
    fail_count = 0

    for img_path in image_files:
        if img_path.stem.lower() == 'face_front':
            name = img_path.parent.name # Use folder name (e.g. 13221005010220251801020)
        else:
            name = img_path.stem  # Filename without extension
        
        # Resume capability: check if already exists
        existing = conn.execute('SELECT id FROM suspect WHERE name = ?', (name,)).fetchone()
        if existing:
            print(f"Skipping: {name} (Already in DB with ID {existing[0]})")
            continue

        print(f"Processing: {name} ({img_path.name})")

        # Get next DB ID
        max_id = conn.execute('SELECT COALESCE(MAX(id), 0) FROM suspect').fetchone()[0]
        next_id = max_id + 1

        # Copy photo to suspect_photos/
        clean_name   = name.replace(' ', '_').replace('/', '_')[:30]
        new_filename = f"{next_id}_{clean_name}{img_path.suffix}"
        dest_path    = PHOTOS_DIR / new_filename
        
        try:
            shutil.copy2(str(img_path), str(dest_path))
        except Exception as e:
            print(f"  [ERROR] Failed to copy file: {e}")
            fail_count += 1
            continue

        relative_path = f"suspect_photos/{new_filename}"

        # Extract embedding via AI server
        try:
            with open(str(img_path), 'rb') as f:
                resp = requests.post(
                    PYTHON_AI_URL,
                    files={'file': (img_path.name, f, 'image/jpeg')},
                    data={'fidelity_w': '0.85'},
                    timeout=120
                )
            
            if resp.status_code != 200:
                print(f"  [ERROR] AI Error: {resp.text.strip()}")
                dest_path.unlink(missing_ok=True)
                fail_count += 1
                continue

            emb_list = resp.json()['embedding']
            emb_csv  = ','.join(f"{v:.6f}" for v in emb_list)

            # Save to DB
            conn.execute(
                'INSERT INTO suspect (name, image_path, embedding_vector) VALUES (?, ?, ?)',
                (name, relative_path, emb_csv)
            )
            conn.commit()
            print(f"  [SUCCESS] Saved ID {next_id}: {name}")
            success_count += 1

        except requests.exceptions.ConnectionError:
            print("  [ERROR] Python AI server not running on port 8000.")
            dest_path.unlink(missing_ok=True)
            fail_count += 1
            break
        except Exception as e:
            print(f"  [ERROR] Unexpected error: {e}")
            dest_path.unlink(missing_ok=True)
            fail_count += 1

    conn.close()

    print(f"\n--- Import Summary ---")
    print(f"Total Processed : {len(image_files)}")
    print(f"Successful      : {success_count}")
    print(f"Failed          : {fail_count}")

    # Reload Node.js DB
    if success_count > 0:
        try:
            r = requests.post(NODE_RELOAD, timeout=5)
            data = r.json()
            print(f"\nNode.js DB reloaded! Active records in memory: {data.get('suspectCount', '?')}")
        except Exception:
            print("\nNote: Could not automatically reload Node.js DB. Restart node_backend if needed.")

if __name__ == '__main__':
    main()
