import requests
from pathlib import Path

url = "https://github.com/akanametov/yolov8-face/releases/download/v0.0.0/yolov8n-face.pt"
dest = Path("weights/yolov8n-face.pt")
dest.parent.mkdir(parents=True, exist_ok=True)

print("Downloading YOLOv8-Face weights...")
try:
    response = requests.get(url, stream=True, timeout=60, headers={"User-Agent": "Mozilla/5.0"})
    response.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in response.iter_content(chunk_size=1024*1024):
            f.write(chunk)
    print("✅ Downloaded YOLOv8-face successfully!")
except Exception as e:
    print(f"❌ Failed: {e}")
