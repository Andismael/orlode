import { useState, useCallback, useRef } from 'react';
import * as faceapi from 'face-api.js';

// Load models from official CDN (jsdelivr no longer serves the weights subdir)
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

export interface FaceMatch {
  employeeId: string;
  name: string;
  distance: number;      // 0 = perfect match, > 0.6 = unknown
  confidence: number;    // 0–100%
  box: { x: number; y: number; width: number; height: number };
}

export interface LabeledEmployee {
  id: string;
  name: string;
  descriptor: Float32Array;
}

export function useFaceApi() {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  // Load all required face-api.js models
  const loadModels = useCallback(async () => {
    if (modelsLoaded || loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
    } catch (err) {
      setError('Failed to load face recognition models. Check your internet connection.');
      console.error('[useFaceApi] Model loading failed:', err);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [modelsLoaded]);

  /**
   * Detect a single face in an image element and return its descriptor.
   * Returns null if no face is detected.
   */
  const detectSingleFace = useCallback(
    async (imageEl: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => {
      if (!modelsLoaded) throw new Error('Models not loaded');
      const detection = await faceapi
        .detectSingleFace(imageEl, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      return detection ?? null;
    },
    [modelsLoaded]
  );

  /**
   * Detect all faces in an image and return descriptors + bounding boxes.
   */
  const detectAllFaces = useCallback(
    async (imageEl: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => {
      if (!modelsLoaded) throw new Error('Models not loaded');
      return faceapi
        .detectAllFaces(imageEl, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptors();
    },
    [modelsLoaded]
  );

  /**
   * Match detected face descriptors against a list of enrolled employees.
   * Returns FaceMatch[] for each detected face.
   */
  const matchFaces = useCallback(
    (
      detections: faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>>[],
      employees: LabeledEmployee[],
      threshold = 0.55
    ): FaceMatch[] => {
      if (employees.length === 0) return [];

      const labeledDescriptors = employees.map(
        (emp) => new faceapi.LabeledFaceDescriptors(emp.id, [emp.descriptor])
      );
      const matcher = new faceapi.FaceMatcher(labeledDescriptors, threshold);

      return detections.map((det) => {
        const match = matcher.findBestMatch(det.descriptor);
        const box = det.detection.box;
        const employee = employees.find((e) => e.id === match.label);
        const distance = match.distance;
        const confidence = Math.max(0, Math.round((1 - distance / threshold) * 100));

        return {
          employeeId: match.label === 'unknown' ? '' : match.label,
          name: match.label === 'unknown' ? 'Unknown' : (employee?.name ?? 'Unknown'),
          distance,
          confidence: match.label === 'unknown' ? 0 : confidence,
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
        };
      });
    },
    []
  );

  return {
    modelsLoaded,
    isLoading,
    error,
    loadModels,
    detectSingleFace,
    detectAllFaces,
    matchFaces,
  };
}
