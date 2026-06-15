# Forensic Facial Recognition System

A production-ready, three-tier forensic application implementing a strict **4-Stage forensic pipeline** for analyzing pre-recorded CCTV footage.

---

## Architecture Overview

The system has been recently migrated to a modern **.NET Core** backend, replacing the legacy Java Spring Boot architecture, providing better performance and native Windows support.

### 1. Frontend: React UI (Vite) - `Port 3000`
A responsive React interface for investigators to upload CCTV images, adjust the AI fidelity slider, and view match results with a clear visual confidence score.

### 2. Primary Backend: .NET Core Web API - `Port 8080`
The central orchestrator written in C# (ASP.NET Core). 
- Connects to the local SQLite Database (`forensic_suspects.db`) using Entity Framework Core.
- Parses multipart form requests from the frontend.
- Proxies images to the AI microservice.
- Performs blazing-fast **Cosine Similarity** vector matching across the database to find suspect identities.

### 3. AI Microservice: Python FastAPI - `Port 8000`
A dedicated GPU-accelerated (or CPU fallback) microservice for AI inference.
```
CCTV Frame
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  STAGE 1 — Enhancement & Restoration                    │
│  Pass A: GFPGAN  → removes CCTV noise / compression     │
│  Pass B: CodeFormer (w=0.85) → sharpens, preserves face │
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
│  STAGE 4 — .NET Cosine Similarity Matching              │
│  Threshold: similarity must STRICTLY EXCEED 0.65        │
└─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
Facial-recognition/
├── frontend/                ← React UI (Vite)
├── dotnet_backend/          ← .NET 8 Web API (Database & Orchestration)
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
1. Checks and installs all dependencies (Python, Node modules, .NET packages).
2. **Automatically downloads all heavy AI Model weights** directly from GitHub if they are missing.
3. Opens all three servers in separate windows.

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
> **Note:** The server loads InsightFace, YOLOv8, GFPGAN, and CodeFormer into memory at startup.

### 2. Start the .NET Backend (Port 8080)
Ensure the **.NET 8.0 SDK** is installed on your system.
```bash
# In the dotnet_backend/ directory
cd dotnet_backend
dotnet restore
dotnet run
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

The SQLite database (`forensic_suspects.db`) table `suspect` has the following schema:
- `id` (INTEGER PRIMARY KEY)
- `name` (TEXT)
- `image_path` (TEXT)
- `embedding_vector` (TEXT - comma separated 512 floats)

### Adding a new suspect manually:
Use the provided Python script to embed a new suspect directly into the database:
```bash
python scripts/add_suspect.py "John Doe" "path/to/photo.jpg"
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
- **Algorithm:** **Cosine Similarity (Dot Product)**
  - *Where:* Handled directly inside the **.NET Core (C#)** Backend.
  - *Why:* Computes the angle difference between the uploaded image's 512-D vector and all vectors in the SQLite database. A match is only verified if the similarity strictly exceeds the **0.65 (65%)** threshold, ensuring legal and forensic-grade accuracy while preventing false positives.

---

## Key Design Decisions

| Concern | Decision |
|---------|----------|
| **Architecture Shift** | Migrated from Java Spring Boot to **.NET Core 8** for faster memory management and native Windows OS compatibility. |
| **TensorFlow Memory Fix** | Removed RetinaFace (TensorFlow) dependency in Python; exclusively using `InsightFace` native detection to prevent ONNX buffer allocation OOM errors. |
| **Fidelity slider default** | `w=0.85` → AI sharpens edges but cannot hallucinate facial features. |
| **Multiple faces in crop** | Largest bounding box area is selected for embedding. |
| **Global model loading** | All models load once at `@app.on_event("startup")` — no per-request overhead. |
| **Match threshold** | `> 0.65` (strict) chosen for forensic-grade false-positive control. |
