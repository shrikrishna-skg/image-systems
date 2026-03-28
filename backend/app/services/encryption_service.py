import logging

from cryptography.fernet import Fernet
from app.config import settings

log = logging.getLogger(__name__)

_GEN_FERNET_CMD = (
    'python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
)


class EncryptionService:
    """
    Encrypts provider API keys before they are written to Postgres (e.g. Supabase `api_keys`).
    In production, API_KEY_ENCRYPTION_KEY must be a stable Fernet secret so ciphertext survives deploys.
    """

    def __init__(self):
        raw = (settings.API_KEY_ENCRYPTION_KEY or "").strip()
        prod = settings.APP_ENV == "production" and not settings.LOCAL_DEV_MODE

        if prod:
            if not raw:
                raise RuntimeError(
                    "API_KEY_ENCRYPTION_KEY must be set in production. "
                    f"Generate a Fernet key: {_GEN_FERNET_CMD}"
                )
            try:
                self._fernet = Fernet(raw.encode())
            except Exception as e:
                raise RuntimeError(
                    "API_KEY_ENCRYPTION_KEY is not a valid Fernet key. "
                    f"Generate one: {_GEN_FERNET_CMD}"
                ) from e
            return

        if raw:
            try:
                self._fernet = Fernet(raw.encode())
                return
            except Exception:
                log.warning(
                    "API_KEY_ENCRYPTION_KEY is invalid; using an ephemeral Fernet key (development only)."
                )

        self._fernet = Fernet(Fernet.generate_key())
        log.warning(
            "No valid API_KEY_ENCRYPTION_KEY — using ephemeral Fernet (development). "
            "Saved keys will not decrypt after API restart unless you set a stable key."
        )

    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        return self._fernet.decrypt(ciphertext.encode()).decode()

    def mask_key(self, plaintext: str) -> str:
        if len(plaintext) <= 8:
            return "****"
        return plaintext[:4] + "..." + plaintext[-4:]


encryption_service = EncryptionService()
