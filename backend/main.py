import io
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pybars import Compiler
from pydantic import BaseModel

from mailer import Mailer
from signature import Signature
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
_compiler = Compiler()


def _crop_square(data: bytes, size: int = 500) -> bytes:
    img = Image.open(io.BytesIO(data)).convert("RGB")
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def _render(sig_data: dict) -> str:
    source = (UTILS_DIR / "signature.txt").read_text()
    return _compiler.compile(source)(sig_data)


class SignatureRequest(BaseModel):
    first_name: str
    surname: str
    job_title: str
    phone: str
    email: str
    profile_photo_url: str


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/template")
def get_template():
    return {"template": (UTILS_DIR / "signature.txt").read_text()}


@app.post("/api/photos")
async def upload_photo(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "File too large — max 5MB")
    content = _crop_square(content)
    url = storage.upload(content, "image/jpeg")
    return {"url": url}


@app.post("/api/signatures")
def create_signature(req: SignatureRequest):
    sig = Signature()
    sig_data = sig.build(req.model_dump())
    html = _render(sig_data)
    Mailer().send_mail(html=html, to_email=req.email)
    return {"html": html}


# Serve frontend static files — mounted last so API routes take priority
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
