import os
import uuid

import boto3
from botocore.client import Config


def _client():
    return boto3.client(
        "s3",
        endpoint_url=os.environ["S3_ENDPOINT_URL"],
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        region_name=os.environ.get("AWS_REGION", "auto"),
        config=Config(signature_version="s3v4"),
    )


def upload(content: bytes, content_type: str) -> str:
    bucket = os.environ["S3_BUCKET_NAME"]
    key = f"profile-photos/{uuid.uuid4()}"
    _client().put_object(
        Bucket=bucket,
        Key=key,
        Body=content,
        ContentType=content_type,
    )
    endpoint = os.environ["S3_ENDPOINT_URL"].rstrip("/")
    return f"{endpoint}/{bucket}/{key}"
