# Email Signature Generator

A web app for generating Spatialedge email signatures. Fill in your details, preview the signature live, then copy it directly into Gmail.

## Features

- Live preview as you type
- With Photo / Without Photo variants
- Optional phone number (show/hide toggle)
- Client-side image crop and compression before upload
- One-click copy as rich text for pasting into Gmail
- Step-by-step Gmail setup instructions built in

## Stack

- **Backend:** FastAPI (Python 3.11) — serves templates and handles photo uploads
- **Frontend:** Vanilla JS / HTML / CSS — no build step
- **Storage:** Cloudflare R2 (S3-compatible) with local filesystem fallback
- **Deployment:** Railway (auto-deploys on push to `main`)

## Local development

**Requirements:** Python 3.11+

```bash
# Install dependencies
pip install -r backend/requirements.txt

# Start the backend (from repo root)
python3 -m uvicorn main:app --host 127.0.0.1 --port 8080 --app-dir backend

# Serve the frontend (separate terminal)
python3 -m http.server 3000 --directory frontend
```

Open [http://localhost:3000](http://localhost:3000).

The frontend auto-detects `localhost` and points API calls at `http://localhost:8080`.

## Project structure

```
backend/
  main.py              # FastAPI app — /api/health, /api/templates, /api/photos
  requirements.txt
  utils/
    signature.txt              # HTML email template (with photo)
    signature_without_photo.txt # HTML email template (without photo)

frontend/
  index.html
  app.js
  style.css
  images/              # Static assets (logo, etc.)
```

## Deployment

Pushing to `main` triggers a Railway deploy via the root `Dockerfile`, which copies `backend/` and `frontend/` into the container.

```bash
git push origin main   # GitLab (primary Railway trigger)
git push github main   # GitHub mirror
```

## Environment variables (Railway)

| Variable | Description |
|---|---|
| `STORAGE_BUCKET` | R2 bucket name |
| `STORAGE_ENDPOINT` | R2 endpoint URL |
| `STORAGE_ACCESS_KEY` | R2 access key |
| `STORAGE_SECRET_KEY` | R2 secret key |
| `STORAGE_PUBLIC_URL` | Public base URL for uploaded photos |

If storage variables are not set, uploaded photos fall back to local filesystem storage.
