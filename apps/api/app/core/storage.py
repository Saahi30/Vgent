import boto3
from app.core.config import get_settings

settings = get_settings()


def get_s3_client():
    """Get an S3-compatible client for Cloudflare R2."""
    if not settings.r2_access_key_id:
        return None

    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
    )


async def upload_recording(call_id: str, audio_data: bytes, content_type: str = "audio/wav") -> str | None:
    """Upload a call recording to R2. Returns the public URL or None if storage not configured."""
    client = get_s3_client()
    if not client:
        return None

    key = f"recordings/{call_id}.wav"
    client.put_object(
        Bucket=settings.r2_bucket_name,
        Key=key,
        Body=audio_data,
        ContentType=content_type,
    )

    if settings.r2_public_url:
        return f"{settings.r2_public_url}/{key}"
    return key
