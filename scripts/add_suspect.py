"""
add_suspect.py
──────────────────────────────────────────────────────────────────
Adds a single suspect to the SQLite database.
- Copies the photo to suspect_photos/ folder (dedicated storage)
- Extracts ArcFace 512-D embedding via running Python AI server
- Saves name, relative image path, and embedding to DB
- Calls /api/reload-db so Node.js picks up new entry without restart

Usage:
  python scripts/add_suspect.py "Suspect Full Name" "path/to/image.jpg"

Example:
  python scripts/add_suspect.py "Rahul Sharma" "my_test_images/rahul.jpg"
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
# ─────────────────────────────────────────────────────────────────

PHOTOS_DIR.mkdir(exist_ok=True)


def main():
    if len(sys.argv) != 3:
        print('Usage: python scripts/add_suspect.py "Suspect Name" "path/to/image.jpg"')
        sys.exit(1)

    name     = sys.argv[1].strip()
    img_src  = Path(sys.argv[2])

    if not img_src.exists():
        print('ERROR: Image not found at %s' % img_src)
        sys.exit(1)

    # ── Step 1: Get next DB ID to name the file ──────────────────
    conn   = sqlite3.connect(str(DB_PATH))
    max_id = conn.execute('SELECT COALESCE(MAX(id), 0) FROM suspect').fetchone()[0]
    next_id = max_id + 1

    # ── Step 2: Copy photo to suspect_photos/ ────────────────────
    clean_name   = name.replace(' ', '_').replace('/', '_')[:30]
    new_filename = '%d_%s%s' % (next_id, clean_name, img_src.suffix)
    dest_path    = PHOTOS_DIR / new_filename
    shutil.copy2(str(img_src), str(dest_path))
    relative_path = 'suspect_photos/' + new_filename
    print('Photo copied to: %s' % relative_path)

    # ── Step 3: Extract embedding via running Python AI server ────
    print('Extracting face embedding via AI server...')
    try:
        with open(str(img_src), 'rb') as f:
            resp = requests.post(
                PYTHON_AI_URL,
                files={'file': (img_src.name, f, 'image/jpeg')},
                data={'fidelity_w': '0.85'},
                timeout=120
            )
        if resp.status_code != 200:
            print('ERROR from AI server: %d %s' % (resp.status_code, resp.text))
            dest_path.unlink(missing_ok=True)  # cleanup copied photo
            sys.exit(1)

        emb_list = resp.json()['embedding']
        emb_csv  = ','.join('%.6f' % v for v in emb_list)
        print('Embedding extracted: %d dimensions' % len(emb_list))

    except requests.exceptions.ConnectionError:
        print('ERROR: Python AI server not running on port 8000.')
        print('       Start it with: python main.py')
        dest_path.unlink(missing_ok=True)
        sys.exit(1)

    # ── Step 4: Save to DB ────────────────────────────────────────
    conn.execute(
        'INSERT INTO suspect (name, image_path, embedding_vector) VALUES (?, ?, ?)',
        (name, relative_path, emb_csv)
    )
    conn.commit()
    new_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
    total  = conn.execute('SELECT COUNT(*) FROM suspect').fetchone()[0]
    conn.close()
    print('Saved to DB: id=%d | name=%s | path=%s' % (new_id, name, relative_path))

    # ── Step 5: Reload Node.js in-memory DB ──────────────────────
    try:
        r = requests.post(NODE_RELOAD, timeout=5)
        data = r.json()
        print('Node.js DB reloaded: %d suspects in memory' % data.get('suspectCount', '?'))
    except Exception:
        print('Note: Could not reload Node.js DB automatically.')
        print('      Restart node_backend manually if needed.')

    print('\nSUCCESS: Added [%s] | DB ID: %d | Total: %d' % (name, new_id, total))


if __name__ == '__main__':
    main()
