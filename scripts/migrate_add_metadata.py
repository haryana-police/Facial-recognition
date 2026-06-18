"""
migrate_add_metadata.py
─────────────────────────────────────────────────────────────────
Adds metadata columns to the existing 'suspect' table.
Safe to run multiple times — skips columns that already exist.

Run from project root:
  python scripts/migrate_add_metadata.py
"""

import sqlite3
from pathlib import Path

DB_PATH = Path('forensic_suspects.db')

NEW_COLUMNS = [
    ('dd_no',               'TEXT'),
    ('found_date',          'TEXT'),
    ('found_district',      'TEXT'),
    ('ps_name',             'TEXT'),
    ('found_loc',           'TEXT'),
    ('gender',              'TEXT'),
    ('age_min',             'INTEGER'),
    ('age_max',             'INTEGER'),
    ('height_cm',           'REAL'),
    ('build',               'TEXT'),
    ('skin_tone',           'TEXT'),
    ('hair_color',          'TEXT'),
    ('beard',               'TEXT'),
    ('visible_marks',       'TEXT'),
    ('clothing_description','TEXT'),
    ('notes',               'TEXT'),
    ('additional_details',  'TEXT'),
]

def main():
    if not DB_PATH.exists():
        print(f'ERROR: Database not found at {DB_PATH}')
        return

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    # Get existing columns
    cursor.execute('PRAGMA table_info(suspect)')
    existing = {row[1] for row in cursor.fetchall()}
    print(f'Existing columns: {sorted(existing)}')

    added = []
    skipped = []

    for col_name, col_type in NEW_COLUMNS:
        if col_name in existing:
            skipped.append(col_name)
        else:
            cursor.execute(f'ALTER TABLE suspect ADD COLUMN {col_name} {col_type}')
            added.append(col_name)
            print(f'  [+] Added column: {col_name} ({col_type})')

    conn.commit()
    conn.close()

    print(f'\nDone!')
    print(f'  Added   : {added if added else "None (all already existed)"}')
    print(f'  Skipped : {skipped}')

if __name__ == '__main__':
    main()
