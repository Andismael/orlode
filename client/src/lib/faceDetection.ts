/**
 * face-api.js helpers (singleton, no React state).
 *
 * Models are loaded from the same CDN URL used by useFaceApi, and the load
 * promise is memoized so concurrent callers share a single network round-trip.
 *
 * Designed for both the single-photo enrollment flow (EnrollPhotoModal) and the
 * bulk ZIP enrollment flow (BulkEnrollModal in FaceDirectoryPage).
 */
import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

let loadPromise: Promise<void> | null = null;

/**
 * Loads the ssdMobilenetv1 + landmark68 + recognition nets.
 * Idempotent — subsequent calls return the cached promise.
 */
export function loadFaceApiModels(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
  })().catch((err) => {
    // Reset on failure so a retry can attempt again.
    loadPromise = null;
    throw err;
  });
  return loadPromise;
}

/**
 * Returns true once the singleton load promise has resolved.
 * Useful for skipping the spinner when models are already cached.
 */
export function faceApiModelsLoaded(): boolean {
  return (
    faceapi.nets.ssdMobilenetv1.isLoaded &&
    faceapi.nets.faceLandmark68Net.isLoaded &&
    faceapi.nets.faceRecognitionNet.isLoaded
  );
}

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = url;
    });
    return img;
  } finally {
    // Revoking too early can break decoding on some browsers — defer cleanup.
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

/**
 * Detects a single face and returns its 128-d descriptor, or null when no
 * face is found. Accepts a Blob/File or an already-loaded HTMLImageElement.
 * Auto-loads the models if needed (so callers don't have to remember).
 */
export async function detectFaceDescriptor(
  source: Blob | File | HTMLImageElement,
): Promise<Float32Array | null> {
  if (!faceApiModelsLoaded()) {
    await loadFaceApiModels();
  }

  const imageEl: HTMLImageElement =
    source instanceof HTMLImageElement ? source : await blobToImage(source);

  const detection = await faceapi
    .detectSingleFace(imageEl, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection?.descriptor ?? null;
}
