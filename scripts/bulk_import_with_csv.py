"""
bulk_import_with_csv.py
──────────────────────────────────────────────────────────────────
Bulk imports suspect photos AND their metadata from a CSV file.

The script matches images to CSV rows using dd_no:
  - Image filename should contain the dd_no (or exact match)
  - OR you can place images in a folder named by dd_no

Usage:
  python scripts/bulk_import_with_csv.py <photos_folder> <csv_file>

Example:
  python scripts/bulk_import_with_csv.py "D:/suspect_images" "D:/data.csv"

CSV Required columns:
  dd_no (used to match with image filename)

CSV Optional columns (any of these will be stored):
  name, found_date, found_district, ps_name, found_loc,
  gender, age_min, age_max, height_cm, build,
  skin_tone, hair_color, beard, visible_marks,
  clothing_description, notes
"""

import sys
import csv
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


def load_csv(csv_path):
    """Load CSV into a dict keyed by dd_no."""
    rows = {}
    with open(str(csv_path), 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # normalize keys: lowercase, strip spaces
            norm = {k.strip().lower().replace(' ', '_'): v.strip() for k, v in row.items()}
            dd = norm.get('dd_no', '').strip()
            if dd:
                rows[dd] = norm
    print(f'[CSV] Loaded {len(rows)} rows from {csv_path}')
    return rows


def find_image_for_ddno(folder, dd_no):
    """Find an image file in folder whose name contains dd_no."""
    dd_clean = dd_no.replace('/', '_').replace('\\', '_')
    for f in folder.rglob('*'):
        if f.suffix.lower() not in ALLOWED_EXTENSIONS:
            continue
        # Try: filename matches dd_no exactly, or folder name matches
        if dd_no in f.stem or dd_clean in f.stem or dd_no in f.parent.name:
            return f
    return None


def extract_embedding(img_path):
    """Call Python AI server to get 512-D ArcFace embedding."""
    with open(str(img_path), 'rb') as f:
        resp = requests.post(
            PYTHON_AI_URL,
            files={'file': (img_path.name, f, 'image/jpeg')},
            data={'fidelity_w': '0.85'},
            timeout=120
        )
    if resp.status_code != 200:
        raise Exception(f'AI Error {resp.status_code}: {resp.text.strip()}')
    return resp.json()['embedding']


def main():
    if len(sys.argv) not in (2, 3):
        print('Usage: python scripts/bulk_import_with_csv.py <photos_folder> [csv_file]')
        sys.exit(1)

    photos_folder = Path(sys.argv[1])
    if not photos_folder.is_dir():
        print(f'ERROR: Photos folder not found: {photos_folder}')
        sys.exit(1)

    csv_path = Path(sys.argv[2]) if len(sys.argv) == 3 else None
    if csv_path and not csv_path.exists():
        print(f'ERROR: CSV file not found: {csv_path}')
        sys.exit(1)

    # Load CSV metadata
    csv_data = load_csv(csv_path) if csv_path else {}

    # Collect all images
    all_images = [f for f in photos_folder.rglob('*')
                  if f.is_file() and f.suffix.lower() in ALLOWED_EXTENSIONS]
    print(f'[SCAN] Found {len(all_images)} image(s) to process\n')

    if not all_images:
        print('No images found. Exiting.')
        sys.exit(0)

    conn = sqlite3.connect(str(DB_PATH))
    success_count = 0
    skip_count    = 0
    fail_count    = 0

    for img_path in all_images:
        # Try to find matching CSV row by filename
        meta = {}
        matched_dd = None

        # Try to match by dd_no in filename or parent folder
        for dd_no, row in csv_data.items():
            dd_clean = dd_no.replace('/', '_').replace('\\', '_')
            if dd_no in img_path.stem or dd_clean in img_path.stem or dd_no in img_path.parent.name:
                meta = row
                matched_dd = dd_no
                break

        # If no match, use filename as dd_no
        if not matched_dd:
            matched_dd = img_path.stem

        name = meta.get('name', 'Unknown').strip() or 'Unknown'

        # Skip if already in DB (by dd_no)
        existing = conn.execute('SELECT id FROM suspect WHERE dd_no = ?', (matched_dd,)).fetchone()
        if existing:
            print(f'[SKIP] dd_no={matched_dd} already in DB (id={existing[0]})')
            skip_count += 1
            continue

        print(f'[PROCESS] {img_path.name}  dd_no={matched_dd}')

        # Get next ID
        max_id  = conn.execute('SELECT COALESCE(MAX(id), 0) FROM suspect').fetchone()[0]
        next_id = max_id + 1

        # Copy image
        dd_safe      = matched_dd.replace('/', '_').replace('\\', '_')[:40]
        new_filename = f'{next_id}_{dd_safe}{img_path.suffix.lower()}'
        dest_path    = PHOTOS_DIR / new_filename
        try:
            shutil.copy2(str(img_path), str(dest_path))
        except Exception as e:
            print(f'  [ERROR] Copy failed: {e}')
            fail_count += 1
            continue

        relative_path = f'suspect_photos/{new_filename}'

        # Extract embedding
        try:
            emb_list = extract_embedding(img_path)
            emb_csv  = ','.join(f'{v:.6f}' for v in emb_list)
        except requests.exceptions.ConnectionError:
            print('  [ERROR] Python AI server not running on port 8000. Start it first.')
            dest_path.unlink(missing_ok=True)
            conn.close()
            sys.exit(1)
        except Exception as e:
            print(f'  [ERROR] Embedding failed: {e}')
            dest_path.unlink(missing_ok=True)
            fail_count += 1
            continue

        # Insert into DB
        try:
            conn.execute(
                '''INSERT INTO suspect (
                    name, image_path, embedding_vector,
                    dd_no, found_date, found_district, ps_name, found_loc,
                    gender, age_min, age_max, height_cm, build,
                    skin_tone, hair_color, beard, visible_marks,
                    clothing_description, notes
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                [
                    name,
                    relative_path,
                    emb_csv,
                    matched_dd,
                    meta.get('found_date', '') or None,
                    meta.get('found_district', '') or None,
                    meta.get('ps_name', '') or None,
                    meta.get('found_loc', '') or None,
                    meta.get('gender', '') or None,
                    int(meta.get('age_min', 0) or 0),
                    int(meta.get('age_max', 0) or 0),
                    float(meta.get('height_cm', 0) or 0),
                    meta.get('build', '') or None,
                    meta.get('skin_tone', '') or None,
                    meta.get('hair_color', '') or None,
                    meta.get('beard', '') or None,
                    meta.get('visible_marks', '') or None,
                    meta.get('clothing_description', '') or None,
                    meta.get('notes', '') or None,
                ]
            )
            conn.commit()
            print(f'  [OK] Saved id={next_id}, dd_no={matched_dd}, name={name}')
            success_count += 1

        except Exception as e:
            print(f'  [ERROR] DB insert failed: {e}')
            dest_path.unlink(missing_ok=True)
            fail_count += 1

    conn.close()

    print(f'\n--- Import Summary ---')
    print(f'Total Images : {len(all_images)}')
    print(f'Successful   : {success_count}')
    print(f'Skipped      : {skip_count}')
    print(f'Failed       : {fail_count}')

    if success_count > 0:
        try:
            r = requests.post(NODE_RELOAD, timeout=5)
            data = r.json()
            print(f'\nNode.js DB reloaded! Suspects in memory: {data.get("suspectCount", "?")}')
        except Exception:
            print('\nNote: Could not reload Node.js DB. Restart node_backend if needed.')


if __name__ == '__main__':
    main()
