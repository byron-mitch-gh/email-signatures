import io
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image

import storage

load_dotenv()

app = FastAPI(title="Email Signature Generator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

UTILS_DIR = Path(__file__).parent / "utils"
FRONTEND_DIR = Path(__file__).parent / "frontend"


def _crop_square(data: bytes, size: int = 500, target_kb: int = 200) -> bytes:
    img = Image.open(io.BytesIO(data)).convert("RGB")
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)
    quality = 85
    while quality >= 40:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        if buf.tell() <= target_kb * 1024:
            break
        quality -= 10
    return buf.getvalue()



@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/template")
def get_template():
    return {"template": (UTILS_DIR / "signature.txt").read_text()}


@app.get("/api/templates")
def get_templates():
    return {
        "with_photo": (UTILS_DIR / "signature.txt").read_text(),
        "without_photo": (UTILS_DIR / "signature_without_photo.txt").read_text(),
    }


@app.post("/api/photos")
async def upload_photo(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")
    content = await file.read()
    content = _crop_square(content)
    url = storage.upload(content, "image/jpeg")
    return {"url": url}



# Serve frontend static files — mounted last so API routes take priority
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
