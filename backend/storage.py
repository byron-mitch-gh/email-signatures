import base64
import json
import os
import uuid

from google.cloud import storage as gcs


def _client() -> gcs.Client:
    raw = os.environ.get("GOOGLE_CREDENTIALS_JSON")
    if raw:
        try:
            decoded = base64.b64decode(raw).decode()
        except Exception:
            decoded = raw
        info = json.loads(decoded)
        from google.oauth2.service_account import Credentials
        creds = Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        return gcs.Client(credentials=creds, project=info.get("project_id"))
    return gcs.Client()


def upload(content: bytes, content_type: str) -> str:
    bucket_name = os.environ["GCS_BUCKET_NAME"]
    bucket = _client().bucket(bucket_name)
    blob = bucket.blob(f"profile-photos/{uuid.uuid4()}")
    blob.upload_from_string(content, content_type=content_type)
    blob.make_public()
    return blob.public_url
