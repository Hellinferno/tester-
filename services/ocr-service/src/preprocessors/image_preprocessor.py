"""Image preprocessor for OCR engines."""

from functools import reduce
from typing import Optional
from pydantic import BaseModel
from PIL import Image, ImageEnhance, ImageFilter, ImageOps


class PreprocessConfig(BaseModel):
    denoise: bool = True
    deskew: bool = True
    contrast_enhance: bool = True
    binarize: bool = False
    resize: bool = True
    max_dimension: int = 2048


class ImagePreprocessor:
    """Preprocesses PIL Images to improve OCR accuracy."""

    def process(self, image: Image.Image, config: Optional[PreprocessConfig] = None) -> Image.Image:
        cfg = config or PreprocessConfig()
        img = image.convert("RGB")

        if cfg.resize:
            img = self.resize(img, cfg.max_dimension)
        if cfg.denoise:
            img = self.denoise(img)
        if cfg.contrast_enhance:
            img = self.enhance_contrast(img)
        if cfg.binarize:
            img = self.binarize(img)
        return img

    def resize(self, image: Image.Image, max_dim: int) -> Image.Image:
        width, height = image.size
        if max(width, height) <= max_dim:
            return image
        ratio = max_dim / max(width, height)
        new_size = (int(width * ratio), int(height * ratio))
        return image.resize(new_size, Image.Resampling.LANCZOS)

    def denoise(self, image: Image.Image) -> Image.Image:
        return image.filter(ImageFilter.MEDIAN_FILTER(size=3))

    def enhance_contrast(self, image: Image.Image, factor: float = 1.5) -> Image.Image:
        enhancer = ImageEnhance.Contrast(image)
        return enhancer.enhance(factor)

    def binarize(self, image: Image.Image, threshold: int = 128) -> Image.Image:
        gray = image.convert("L")
        return gray.point(lambda p: 255 if p > threshold else 0).convert("RGB")
