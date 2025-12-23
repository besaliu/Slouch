import { useState, useEffect, useRef } from 'react';

export type CameraStatus = 'idle' | 'loading' | 'active' | 'error' | 'denied';

export function useCamera() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<CameraStatus>('idle');

    useEffect(() => {
        let mounted = true;
        let currentStream: MediaStream | null = null;

        async function setupCamera() {
            setStatus('loading');
            console.log("[Camera] Requesting camera access...");

            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        frameRate: { ideal: 30 },
                        facingMode: 'user'
                    },
                    audio: false
                });

                if (!mounted) {
                    mediaStream.getTracks().forEach(track => track.stop());
                    return;
                }

                currentStream = mediaStream;
                console.log("[Camera] Got stream:", mediaStream.getVideoTracks()[0]?.getSettings());

                if (videoRef.current) {
                    const video = videoRef.current;
                    video.srcObject = mediaStream;

                    // Wait for video to be ready before marking as active
                    await new Promise<void>((resolve, reject) => {
                        const onLoadedData = () => {
                            video.removeEventListener('loadeddata', onLoadedData);
                            video.removeEventListener('error', onError);
                            resolve();
                        };
                        const onError = (e: Event) => {
                            video.removeEventListener('loadeddata', onLoadedData);
                            video.removeEventListener('error', onError);
                            reject(e);
                        };

                        // Check if already loaded
                        if (video.readyState >= 2) {
                            resolve();
                            return;
                        }

                        video.addEventListener('loadeddata', onLoadedData);
                        video.addEventListener('error', onError);
                    });

                    // Now play the video
                    await video.play();
                    console.log("[Camera] Video playing, dimensions:", video.videoWidth, "x", video.videoHeight);
                }

                if (!mounted) return;

                setStream(mediaStream);
                setStatus('active');
                setError(null);
            } catch (err: unknown) {
                if (!mounted) return;
                console.error("[Camera] Setup error:", err);
                const errorMessage = err instanceof Error ? err.message : String(err);
                const errorName = err instanceof Error ? err.name : '';
                setError(errorMessage);
                if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
                    setStatus('denied');
                } else {
                    setStatus('error');
                }
            }
        }

        setupCamera();

        return () => {
            mounted = false;
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return { videoRef, stream, error, status };
}
