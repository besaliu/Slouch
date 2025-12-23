import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { sendAppNotification } from '../lib/notification';

// Logic constants
const SLOUCH_TIME_THRESHOLD_MS = 5000; // 5 seconds of slouching before notification
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between notifications
const DETECTION_INTERVAL_MS = 100; // Run detection every 100ms (~10fps)
const MAX_TIME_DELTA_MS = 500; // Cap time delta to prevent huge jumps when returning from background
const EYE_BREAK_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes for 20-20-20 rule

export function usePostureLogic(
    landmarker: PoseLandmarker | null,
    videoRef: React.RefObject<HTMLVideoElement>,
    stream: MediaStream | null
) {
    // Get store values
    const isMonitoring = useAppStore((s) => s.isMonitoring);
    const isPaused = useAppStore((s) => s.isPaused);
    const baselineHeight = useAppStore((s) => s.baselineHeight);
    const sensitivity = useAppStore((s) => s.sensitivity);
    const updateSessionStats = useAppStore((s) => s.updateSessionStats);

    // State for UI
    const [currentHeight, setCurrentHeight] = useState<number | null>(null);
    const [isSlouching, setIsSlouching] = useState(false);
    const [haveLandmarks, setHaveLandmarks] = useState(false);
    const [slouchTimer, setSlouchTimer] = useState(0);

    // Refs for detection loop (don't trigger rerenders)
    const lastNotificationTime = useRef<number>(0);
    const slouchStartTime = useRef<number | null>(null);
    const timestampCounter = useRef<number>(0);
    const intervalId = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastEyeBreakTime = useRef<number>(0); // Track 20-20-20 rule notifications

    // Track last known posture state for background tracking
    const lastKnownSlouching = useRef<boolean>(false);
    const lastUpdateTime = useRef<number>(0);

    // Store refs that we read inside the loop (to avoid stale closures)
    const storeRef = useRef({ isMonitoring, isPaused, baselineHeight, sensitivity, updateSessionStats });
    useEffect(() => {
        storeRef.current = { isMonitoring, isPaused, baselineHeight, sensitivity, updateSessionStats };
    }, [isMonitoring, isPaused, baselineHeight, sensitivity, updateSessionStats]);

    // Main detection loop using setInterval (continues in background)
    useEffect(() => {
        if (!landmarker || !stream || !videoRef.current) {
            console.log("[Posture] Waiting for dependencies:", {
                landmarker: !!landmarker,
                stream: !!stream,
                video: !!videoRef.current
            });
            return;
        }

        const video = videoRef.current;

        // Wait for video to be ready
        const checkVideoReady = () => {
            return video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
        };

        const runDetection = () => {
            const now = Date.now();
            const store = storeRef.current;

            // Calculate time delta, capped to prevent huge jumps
            let timeDelta = lastUpdateTime.current > 0
                ? Math.min(now - lastUpdateTime.current, MAX_TIME_DELTA_MS)
                : DETECTION_INTERVAL_MS;
            lastUpdateTime.current = now;

            // Always track time when monitoring and not paused, even if we can't detect
            if (store.isMonitoring && !store.isPaused) {
                // Update session stats based on last known posture state
                if (lastKnownSlouching.current) {
                    store.updateSessionStats(0, timeDelta);

                    // Update slouch timer
                    if (slouchStartTime.current !== null) {
                        const elapsed = now - slouchStartTime.current;
                        setSlouchTimer(elapsed);
                    }
                } else {
                    store.updateSessionStats(timeDelta, 0);
                }

                // 20-20-20 Rule: Send eye break reminder every 20 minutes
                const timeSinceLastEyeBreak = now - lastEyeBreakTime.current;
                if (timeSinceLastEyeBreak >= EYE_BREAK_INTERVAL_MS) {
                    sendAppNotification(
                        '👁️ Eye Break Time!',
                        '20-20-20 Rule: Look at something 20 feet away for 20 seconds to reduce eye strain.'
                    );
                    lastEyeBreakTime.current = now;
                }
            }

            // Skip actual detection if video not ready
            if (!checkVideoReady()) {
                return;
            }

            // Use a monotonically increasing timestamp for MediaPipe
            timestampCounter.current += DETECTION_INTERVAL_MS;

            let result: PoseLandmarkerResult;
            try {
                result = landmarker.detectForVideo(video, timestampCounter.current);
            } catch (e) {
                console.error("[Posture] Detection error:", e);
                return;
            }

            // Process results
            if (result.landmarks && result.landmarks.length > 0) {
                const landmarks = result.landmarks[0];
                // MediaPipe Pose Landmarks: 0=Nose, 11=Left Shoulder, 12=Right Shoulder
                const nose = landmarks[0];
                const leftShoulder = landmarks[11];
                const rightShoulder = landmarks[12];

                if (nose && leftShoulder && rightShoulder) {
                    setHaveLandmarks(true);

                    // Calculate geometric metrics (zoom-invariant)
                    const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
                    const verticalDist = shoulderMidY - nose.y;

                    // Shoulder width for normalization
                    const dx = leftShoulder.x - rightShoulder.x;
                    const dy = leftShoulder.y - rightShoulder.y;
                    const shoulderWidth = Math.sqrt(dx * dx + dy * dy);

                    // Slouch ratio: higher = more upright, lower = slouching
                    const currentRatio = shoulderWidth > 0.01 ? verticalDist / shoulderWidth : 0;

                    setCurrentHeight(currentRatio);

                    // Check slouching (only when monitoring and not paused)
                    if (store.isMonitoring && !store.isPaused && store.baselineHeight !== null) {
                        const threshold = store.baselineHeight * store.sensitivity;
                        const isSlouch = currentRatio < threshold;

                        // Update last known state for background tracking
                        lastKnownSlouching.current = isSlouch;

                        if (isSlouch) {
                            // Currently slouching
                            if (slouchStartTime.current === null) {
                                slouchStartTime.current = now;
                            }
                            setIsSlouching(true);

                            // Check if we should send notification
                            const elapsed = now - slouchStartTime.current;
                            if (elapsed > SLOUCH_TIME_THRESHOLD_MS) {
                                const timeSinceLastNotif = now - lastNotificationTime.current;
                                if (timeSinceLastNotif > COOLDOWN_MS || lastNotificationTime.current === 0) {
                                    sendAppNotification('Slouch Ghost', '👻 You are slouching! Sit up straight.');
                                    lastNotificationTime.current = now;
                                }
                            }
                        } else {
                            // Not slouching - reset timer and allow new notification on next slouch
                            slouchStartTime.current = null;
                            lastNotificationTime.current = 0; // Reset cooldown when posture is fixed
                            setSlouchTimer(0);
                            setIsSlouching(false);
                        }
                    } else {
                        // Not monitoring - reset slouch state
                        lastKnownSlouching.current = false;
                        slouchStartTime.current = null;
                        setSlouchTimer(0);
                        setIsSlouching(false);
                    }
                } else {
                    setHaveLandmarks(false);
                }
            } else {
                setHaveLandmarks(false);
                setCurrentHeight(null);
            }
        };

        // Start detection loop with setInterval (continues in background)
        console.log("[Posture] Starting detection loop");
        timestampCounter.current = 0;
        lastUpdateTime.current = Date.now();
        lastEyeBreakTime.current = Date.now(); // Initialize so first reminder is 20 min after start
        intervalId.current = setInterval(runDetection, DETECTION_INTERVAL_MS);

        return () => {
            console.log("[Posture] Stopping detection loop");
            if (intervalId.current) {
                clearInterval(intervalId.current);
                intervalId.current = null;
            }
        };
    }, [landmarker, stream, videoRef]);

    // Reset state when monitoring stops
    useEffect(() => {
        if (!isMonitoring) {
            lastKnownSlouching.current = false;
            slouchStartTime.current = null;
            lastUpdateTime.current = 0;
            lastEyeBreakTime.current = 0;
            setSlouchTimer(0);
            setIsSlouching(false);
        }
    }, [isMonitoring]);

    return { currentHeight, isSlouching, slouchTimer, haveLandmarks };
}
