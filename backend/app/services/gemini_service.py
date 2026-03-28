import base64
import io
from pathlib import Path
from google import genai
from google.genai import types
from app.utils.image_utils import resize_for_api


class GeminiImageService:
    """Wrapper for Google Gemini image generation/editing API."""

    def enhance_image(
        self,
        api_key: str,
        image_path: str,
        prompt: str,
        model: str = "gemini-2.0-flash-exp-image-generation",
    ) -> bytes:
        """
        Enhance an image using Gemini's multimodal capabilities.
        Returns the enhanced image as bytes.
        """
        client = genai.Client(api_key=api_key)

        # Read and prepare image
        image_bytes = resize_for_api(image_path, max_dimension=1536)

        # Upload image as inline data
        image_part = types.Part.from_bytes(
            data=image_bytes,
            mime_type="image/png",
        )

        # Create the request with image + text prompt
        response = client.models.generate_content(
            model=model,
            contents=[
                types.Content(
                    parts=[
                        image_part,
                        types.Part.from_text(text=prompt),
                    ]
                )
            ],
            config=types.GenerateContentConfig(
                response_modalities=["TEXT", "IMAGE"],
            ),
        )

        # Extract the generated image from response
        if response.candidates:
            for part in response.candidates[0].content.parts:
                if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                    return part.inline_data.data

        raise ValueError("No enhanced image in Gemini response")

    def generate_image_from_text(
        self,
        api_key: str,
        prompt: str,
        model: str = "gemini-2.5-flash-image",
    ) -> bytes:
        """
        Text-to-image: no input image. Uses Gemini image-capable model.
        """
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model,
            contents=[
                types.Content(
                    parts=[types.Part.from_text(text=prompt.strip()[:8000])],
                )
            ],
            config=types.GenerateContentConfig(
                response_modalities=["TEXT", "IMAGE"],
            ),
        )

        if response.candidates:
            for part in response.candidates[0].content.parts:
                if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                    return part.inline_data.data

        raise ValueError("No image in Gemini text-to-image response")


gemini_image_service = GeminiImageService()
