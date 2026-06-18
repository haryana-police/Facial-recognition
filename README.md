# Forensic Facial Recognition System

A production-ready, three-tier forensic application implementing a strict **4-Stage forensic pipeline** for analyzing pre-recorded CCTV footage and a **metadata-aware search engine** for granular suspect profiling.

---

## Architecture Overview

The system uses a modern **Node.js** backend, replacing legacy Java/ASP.NET architectures, to provide excellent asynchronous performance and cross-platform support.

### 1. Frontend: React UI (Vite) - `Port 3000`
A responsive React interface for investigators to:
- Use the **Filter Panel** to set pre-search metadata constraints (e.g., age, gender, height).
- Upload CCTV images and adjust the AI fidelity slider.
- View top 5 match results with clear visual confidence scores and full metadata profiles.

### 2. Primary Backend: Node.js (Express) - `Port 8080`
The central orchestrator written in JavaScript. 
- Connects to the local SQLite Database (`forensic_suspects.db`) in memory via `sql.js`.
- Parses multipart form requests from the frontend.
- Proxies images to the AI microservice.
- **Pre-filters** suspects based on granular metadata attributes (e.g., Gender, Age ±5, Height ±5) to optimize search.
- Performs blazing-fast **Cosine Similarity** vector matching across the database to find the top 5 suspect identities.

### 3. AI Microservice: Python FastAPI - `Port 8000`
A dedicated GPU-accelerated (or CPU fallback) microservice for AI inference.
```
CCTV Frame
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  STAGE 1 — Enhancement & Restoration (PAUSED)           │
│  [Bypassed to strictly preserve forensic integrity]     │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  STAGE 2 — Face Detection                               │
│  Primary : YOLOv8-Face (handles angles, side-profiles)  │
│  Fallback: InsightFace (native fallback)                │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  STAGE 3 — ArcFace Embedding                            │
│  InsightFace buffalo_l → 512-D normalised vector        │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  STAGE 4 — Node.js Cosine Similarity Matching           │
│  Threshold: similarity must STRICTLY EXCEED 0.60        │
└─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
Facial-recognition/
├── frontend/                ← React UI (Vite)
├── node_backend/            ← Node.js Express API (Database & Orchestration)
├── main.py                  ← FastAPI application (AI Pipeline)
├── forensic_suspects.db     ← SQLite Database containing suspects & embeddings
├── scripts/                 ← Utility scripts (e.g., add_suspect.py)
├── weights/                 ← ⚠️ Place all AI model weights here
└── enhanced_frames/         ← Auto-created; stores Stage-1 enhanced outputs
```

---

## Model Weight Downloads

Because GitHub does not allow uploading files larger than 100MB (without Git LFS), the heavy AI models are not included in the repository. **You must download them manually and place them in the `weights/` directory** before starting the AI server.

| Model | Target Directory | Download URL |
|-------|------|-------------|
| **CodeFormer** | `weights/CodeFormer/codeformer.pth` | [GitHub Releases](https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/codeformer.pth) |
| **GFPGAN v1.4** | `weights/GFPGANv1.4.pth` | [GitHub Releases](https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth) |
| **YOLOv8-Face** | `weights/yolov8n-face.pt` | [GitHub Releases](https://github.com/akanametov/yolo-face/releases) |
| **InsightFace buffalo_l** | `~/.insightface/models/buffalo_l/` | **Auto-downloaded** on first run |

> **Note:** The system will start even if some enhancement models (GFPGAN/CodeFormer) are missing, but it will throw a warning in the logs and skip the enhancement stage. YOLOv8 is highly recommended for optimal detection.

---

## 🚀 1-Click Startup (Windows Only)

For Windows users, a fully automated batch script is provided. It automatically:
1. Checks and installs all dependencies (Python, Node modules).
2. **Automatically downloads all heavy AI Model weights** directly from GitHub if they are missing.
3. Runs schema migrations (`migrate_add_metadata.py`) to safely upgrade existing databases to the new 15+ field metadata structure.
4. Opens all three servers in separate windows.

**Just double-click:** `start_windows.bat`

---

## Step-by-Step Manual Setup

To run the full system, you need to start all three layers:

### 1. Start the Python AI Microservice (Port 8000)
Ensure Python 3.11+ is installed.
```bash
# In the root directory (Facial-recognition/)
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python main.py
```
> **Note:** The server loads InsightFace and YOLOv8 into memory at startup. (GFPGAN and CodeFormer loading has been disabled for forensic integrity).

### 2. Start the Node.js Backend (Port 8080)
Ensure **Node.js** is installed on your system.
```bash
# In the node_backend/ directory
cd node_backend
npm install
node server.js
```
> **Note:** This automatically connects to `forensic_suspects.db` in the root folder.

### 3. Start the React Frontend (Port 3000)
Ensure **Node.js** is installed.
```bash
# In the frontend/ directory
cd frontend
npm install
npm run dev
```
> Access the UI at **http://localhost:3000**

---

## Database Management

The SQLite database (`forensic_suspects.db`) table `suspect` has been augmented for granular suspect profiling with the following schema:
- `id` (INTEGER PRIMARY KEY)
- `name` (TEXT)
- `image_path` (TEXT)
- `embedding_vector` (TEXT - comma separated 512 floats)
- **15+ Metadata fields**: `dd_no`, `found_date`, `found_district`, `ps_name`, `found_loc`, `gender`, `age_min`, `age_max`, `height_cm`, `build`, `skin_tone`, `hair_color`, `beard`, `visible_marks`, `clothing_description`, `notes`

### Adding a new suspect manually:
Use the provided Python script to embed a new suspect directly into the database:
```bash
python scripts/add_suspect.py "John Doe" "path/to/photo.jpg"
```

### Metadata & Image Bulk Ingestion Pipeline:
To import a large dataset of nested folders and synchronize image data with metadata from Excel/CSV source files, use the robust bulk import scripts:
```bash
# Import photos and metadata from an Excel master file
python scripts/import_from_excel.py D:\images path\to\master_data.xlsx

# Or import using a CSV file
python scripts/bulk_import_with_csv.py D:\images path\to\metadata.csv
```

### Reloading the Database in Memory:
The Node.js backend loads the entire SQLite database into memory via `sql.js` for blazing-fast vector matching. If you add new suspects via the Python scripts while the Node server is running, you **must** hit the reload endpoint to refresh its memory without restarting the server:
```bash
curl -X POST http://localhost:8080/api/reload-db
```

---

## Active AI Models Used

This system uses specific state-of-the-art models for different phases of the pipeline:

### 1. Face Detection (Finding the Face)
- **Primary Model:** **YOLOv8-Face** 
  - *Why:* Highly robust at finding faces in poor CCTV conditions, side-profiles, and angled shots.
- **Fallback Model:** **InsightFace Detector (`det_10g.onnx`)** 
  - *Why:* Replaced the legacy standalone RetinaFace (which caused TensorFlow memory crashes). It serves as a lightweight, highly accurate backup detector.

### 2. Embedding (Extracting Facial Features)
- **Model:** **ArcFace (InsightFace `buffalo_l` pack - `w600k_r50.onnx`)**
  - *Why:* Once the face is detected, this model maps the facial landmarks and geometry into a strict **512-Dimensional Vector**. It is considered one of the most accurate mathematical representations of a human face available today.

### 3. Final Result / Matching (Identity Confirmation)
- **Attribute Pre-filtering:** The system first pre-filters the suspect database by metadata constraints (Gender, Age ±5, Height ±5) to optimize search accuracy and speed.
- **Algorithm:** **Cosine Similarity (Dot Product)**
  - *Where:* Handled directly inside the **Node.js** Backend.
  - *Why:* Computes the angle difference between the uploaded image's 512-D vector and all pre-filtered vectors in the SQLite database. A match is only verified if the similarity strictly exceeds the **0.60 (60%)** threshold, returning the top 5 matches to ensure forensic-grade accuracy while preventing false positives.

---

## Key Design Decisions

| Concern | Decision |
|---------|----------|
| **Architecture Shift** | Migrated from Java/.NET to **Node.js (Express)** for faster memory management and a unified JavaScript ecosystem. |
| **TensorFlow Memory Fix** | Removed RetinaFace (TensorFlow) dependency in Python; exclusively using `InsightFace` native detection to prevent ONNX buffer allocation OOM errors. |
| **Fidelity slider default** | `w=0.85` → AI sharpens edges but cannot hallucinate facial features. |
| **Multiple faces in crop** | Largest bounding box area is selected for embedding. |
| **Global model loading** | All models load once at `@app.on_event("startup")` — no per-request overhead. |
| **Match threshold** | `> 0.60` (strict) chosen for forensic-grade false-positive control, returning Top 5 results. |
| **Forensic Integrity** | GFPGAN and CodeFormer enhancement stages have been explicitly bypassed to strictly prevent any AI hallucination or tampering with the original CCTV evidence. |
