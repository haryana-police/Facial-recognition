"""
migrate_photos.py
-----------------
Copies existing test images into the new suspect_photos/ folder
and updates image_path in DB to relative paths.
"""
import sqlite3, shutil, os
from pathlib import Path

DB_PATH     = Path('forensic_suspects.db')
PHOTOS_DIR  = Path('suspect_photos')
PHOTOS_DIR.mkdir(exist_ok=True)

conn = sqlite3.connect(str(DB_PATH))

# Get all suspects that have image paths pointing to my_test_images
rows = conn.execute(
    "SELECT id, name, image_path FROM suspect WHERE image_path IS NOT NULL"
).fetchall()

updated = 0
skipped = 0

for row_id, name, old_path in rows:
    if not old_path:
        skipped += 1
        continue

    src = Path(old_path)
    if not src.exists():
        print('MISSING: %s -> %s' % (name, old_path))
        skipped += 1
        continue

    # Already migrated
    if old_path.startswith('suspect_photos/') or old_path.startswith('suspect_photos\\'):
        skipped += 1
        continue

    # New filename: ID_cleanname.ext
    clean = name.replace(' ', '_').replace('/', '_')[:30]
    new_filename = '%d_%s%s' % (row_id, clean, src.suffix)
    new_path     = PHOTOS_DIR / new_filename
    relative     = 'suspect_photos/' + new_filename

    shutil.copy2(str(src), str(new_path))
    conn.execute("UPDATE suspect SET image_path=? WHERE id=?", (relative, row_id))
    print('Migrated: [%s] %s -> %s' % (name, old_path, relative))
    updated += 1

conn.commit()
conn.close()

print('\nDone! Updated=%d | Skipped=%d' % (updated, skipped))
