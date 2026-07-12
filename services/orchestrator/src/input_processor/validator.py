"""Input validator and modality detector."""

from typing import Optional


class ValidationError(Exception):
    """Raised when input validation fails per FR-01 through FR-04."""
    pass


class InputValidator:
    """Validates multi-modal input payloads."""

    MAX_TEXT_LEN = 32000
    MAX_IMAGE_BYTES = 20 * 1024 * 1024  # 20MB
    MAX_VOICE_BYTES = 50 * 1024 * 1024  # ~5 min audio limit

    VALID_MODALITIES = {"image_text", "image_voice", "image_only", "voice_only", "text_only"}

    def validate(
        self,
        modality: str,
        text: Optional[str] = None,
        image_bytes: Optional[bytes] = None,
        voice_bytes: Optional[bytes] = None,
    ) -> bool:
        if modality not in self.VALID_MODALITIES:
            raise ValidationError(f"INVALID_MODALITY: {modality} is not supported.")

        if text and len(text) > self.MAX_TEXT_LEN:
            raise ValidationError(f"Text exceeds maximum limit of {self.MAX_TEXT_LEN} characters.")

        if image_bytes and len(image_bytes) > self.MAX_IMAGE_BYTES:
            raise ValidationError("FILE_TOO_LARGE: Image exceeds 20MB maximum.")

        if voice_bytes and len(voice_bytes) > self.MAX_VOICE_BYTES:
            raise ValidationError("FILE_TOO_LARGE: Audio exceeds maximum duration/size.")

        if "image" in modality and not image_bytes:
            raise ValidationError("MISSING_MEDIA: Image required for modality " + modality)

        if "voice" in modality and not voice_bytes:
            raise ValidationError("MISSING_MEDIA: Voice audio required for modality " + modality)

        if "text" in modality and (not text or not text.strip()):
            raise ValidationError("Text input required for modality " + modality)

        return True
