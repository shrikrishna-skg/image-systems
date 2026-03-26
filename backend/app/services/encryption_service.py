from cryptography.fernet import Fernet
from app.config import settings


class EncryptionService:
    def __init__(self):
        key = settings.API_KEY_ENCRYPTION_KEY
        # If the key looks like a placeholder, generate one (dev only)
        if key == "change-me" or len(key) < 10:
            key = Fernet.generate_key().decode()
        # Ensure it's bytes
        if isinstance(key, str):
            try:
                self._fernet = Fernet(key.encode())
            except Exception:
                # Key isn't valid Fernet key, generate one
                self._fernet = Fernet(Fernet.generate_key())
        else:
            self._fernet = Fernet(key)

    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        return self._fernet.decrypt(ciphertext.encode()).decode()

    def mask_key(self, plaintext: str) -> str:
        if len(plaintext) <= 8:
            return "****"
        return plaintext[:4] + "..." + plaintext[-4:]


encryption_service = EncryptionService()
