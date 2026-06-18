@echo off
TITLE Forensic Facial Recognition System
COLOR 0A

echo ========================================================
echo   Forensic Facial Recognition - Auto Setup ^& Start
echo ========================================================
echo.

:: 1. PYTHON SETUP
echo [1/4] Checking Python AI Microservice...
if not exist "venv\" (
    echo - Creating Python Virtual Environment...
    python -m venv venv
)
echo - Installing/Verifying Python dependencies...
call venv\Scripts\activate
pip install -r requirements.txt -q
if not exist "weights\" mkdir weights

echo - Checking AI Model Weights...
:: [FORENSIC INTEGRITY] - AI Enhancement bypassed. Weights download disabled.
:: if not exist "weights\codeformer.pth" (
::     echo   - Downloading CodeFormer...
::     curl -L "https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/codeformer.pth" -o "weights\codeformer.pth"
:: )
:: if not exist "weights\GFPGANv1.4.pth" (
::     echo   - Downloading GFPGAN...
::     curl -L "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth" -o "weights\GFPGANv1.4.pth"
:: )
if not exist "weights\yolov8n-face.pt" (
    echo   - Downloading YOLOv8-Face...
    curl -L "https://github.com/akanametov/yolo-face/releases/download/v0.0.0/yolov8n-face.pt" -o "weights\yolov8n-face.pt"
)
echo - All weights are present!

:: ─── DATABASE CHECK + MIGRATION ───────────────────────────────────────────────
echo.
echo [2/4] Checking Database...
if not exist "forensic_suspects.db" (
    echo - Database not found. Seeding initial database...
    python scripts\seed_database.py
)

echo - Running metadata schema migration (safe - skips existing columns)...
python scripts\migrate_add_metadata.py
echo - Database ready!

:: 2. FRONTEND SETUP
echo.
echo [3/4] Checking React Frontend...
cd frontend
if not exist "node_modules\" (
    echo - Installing Node modules, this might take a minute...
    call npm install
)
cd ..

:: 3. NODE.JS BACKEND SETUP
echo.
echo [4/4] Checking Node.js Backend...
cd node_backend
if not exist "node_modules\" (
    echo - Installing Node.js backend modules, this might take a minute...
    call npm install
)
cd ..

echo.
echo ========================================================
echo   All Dependencies Installed! Booting up servers...
echo ========================================================
echo.

:: Start services in separate command windows
echo Starting AI Microservice (Python) on Port 8000...
start "AI Microservice (Python)" cmd /k "call venv\Scripts\activate && python main.py"

echo Starting Primary Backend (Node.js) on Port 8080...
start "Primary Backend (Node.js)" cmd /k "cd node_backend && node server.js"

echo Starting Frontend UI (React) on Port 3000...
start "Frontend UI (React)" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo   System is now running in the background windows!
echo   Please wait 10-15 seconds for the AI models to load.
echo.
echo   Dashboard URL : http://localhost:3000
echo   Backend API   : http://localhost:8080/api/health
echo   AI Service    : http://localhost:8000/health
echo ========================================================
echo.
pause
