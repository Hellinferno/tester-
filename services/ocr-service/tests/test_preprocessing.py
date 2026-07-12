from PIL import Image
from src.preprocessors import ImagePreprocessor, PreprocessConfig


def test_image_preprocessing():
    img = Image.new("RGB", (4000, 3000), color=(128, 128, 128))
    processor = ImagePreprocessor()
    cfg = PreprocessConfig(resize=True, max_dimension=1000, denoise=True, contrast_enhance=True)
    processed = processor.process(img, cfg)
    assert max(processed.size) <= 1000
