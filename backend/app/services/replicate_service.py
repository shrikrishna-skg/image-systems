import io
import httpx
import replicate as replicate_lib
from pathlib import Path
from replicate.exceptions import ModelError, ReplicateError

# Large upscaled PNGs can take a while to download from Replicate’s CDN.
_HTTP_TIMEOUT = httpx.Timeout(600.0, connect=60.0, read=600.0, write=60.0)


def _user_facing_replicate_error(exc: BaseException) -> str:
    """Short messages for job.error_message / UI (avoid dumping raw RFC7807 blobs)."""
    if isinstance(exc, ReplicateError):
        if exc.status == 402:
            return (
                "Replicate: your account needs billing credit to run upscaling (HTTP 402). "
                "Add funds at https://replicate.com/account/billing — wait a few minutes, then try again."
            )
        if exc.status == 401:
            return "Replicate: API token rejected (401). Replace the token under Integrations."
        if exc.status == 429:
            return "Replicate: rate limited (429). Wait a minute and try again."
        title = (exc.title or "Replicate error").strip()
        detail = (exc.detail or "").strip()
        if title and detail:
            return f"{title}: {detail}"
        return detail or title or "Replicate request failed."
    if isinstance(exc, ModelError):
        return f"Replicate model error: {exc}"
    return str(exc)


class ReplicateUpscaleService:
    """Wrapper for Real-ESRGAN upscaling via Replicate API."""

    def upscale_image(
        self,
        api_key: str,
        image_path: str,
        scale_factor: int = 2,
    ) -> bytes:
        """
        Upscale image using Real-ESRGAN via Replicate.
        Returns upscaled image as bytes.

        For 4x or 8x, call this multiple times with scale_factor=2.
        """
        client = replicate_lib.Client(api_token=api_key)

        path = Path(image_path)
        with open(image_path, "rb") as f:
            raw = f.read()
        # Buffer in memory so the file is not closed before the SDK finishes uploading/reading.
        upload = io.BytesIO(raw)
        upload.name = path.name or "input.png"

        try:
            output = client.run(
                "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
                input={
                    "image": upload,
                    "scale": min(scale_factor, 4),  # Real-ESRGAN supports up to 4x
                    "face_enhance": False,
                },
            )
        except (ReplicateError, ModelError) as e:
            raise RuntimeError(_user_facing_replicate_error(e)) from e

        # Output is a URL - download the result
        if isinstance(output, str):
            resp = httpx.get(output, timeout=_HTTP_TIMEOUT)
            resp.raise_for_status()
            return resp.content
        elif hasattr(output, "read"):
            return output.read()
        else:
            # Try iterating (some versions return iterator)
            result = b""
            for chunk in output:
                if isinstance(chunk, bytes):
                    result += chunk
                elif isinstance(chunk, str):
                    resp = httpx.get(chunk, timeout=_HTTP_TIMEOUT)
                    resp.raise_for_status()
                    return resp.content
            return result

    def upscale_multi_pass(
        self,
        api_key: str,
        image_path: str,
        total_scale: int = 4,
    ) -> bytes:
        """
        Multi-pass upscaling for higher resolutions.
        For 4x: single 4x pass
        For 8x: two 4x passes (actually gives 16x, then we resize down)
        For 2x: single 2x pass
        """
        if total_scale <= 2:
            return self.upscale_image(api_key, image_path, scale_factor=2)
        elif total_scale <= 4:
            return self.upscale_image(api_key, image_path, scale_factor=4)
        else:
            # Two-pass: first 4x, save temp, then 2x
            first_pass = self.upscale_image(api_key, image_path, scale_factor=4)

            # Save temp file
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                tmp.write(first_pass)
                tmp_path = tmp.name

            try:
                second_pass = self.upscale_image(api_key, tmp_path, scale_factor=2)
                return second_pass
            finally:
                import os
                os.unlink(tmp_path)


replicate_upscale_service = ReplicateUpscaleService()
