import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';
import { Check, Camera, RefreshCw } from 'lucide-react';
import { ManualPointDragger } from './ManualPointDragger';

interface CalibrationPanelProps {
    videoRef?: React.RefObject<HTMLVideoElement | null>;
    className?: string;
}

export function CalibrationPanel({ videoRef, className }: CalibrationPanelProps) {
    const {
        setBaseline,
        calibrationSnapshot,
        setCalibrationSnapshot,
        manualPoints,
        setManualPoint
    } = useAppStore();

    const [justSaved, setJustSaved] = useState(false);

    const handleCapture = () => {
        if (videoRef?.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Draw flipped image to match mirrored preview
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(videoRef.current, 0, 0);
                setCalibrationSnapshot(canvas.toDataURL('image/jpeg', 0.8));
            }
        }
    };

    const handleConfirm = () => {
        // Calculate Geometric Ratio from manual points
        const shoulderMidY = (manualPoints.leftShoulder.y + manualPoints.rightShoulder.y) / 2;
        const verticalDist = shoulderMidY - manualPoints.nose.y;

        const dx = manualPoints.leftShoulder.x - manualPoints.rightShoulder.x;
        const dy = manualPoints.leftShoulder.y - manualPoints.rightShoulder.y;
        const shoulderWidth = Math.sqrt(dx * dx + dy * dy);

        // Normalized Neck-to-Shoulder Ratio
        const ratio = shoulderWidth > 0 ? verticalDist / shoulderWidth : 0;

        setBaseline(ratio);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
    };

    return (
        <div className={cn("flex flex-col gap-6", className)}>
            {!calibrationSnapshot ? (
                <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-lg font-bold text-white/90">Ghost Setup</h2>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest leading-relaxed">
                            Sit naturally and comfortably
                        </p>
                    </div>

                    <button
                        onClick={handleCapture}
                        className="h-14 w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-indigo-500/30 group"
                    >
                        <Camera className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        Snap Setup Photo
                    </button>
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between items-center">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-lg font-bold text-white/90">Mark Landmarks</h2>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest">Help the Ghost find you</p>
                        </div>
                    </div>

                    <ManualPointDragger
                        snapshot={calibrationSnapshot}
                        points={manualPoints}
                        onChange={setManualPoint}
                    />

                    <div className="flex gap-3">
                        <button
                            onClick={() => setCalibrationSnapshot(null)}
                            className="flex-1 h-12 bg-white/5 hover:bg-white/10 text-white/60 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 border border-white/5"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reset
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="flex-[2] h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
                        >
                            {justSaved ? (
                                <>
                                    <Check className="w-5 h-5" />
                                    Calibrated!
                                </>
                            ) : (
                                "Confirm Points"
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
