const express  = require('express');
const multer   = require('multer');
const axios    = require('axios');
const FormData = require('form-data');
const cors     = require('cors');
const initSqlJs = require('sql.js');
const path     = require('path');
const fs       = require('fs');

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT            = 8080;
const PYTHON_AI_URL   = 'http://127.0.0.1:8000/api/v1/forensic-extract';
const MATCH_THRESHOLD = 0.60;
const DB_PATH         = path.join(__dirname, '..', 'forensic_suspects.db');
const PHOTOS_DIR      = path.join(__dirname, '..', 'suspect_photos');

// ─── App Setup ─────────────────────────────────────────────────────────────────
const app = express();

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Serve suspect photos as static files
app.use('/suspect-photos', express.static(PHOTOS_DIR));

// Multer — memory storage for image uploads
const upload = multer({ storage: multer.memoryStorage() });

// Multer — disk storage for CSV/Excel files (temp processing)
const csvUpload = multer({ storage: multer.memoryStorage() });

// ─── Database ──────────────────────────────────────────────────────────────────
let db;
let dbBuffer; // keep raw buffer for saves

async function initDb() {
  const SQL = await initSqlJs();
  dbBuffer = fs.readFileSync(DB_PATH);
  db = new SQL.Database(dbBuffer);
  console.log(`[DB] Connected to SQLite: ${DB_PATH}`);
}

// Save in-memory DB back to disk
function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ─── Vector Math ───────────────────────────────────────────────────────────────
function parseEmbedding(embeddingStr) {
  if (!embeddingStr) return [];
  return embeddingStr.split(',').map(Number);
}

function cosineSimilarity(vecA, vecB) {
  if (!vecA.length || vecA.length !== vecB.length) return 0;

  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot   += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── CSV Parser (lightweight, no external lib needed) ─────────────────────────
function parseCsvBuffer(buffer) {
  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));

  return lines.slice(1).map(line => {
    // Handle commas inside quoted fields
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current.trim());

    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  }).filter(row => Object.values(row).some(v => v !== ''));
}

// ─── Routes ────────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Forensic Node.js Backend', port: PORT });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/suspects/upload-with-csv
// Upload a single image + its CSV row data
// Body: multipart/form-data
//   image  : image file
//   csv    : csv file (one or many rows) OR
//   metadata: JSON string with fields directly
// ─────────────────────────────────────────────────────────────────────────────
app.post(
  '/api/suspects/upload-with-csv',
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'csv', maxCount: 1 }]),
  async (req, res) => {
    const imageFile = req.files?.['image']?.[0];
    const csvFile   = req.files?.['csv']?.[0];

    if (!imageFile) {
      return res.status(400).json({ error: 'Image file is required.' });
    }

    // Parse metadata: from CSV file OR from JSON body field
    let meta = {};
    if (csvFile) {
      const rows = parseCsvBuffer(csvFile.buffer);
      if (rows.length === 0) return res.status(400).json({ error: 'CSV file is empty or invalid.' });
      meta = rows[0]; // Use first row for single-image upload
    } else if (req.body.metadata) {
      try { meta = JSON.parse(req.body.metadata); } catch { meta = {}; }
    }

    try {
      // 1. Extract embedding via Python AI
      const form = new FormData();
      form.append('file', imageFile.buffer, {
        filename:    imageFile.originalname || 'upload.jpg',
        contentType: imageFile.mimetype,
      });
      form.append('fidelity_w', '0.85');

      console.log('[API] Extracting embedding for new suspect...');
      const pythonRes = await axios.post(PYTHON_AI_URL, form, {
        headers: form.getHeaders(),
        timeout: 120_000,
      });

      const embedding = pythonRes.data.embedding;
      const embCsv    = embedding.join(',');

      // 2. Save image to suspect_photos/
      const result    = db.exec('SELECT COALESCE(MAX(id), 0) as maxid FROM suspect');
      const maxId     = result.length ? result[0].values[0][0] : 0;
      const nextId    = maxId + 1;
      const ext       = path.extname(imageFile.originalname || '.jpg');
      const ddSafe    = (meta.dd_no || `UNKNOWN_${nextId}`).replace(/[\/\\:*?"<>|]/g, '_');
      const fileName  = `${nextId}_${ddSafe}${ext}`;
      const filePath  = path.join(PHOTOS_DIR, fileName);
      fs.writeFileSync(filePath, imageFile.buffer);
      const relPath   = 'suspect_photos/' + fileName;

      // 3. Insert into DB
      db.run(
        `INSERT INTO suspect (
          name, image_path, embedding_vector,
          dd_no, found_date, found_district, ps_name, found_loc,
          gender, age_min, age_max, height_cm, build,
          skin_tone, hair_color, beard, visible_marks,
          clothing_description, notes
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          meta.name || 'Unknown',
          relPath,
          embCsv,
          meta.dd_no              || null,
          meta.found_date         || null,
          meta.found_district     || null,
          meta.ps_name            || null,
          meta.found_loc          || null,
          meta.gender             || null,
          parseInt(meta.age_min)  || 0,
          parseInt(meta.age_max)  || 0,
          parseFloat(meta.height_cm) || 0,
          meta.build              || null,
          meta.skin_tone          || null,
          meta.hair_color         || null,
          meta.beard              || null,
          meta.visible_marks      || null,
          meta.clothing_description || null,
          meta.notes              || null,
        ]
      );
      saveDb();

      const newId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      console.log(`[DB] Inserted suspect id=${newId}, dd_no=${meta.dd_no}`);

      return res.json({
        success:  true,
        id:       newId,
        dd_no:    meta.dd_no,
        filePath: relPath,
        message:  'Suspect added successfully.',
      });

    } catch (err) {
      if (err.response) {
        return res.status(500).json({ error: `AI Pipeline failed: ${JSON.stringify(err.response.data)}` });
      }
      console.error('[API] upload-with-csv error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/suspects/bulk-upload-csv
// Upload a CSV file with metadata for MANY suspects (images already in DB)
// This endpoint only updates metadata for existing records by dd_no
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/suspects/bulk-upload-csv', csvUpload.single('csv'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file required.' });

  const rows = parseCsvBuffer(req.file.buffer);
  if (!rows.length) return res.status(400).json({ error: 'CSV is empty or has no data rows.' });

  let updated = 0, inserted = 0, errors = [];

  for (const row of rows) {
    try {
      // Check if dd_no already exists
      const existing = db.exec(
        `SELECT id FROM suspect WHERE dd_no = ?`, [row.dd_no]
      );

      if (existing.length && existing[0].values.length) {
        // UPDATE existing record's metadata
        db.run(
          `UPDATE suspect SET
            found_date=?, found_district=?, ps_name=?, found_loc=?,
            gender=?, age_min=?, age_max=?, height_cm=?, build=?,
            skin_tone=?, hair_color=?, beard=?, visible_marks=?,
            clothing_description=?, notes=?, name=?
          WHERE dd_no=?`,
          [
            row.found_date || null, row.found_district || null,
            row.ps_name || null, row.found_loc || null,
            row.gender || null, parseInt(row.age_min) || 0,
            parseInt(row.age_max) || 0, parseFloat(row.height_cm) || 0,
            row.build || null, row.skin_tone || null,
            row.hair_color || null, row.beard || null,
            row.visible_marks || null, row.clothing_description || null,
            row.notes || null, row.name || 'Unknown',
            row.dd_no
          ]
        );
        updated++;
      } else {
        // INSERT as new record (no image/embedding yet)
        db.run(
          `INSERT INTO suspect (
            name, dd_no, found_date, found_district, ps_name, found_loc,
            gender, age_min, age_max, height_cm, build,
            skin_tone, hair_color, beard, visible_marks,
            clothing_description, notes
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            row.name || 'Unknown', row.dd_no || null,
            row.found_date || null, row.found_district || null,
            row.ps_name || null, row.found_loc || null,
            row.gender || null, parseInt(row.age_min) || 0,
            parseInt(row.age_max) || 0, parseFloat(row.height_cm) || 0,
            row.build || null, row.skin_tone || null,
            row.hair_color || null, row.beard || null,
            row.visible_marks || null, row.clothing_description || null,
            row.notes || null,
          ]
        );
        inserted++;
      }
    } catch (e) {
      errors.push({ dd_no: row.dd_no, error: e.message });
    }
  }

  saveDb();
  console.log(`[DB] Bulk CSV: updated=${updated}, inserted=${inserted}, errors=${errors.length}`);
  return res.json({ success: true, updated, inserted, total: rows.length, errors });
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cases/analyze-and-match
// Now supports optional pre-filtering by gender, age, height
// Body: multipart/form-data
//   image     : CCTV image file
//   fidelity_w: float (optional, default 0.85)
//   gender    : string (optional filter)
//   age       : number (optional — system applies ±5)
//   height_cm : number (optional — system applies ±5)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/cases/analyze-and-match', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided.' });
  }

  const fidelityW  = parseFloat(req.body.fidelity_w  ?? '0.85');
  const filterGender = (req.body.gender || '').trim();
  const filterAge    = req.body.age    ? parseInt(req.body.age)    : null;
  const filterHeight = req.body.height_cm ? parseFloat(req.body.height_cm) : null;

  try {
    // 1. Forward image to Python AI microservice
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename:    req.file.originalname || 'upload.jpg',
      contentType: req.file.mimetype,
    });
    form.append('fidelity_w', fidelityW.toString());

    console.log(`[API] Forwarding image to Python AI @ ${PYTHON_AI_URL}`);
    const pythonRes = await axios.post(PYTHON_AI_URL, form, {
      headers: form.getHeaders(),
      timeout: 120_000,
    });

    const aiData   = pythonRes.data;
    const embedding = aiData.embedding;
    const enhancedImagePath = aiData.enhanced_image_path;

    // 2. Build WHERE clause for pre-filtering
    let whereClauses = ['embedding_vector IS NOT NULL AND embedding_vector != ""'];
    let params = [];

    if (filterGender && filterGender.toLowerCase() !== 'any' && filterGender.toLowerCase() !== '') {
      whereClauses.push(`LOWER(gender) = LOWER(?)`);
      params.push(filterGender);
    }

    if (filterAge !== null && filterAge > 0) {
      const ageMin = filterAge - 5;
      const ageMax = filterAge + 5;
      // Include suspects where age range overlaps (or age is 0/unknown — skip those if filter active)
      whereClauses.push(`(
        (age_min > 0 AND age_max > 0 AND age_min <= ? AND age_max >= ?)
        OR (age_min = 0 AND age_max = 0)
      )`);
      params.push(ageMax, ageMin);
    }

    if (filterHeight !== null && filterHeight > 0) {
      const hMin = filterHeight - 5;
      const hMax = filterHeight + 5;
      whereClauses.push(`(height_cm = 0 OR (height_cm >= ? AND height_cm <= ?))`);
      params.push(hMin, hMax);
    }

    const whereStr = whereClauses.join(' AND ');
    const query = `
      SELECT id, name, image_path, embedding_vector,
             dd_no, found_date, found_district, ps_name, found_loc,
             gender, age_min, age_max, height_cm, build,
             skin_tone, hair_color, beard, visible_marks,
             clothing_description, notes
      FROM suspect
      WHERE ${whereStr}
    `;

    const result   = db.exec(query, params);
    const suspects = result.length
      ? result[0].values.map(row => ({
          id:                   row[0],
          name:                 row[1],
          image_path:           row[2],
          embedding_vector:     row[3],
          dd_no:                row[4],
          found_date:           row[5],
          found_district:       row[6],
          ps_name:              row[7],
          found_loc:            row[8],
          gender:               row[9],
          age_min:              row[10],
          age_max:              row[11],
          height_cm:            row[12],
          build:                row[13],
          skin_tone:            row[14],
          hair_color:           row[15],
          beard:                row[16],
          visible_marks:        row[17],
          clothing_description: row[18],
          notes:                row[19],
        }))
      : [];

    console.log(`[DB] Filtered suspects: ${suspects.length} (gender="${filterGender}", age=${filterAge}, height=${filterHeight})`);

    // 3. Face matching on filtered set
    const scoredSuspects = suspects.map(suspect => {
      const suspectVec = parseEmbedding(suspect.embedding_vector);
      const score      = cosineSimilarity(embedding, suspectVec);
      return { ...suspect, score };
    });

    scoredSuspects.sort((a, b) => b.score - a.score);
    const top5 = scoredSuspects.slice(0, 5);

    // 4. Build response
    const topMatches = top5.map(s => {
      let suspectPhotoUrl = null;
      if (s.image_path) {
        const filename = path.basename(s.image_path);
        suspectPhotoUrl = `http://localhost:${PORT}/suspect-photos/${filename}`;
      }
      return {
        id:                   s.id,
        name:                 s.name,
        similarityScore:      s.score,
        suspectPhotoUrl:      suspectPhotoUrl,
        dd_no:                s.dd_no,
        found_date:           s.found_date,
        found_district:       s.found_district,
        ps_name:              s.ps_name,
        found_loc:            s.found_loc,
        gender:               s.gender,
        age_min:              s.age_min,
        age_max:              s.age_max,
        height_cm:            s.height_cm,
        build:                s.build,
        skin_tone:            s.skin_tone,
        hair_color:           s.hair_color,
        beard:                s.beard,
        visible_marks:        s.visible_marks,
        clothing_description: s.clothing_description,
        notes:                s.notes,
        details: 'Suspect identified via AI embedding matching.',
      };
    });

    const isMatch = topMatches.length > 0 && topMatches[0].similarityScore > MATCH_THRESHOLD;

    return res.json({
      matchFound:         isMatch,
      topMatches:         topMatches,
      suspect:            topMatches[0] || null,
      similarityScore:    topMatches.length > 0 ? topMatches[0].similarityScore : null,
      enhancedImageUrl:   enhancedImagePath,
      filteredCount:      suspects.length,
      message:            isMatch ? 'Identity match found.' : 'No identity match found.',
    });

  } catch (err) {
    if (err.response) {
      const detail = err.response.data || err.response.statusText;
      console.error('[API] Python AI error:', detail);
      return res.status(500).json({ error: `AI Pipeline failed: ${JSON.stringify(detail)}` });
    }
    console.error('[API] Internal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Reload DB endpoint ───────────────────────────────────────────────────────
app.post('/api/reload-db', async (_req, res) => {
  try {
    await initDb();
    const result = db.exec('SELECT COUNT(*) as cnt FROM suspect');
    const count  = result[0].values[0][0];
    console.log(`[DB] Reloaded — ${count} suspects in memory`);
    res.json({ status: 'ok', suspectCount: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get all districts (for dropdown in filter) ───────────────────────────────
app.get('/api/districts', (_req, res) => {
  try {
    const result = db.exec(`SELECT DISTINCT found_district FROM suspect WHERE found_district IS NOT NULL AND found_district != '' ORDER BY found_district`);
    const districts = result.length ? result[0].values.map(r => r[0]) : [];
    res.json({ districts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n[OK] Forensic Node.js Backend running at http://localhost:${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/api/health`);
      console.log(`   Suspect photos: http://localhost:${PORT}/suspect-photos/<filename>\n`);
    });
  })
  .catch(err => {
    console.error('[DB] Failed to initialize database:', err.message);
    process.exit(1);
  });
