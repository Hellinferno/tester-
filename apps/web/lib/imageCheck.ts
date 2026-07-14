// In-browser image-quality gate — the router's zero-spend Stage 0. Ported from
// the Lumos backend's assess_image_quality (variance-of-Laplacian focus metric +
// mean luma + shorter-side size), run on a <canvas> instead of PIL/numpy. If a
// frame fails, we try a one-shot contrast/brightness auto-stretch and re-check
// before deciding a retake is needed — repair beats reject.

export type ImageReason = 'blurry' | 'too_dark' | 'too_small' | '';

export interface ImageVerdict {
  ok: boolean;
  reason: ImageReason;
  detail: string;
  blurVar?: number;
  minDim?: number;
  luma?: number;
}

// Thresholds mirror the backend defaults. They were tuned on full-resolution
// frames; we analyse at a capped resolution, so treat them as approximate.
const BLUR_MIN = 30;
const LUMA_MIN = 22;
const MIN_DIM_PX = 240;
const ANALYZE_CAP = 1024; // longest side analysed, for performance

interface Decoded {
  gray: Float32Array;
  w: number;
  h: number;
  natW: number;
  natH: number;
  imageData: ImageData;
  canvas: HTMLCanvasElement;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function decode(dataUrl: string): Promise<Decoded | null> {
  try {
    const img = await loadImage(dataUrl);
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    if (!natW || !natH) return null;
    const scale = Math.min(1, ANALYZE_CAP / Math.max(natW, natH));
    const w = Math.max(1, Math.round(natW * scale));
    const h = Math.max(1, Math.round(natH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const px = imageData.data;
    const gray = new Float32Array(w * h);
    for (let i = 0, g = 0; i < px.length; i += 4, g++) {
      gray[g] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    }
    return { gray, w, h, natW, natH, imageData, canvas };
  } catch {
    return null;
  }
}

function laplacianVariance(gray: Float32Array, w: number, h: number): number {
  if (w < 3 || h < 3) return 0;
  let sum = 0;
  let sum2 = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w];
      sum += lap;
      sum2 += lap * lap;
      count++;
    }
  }
  if (!count) return 0;
  const mean = sum / count;
  return sum2 / count - mean * mean;
}

function verdictFrom(d: Decoded): ImageVerdict {
  const minDim = Math.min(d.natW, d.natH);
  let lumaSum = 0;
  for (let i = 0; i < d.gray.length; i++) lumaSum += d.gray[i];
  const luma = lumaSum / d.gray.length;
  const blurVar = laplacianVariance(d.gray, d.w, d.h);

  // Order matches the backend: small-and-not-crisp → dark → blurry → ok.
  if (minDim < MIN_DIM_PX && blurVar < BLUR_MIN * 4) {
    return { ok: false, reason: 'too_small', detail: 'The photo is small and not sharp — move closer or zoom in.', blurVar, minDim, luma };
  }
  if (luma < LUMA_MIN) {
    return { ok: false, reason: 'too_dark', detail: 'The photo is too dark to read — add light and retake.', blurVar, minDim, luma };
  }
  if (blurVar < BLUR_MIN) {
    return { ok: false, reason: 'blurry', detail: 'The photo is blurry — hold steady and retake.', blurVar, minDim, luma };
  }
  return { ok: true, reason: '', detail: 'Looks readable.', blurVar, minDim, luma };
}

export async function assessImage(dataUrl: string): Promise<ImageVerdict> {
  const d = await decode(dataUrl);
  if (!d) return { ok: true, reason: '', detail: 'Could not analyse — allowing.' }; // never block on a decode quirk
  return verdictFrom(d);
}

/** One-shot contrast/brightness auto-stretch: map the 2nd–98th luma percentiles
 *  to the full range. Runs at the image's NATIVE resolution (not the capped
 *  analysis size) so the repaired frame sent to the solver keeps its detail.
 *  Returns a new JPEG data URL, or null if it couldn't run. */
export async function enhanceImage(dataUrl: string): Promise<string | null> {
  const img = await loadImage(dataUrl).catch(() => null);
  if (!img) return null;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const px = imageData.data;

  // Luma histogram → 2nd/98th percentiles for the stretch window.
  const hist = new Array(256).fill(0);
  const total = px.length / 4;
  for (let i = 0; i < px.length; i += 4) {
    const luma = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) | 0;
    hist[Math.max(0, Math.min(255, luma))]++;
  }
  let lo = 0;
  let hi = 255;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= total * 0.02) { lo = v; break; }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= total * 0.02) { hi = v; break; }
  }
  const span = Math.max(1, hi - lo);
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = Math.max(0, Math.min(255, ((v - lo) / span) * 255));
  for (let i = 0; i < px.length; i += 4) {
    px[i] = lut[px[i]];
    px[i + 1] = lut[px[i + 1]];
    px[i + 2] = lut[px[i + 2]];
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
}

export interface CheckedImage {
  index: number;
  dataUrl: string; // possibly the enhanced version
  verdict: ImageVerdict;
  enhanced: boolean;
}

export interface CheckResult {
  images: CheckedImage[];
  anyOk: boolean;
}

/** Assess every frame; auto-enhance and re-check any that fail. `anyOk` true if
 *  at least one usable frame exists after enhancement (best-of-frames rule). */
export async function checkImages(dataUrls: string[]): Promise<CheckResult> {
  const images: CheckedImage[] = [];
  for (let i = 0; i < dataUrls.length; i++) {
    let verdict = await assessImage(dataUrls[i]);
    let dataUrl = dataUrls[i];
    let enhanced = false;
    if (!verdict.ok) {
      const better = await enhanceImage(dataUrls[i]);
      if (better) {
        const v2 = await assessImage(better);
        if (v2.ok || (v2.blurVar || 0) > (verdict.blurVar || 0)) {
          verdict = v2;
          dataUrl = better;
          enhanced = true;
        }
      }
    }
    images.push({ index: i, dataUrl, verdict, enhanced });
  }
  return { images, anyOk: images.some((im) => im.verdict.ok) };
}
