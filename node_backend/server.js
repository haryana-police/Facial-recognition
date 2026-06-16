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

// Allow React frontend (port 3000) to call this backend
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Serve suspect photos as static files
// Access via: http://localhost:8080/suspect-photos/531_vijay.jpeg
app.use('/suspect-photos', express.static(PHOTOS_DIR));

// Multer — store uploaded images in memory (no disk write needed)
const upload = multer({ storage: multer.memoryStorage() });

// ─── Database ──────────────────────────────────────────────────────────────────
// sql.js loads the entire SQLite file into memory — no C++ compilation needed
let db;

async function initDb() {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  db = new SQL.Database(fileBuffer);
  console.log(`[DB] Connected to SQLite: ${DB_PATH}`);
}

// ─── Vector Math ───────────────────────────────────────────────────────────────
/**
 * Parse a comma-separated embedding string into a Float32 number array.
 * @param {string} embeddingStr
 * @returns {number[]}
 */
function parseEmbedding(embeddingStr) {
  if (!embeddingStr) return [];
  return embeddingStr.split(',').map(Number);
}

/**
 * Compute cosine similarity between two numeric vectors.
 * Returns a value in [0, 1] — 1 means identical direction.
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number}
 */
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

// ─── Routes ────────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Forensic Node.js Backend', port: PORT });
});

/**
 * POST /api/cases/analyze-and-match
 * Accepts: multipart/form-data  { image: <File>, fidelity_w: <float> }
 * Returns: { matchFound, suspect, similarityScore, enhancedImageUrl, message }
 */
app.post('/api/cases/analyze-and-match', upload.single('image'), async (req, res) => {
  // 1. Validate input
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided.' });
  }

  const fidelityW = parseFloat(req.body.fidelity_w ?? '0.85');

  try {
    // 2. Forward image to Python AI microservice
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename:    req.file.originalname || 'upload.jpg',
      contentType: req.file.mimetype,
    });
    form.append('fidelity_w', fidelityW.toString());

    console.log(`[API] Forwarding image to Python AI @ ${PYTHON_AI_URL}`);
    const pythonRes = await axios.post(PYTHON_AI_URL, form, {
      headers: form.getHeaders(),
      timeout: 120_000, // 2 min — AI pipeline can be slow on first run
    });

    const aiData = pythonRes.data;
    const embedding       = aiData.embedding;            // number[]
    const enhancedImagePath = aiData.enhanced_image_path; // string
    // const bbox = aiData.bounding_box;                 // kept for future use

    // 3. Query all suspects from SQLite (sql.js returns {columns, values})
    const result   = db.exec('SELECT id, name, embedding_vector, image_path FROM suspect');
    const suspects = result.length
      ? result[0].values.map(row => ({
          id:               row[0],
          name:             row[1],
          embedding_vector: row[2],
          image_path:       row[3],
        }))
      : [];
    console.log(`[DB] Loaded ${suspects.length} suspects for comparison`);

    // 4. Calculate score for all suspects
    const scoredSuspects = suspects.map(suspect => {
      const suspectVec = parseEmbedding(suspect.embedding_vector);
      const score      = cosineSimilarity(embedding, suspectVec);
      return { ...suspect, score };
    });

    // Sort descending by score and pick top 5
    scoredSuspects.sort((a, b) => b.score - a.score);
    const top5 = scoredSuspects.slice(0, 5);

    // 5. Map to match objects
    const topMatches = top5.map(s => {
      let suspectPhotoUrl = null;
      if (s.image_path) {
        const filename = path.basename(s.image_path);
        suspectPhotoUrl = `http://localhost:${PORT}/suspect-photos/${filename}`;
      }
      return {
        id: s.id,
        name: s.name,
        similarityScore: s.score,
        suspectPhotoUrl: suspectPhotoUrl,
        details: 'Suspect identified via AI embedding matching.',
      };
    });

    const isMatch = topMatches.length > 0 && topMatches[0].similarityScore > MATCH_THRESHOLD;

    return res.json({
      matchFound:       isMatch,
      topMatches:       topMatches, // New field for top 5 matches
      suspect:          topMatches[0] || null, // Keep for backward compatibility
      similarityScore:  topMatches.length > 0 ? topMatches[0].similarityScore : null,
      enhancedImageUrl: enhancedImagePath,
      message:          isMatch ? 'Identity match found.' : 'No identity match found.',
    });

  } catch (err) {
    // Surface Python AI errors clearly
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
// Call POST /api/reload-db after adding new suspects — no server restart needed!
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

// ─── Start ────────────────────────────────────────────────────────────────────
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n✅ Forensic Node.js Backend running at http://localhost:${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/api/health`);
      console.log(`   Suspect photos: http://localhost:${PORT}/suspect-photos/<filename>\n`);
    });
  })
  .catch(err => {
    console.error('[DB] Failed to initialize database:', err.message);
    process.exit(1);
  });
