import os
import uuid
from pathlib import Path

import boto3
from botocore.client import Config


def _has_s3_config() -> bool:
    return all(
        os.environ.get(k)
        for k in ["S3_ENDPOINT_URL", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_BUCKET_NAME"]
    )


def _s3_upload(content: bytes, content_type: str) -> str:
    client = boto3.client(
        "s3",
        endpoint_url=os.environ["S3_ENDPOINT_URL"],
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        region_name=os.environ.get("AWS_REGION", "auto"),
        config=Config(signature_version="s3v4"),
    )
    bucket = os.environ["S3_BUCKET_NAME"]
    key = f"profile-photos/{uuid.uuid4()}"
    client.put_object(Bucket=bucket, Key=key, Body=content, ContentType=content_type)
    endpoint = os.environ["S3_ENDPOINT_URL"].rstrip("/")
    return f"{endpoint}/{bucket}/{key}"


def _local_upload(content: bytes, content_type: str) -> str:
    ext = content_type.split("/")[-1] if "/" in content_type else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    uploads_dir = Path(__file__).parent / "frontend" / "uploads"
    uploads_dir.mkdir(exist_ok=True)
    (uploads_dir / filename).write_bytes(content)
    site_url = os.environ.get("SITE_URL", "").rstrip("/")
    return f"{site_url}/uploads/{filename}"


def upload(content: bytes, content_type: str) -> str:
    if _has_s3_config():
        return _s3_upload(content, content_type)
    return _local_upload(content, content_type)
