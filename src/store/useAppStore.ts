import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Point { x: number; y: number; }

interface SessionStats {
    totalTime: number;      // Total monitoring time in ms
    goodPostureTime: number; // Time with good posture in ms
    slouchTime: number;      // Time slouching in ms
    sessionStart: number;    // Timestamp when session started
}

interface AppState {
    isMonitoring: boolean;
    isPaused: boolean;
    sensitivity: number;
    timerDuration: number;
    baselineHeight: number | null;
    calibrationSnapshot: string | null;
    manualPoints: {
        nose: Point;
        leftShoulder: Point;
        rightShoulder: Point;
    };

    // Session tracking
    sessionStats: SessionStats | null;
    lastSessionStats: SessionStats | null; // Stats from ended session (for summary)
    showSessionSummary: boolean;

    setCalibrationSnapshot: (dataUrl: string | null) => void;
    setManualPoint: (key: 'nose' | 'leftShoulder' | 'rightShoulder', pt: Point) => void;
    setMonitoring: (monitor: boolean) => void;
    setPaused: (paused: boolean) => void;
    setSensitivity: (val: number) => void;
    setTimerDuration: (val: number) => void;
    setBaseline: (height: number) => void;
    endSession: () => void;

    // Session stats actions
    updateSessionStats: (goodPostureDelta: number, slouchDelta: number) => void;
    dismissSummary: () => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            isMonitoring: false,
            isPaused: false,
            sensitivity: 0.85,
            timerDuration: 5,
            baselineHeight: null,
            calibrationSnapshot: null,
            manualPoints: {
                nose: { x: 0.5, y: 0.3 },
                leftShoulder: { x: 0.4, y: 0.6 },
                rightShoulder: { x: 0.6, y: 0.6 }
            },

            // Session tracking
            sessionStats: null,
            lastSessionStats: null,
            showSessionSummary: false,

            setCalibrationSnapshot: (val) => set({ calibrationSnapshot: val }),
            setManualPoint: (key, pt) => set(state => ({
                manualPoints: { ...state.manualPoints, [key]: pt }
            })),
            setMonitoring: (monitor) => {
                if (monitor) {
                    // Starting a new session
                    set({
                        isMonitoring: true,
                        isPaused: false,
                        sessionStats: {
                            totalTime: 0,
                            goodPostureTime: 0,
                            slouchTime: 0,
                            sessionStart: Date.now()
                        },
                        showSessionSummary: false
                    });
                } else {
                    set({ isMonitoring: false, isPaused: false });
                }
            },
            setPaused: (paused) => set({ isPaused: paused }),
            setSensitivity: (val) => set({ sensitivity: val }),
            setTimerDuration: (val) => set({ timerDuration: val }),
            setBaseline: (val) => set({ baselineHeight: val }),

            endSession: () => {
                const { sessionStats } = get();
                set({
                    baselineHeight: null,
                    isMonitoring: false,
                    isPaused: false,
                    calibrationSnapshot: null,
                    lastSessionStats: sessionStats,
                    sessionStats: null,
                    showSessionSummary: sessionStats !== null && sessionStats.totalTime > 1000
                });
            },

            updateSessionStats: (goodPostureDelta: number, slouchDelta: number) => {
                const { sessionStats } = get();
                if (!sessionStats) return;

                set({
                    sessionStats: {
                        ...sessionStats,
                        totalTime: sessionStats.totalTime + goodPostureDelta + slouchDelta,
                        goodPostureTime: sessionStats.goodPostureTime + goodPostureDelta,
                        slouchTime: sessionStats.slouchTime + slouchDelta
                    }
                });
            },

            dismissSummary: () => set({ showSessionSummary: false })
        }),
        {
            name: 'slouch-ghost-storage',
            partialize: (state) => ({
                // Only persist these fields
                sensitivity: state.sensitivity,
                timerDuration: state.timerDuration,
                manualPoints: state.manualPoints
            })
        }
    )
);
