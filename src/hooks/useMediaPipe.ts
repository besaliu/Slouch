import { useState, useEffect, useRef } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// All files loaded from local public folder (bundled with app)
const WASM_PATH = "/wasm";
const MODEL_PATH = "/models/pose_landmarker_lite.task";

interface LoadingState {
    step: string;
    progress: number;
    details: string;
}

export function useMediaPipe() {
    const [landmarker, setLandmarker] = useState<PoseLandmarker | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loadingState, setLoadingState] = useState<LoadingState>({
        step: 'Initializing...',
        progress: 0,
        details: ''
    });
    const initRef = useRef(false);

    useEffect(() => {
        // Prevent double initialization in strict mode
        if (initRef.current) return;
        initRef.current = true;

        async function loadLandmarker() {
            try {
                // Step 1: Load WASM
                setLoadingState({
                    step: 'Loading vision module...',
                    progress: 10,
                    details: `WASM path: ${WASM_PATH}`
                });

                const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

                // Step 2: Create landmarker
                setLoadingState({
                    step: 'Loading pose model...',
                    progress: 50,
                    details: `Model path: ${MODEL_PATH}`
                });

                const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: MODEL_PATH,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numPoses: 1,
                    minPoseDetectionConfidence: 0.5,
                    minPosePresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                setLoadingState({ step: 'Ready!', progress: 100, details: 'GPU mode' });
                setLandmarker(poseLandmarker);
                setIsLoading(false);

            } catch (e: unknown) {
                console.error("[MediaPipe] Error:", e);

                const errorInfo = extractErrorInfo(e);

                // If GPU failed, try CPU
                if (errorInfo.includes('GPU') || errorInfo.includes('WebGL')) {
                    try {
                        setLoadingState({
                            step: 'GPU failed, trying CPU...',
                            progress: 30,
                            details: errorInfo
                        });
                        await loadWithCPU();
                        return;
                    } catch (cpuError) {
                        setError(`GPU failed: ${errorInfo}\nCPU also failed: ${extractErrorInfo(cpuError)}`);
                        setIsLoading(false);
                        return;
                    }
                }

                setError(errorInfo);
                setIsLoading(false);
            }
        }

        async function loadWithCPU() {
            setLoadingState({
                step: 'Loading vision module (CPU)...',
                progress: 20,
                details: WASM_PATH
            });

            const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

            setLoadingState({
                step: 'Loading pose model (CPU)...',
                progress: 60,
                details: MODEL_PATH
            });

            const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: MODEL_PATH,
                    delegate: "CPU"
                },
                runningMode: "VIDEO",
                numPoses: 1,
                minPoseDetectionConfidence: 0.5,
                minPosePresenceConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            setLoadingState({ step: 'Ready!', progress: 100, details: 'CPU mode' });
            setLandmarker(poseLandmarker);
            setIsLoading(false);
        }

        loadLandmarker();
    }, []);

    return { landmarker, isLoading, error, loadingState };
}

function extractErrorInfo(e: unknown): string {
    if (e instanceof Error) {
        return `${e.name}: ${e.message}`;
    }
    if (typeof e === 'string') {
        return e;
    }
    if (e && typeof e === 'object') {
        const obj = e as Record<string, unknown>;

        // Check for common properties
        if ('message' in obj && typeof obj.message === 'string') {
            return obj.message;
        }
        if ('type' in obj && typeof obj.type === 'string') {
            return `Event type: ${obj.type}`;
        }
        if ('status' in obj) {
            return `HTTP status: ${obj.status}`;
        }

        // Try to stringify
        try {
            return JSON.stringify(e, null, 2);
        } catch {
            return `[Object: ${Object.keys(obj).join(', ')}]`;
        }
    }
    return String(e);
}
