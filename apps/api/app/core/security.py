from cryptography.fernet import Fernet
from app.core.config import get_settings
import json

settings = get_settings()


def _get_fernet() -> Fernet:
    key = settings.fernet_encryption_key
    if not key:
        raise ValueError(
            "FERNET_ENCRYPTION_KEY not set. Generate one with: "
            "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode())


def encrypt_credentials(credentials: dict) -> str:
    """Encrypt provider credentials dict to a Fernet-encrypted string."""
    f = _get_fernet()
    plaintext = json.dumps(credentials).encode()
    return f.encrypt(plaintext).decode()


def decrypt_credentials(encrypted: str) -> dict:
    """Decrypt a Fernet-encrypted string back to a credentials dict."""
    f = _get_fernet()
    plaintext = f.decrypt(encrypted.encode())
    return json.loads(plaintext.decode())
