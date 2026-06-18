import sqlite3
conn = sqlite3.connect('forensic_suspects.db')
total     = conn.execute('SELECT COUNT(*) FROM suspect').fetchone()[0]
with_emb  = conn.execute("SELECT COUNT(*) FROM suspect WHERE embedding_vector IS NOT NULL AND LENGTH(embedding_vector) > 10").fetchone()[0]
no_face   = total - with_emb
last_id   = conn.execute("SELECT MAX(id) FROM suspect").fetchone()[0]
conn.close()

print(f'Total records in DB : {total}')
print(f'Successfully imported (with embedding): {with_emb}')
print(f'Face not detected (skipped)           : {no_face}')
print(f'Last saved ID                         : {last_id}')
print(f'Remaining (approx)                    : {6886 - (with_emb - 803)}')
