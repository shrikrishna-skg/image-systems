import base64
import httpx
import replicate as replicate_lib
from pathlib import Path


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

        # Replicate expects a file-like object; keep the handle open for the duration of the run.
        with open(image_path, "rb") as image_file:
            output = client.run(
                "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
                input={
                    "image": image_file,
                    "scale": min(scale_factor, 4),  # Real-ESRGAN supports up to 4x
                    "face_enhance": False,
                },
            )

        # Output is a URL - download the result
        if isinstance(output, str):
            resp = httpx.get(output, timeout=120)
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
                    resp = httpx.get(chunk, timeout=120)
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
