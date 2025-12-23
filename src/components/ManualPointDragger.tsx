import React, { useRef, useState } from 'react';
import { cn } from '../lib/utils';

interface Point { x: number; y: number; }
interface ManualPointDraggerProps {
    snapshot: string;
    points: { nose: Point; leftShoulder: Point; rightShoulder: Point; };
    onChange: (key: 'nose' | 'leftShoulder' | 'rightShoulder', pt: Point) => void;
}

export const ManualPointDragger: React.FC<ManualPointDraggerProps> = ({ snapshot, points, onChange }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [clickStep, setClickStep] = useState(0);
    const [dragging, setDragging] = useState<string | null>(null);

    const getPointFromEvent = (e: React.PointerEvent) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        return { x, y };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        const pt = getPointFromEvent(e);

        if (clickStep === 0) {
            onChange('nose', pt);
            setClickStep(1);
        } else if (clickStep === 1) {
            onChange('leftShoulder', pt);
            setClickStep(2);
        } else if (clickStep === 2) {
            onChange('rightShoulder', pt);
            setClickStep(3);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (dragging && containerRef.current) {
            const pt = getPointFromEvent(e);
            onChange(dragging as any, pt);
        }
    };

    const handleMarkerPointerDown = (e: React.PointerEvent, key: string) => {
        if (clickStep < 3) return;
        e.stopPropagation();
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        setDragging(key);
    };

    const handlePointerUp = () => {
        setDragging(null);
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full cursor-crosshair touch-none select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
        >
            {/* Snapshot Image */}
            <img
                src={snapshot}
                className="w-full h-full object-contain select-none pointer-events-none opacity-80"
                alt="Calibration snapshot"
            />

            {/* Subtle overlay */}
            <div className="absolute inset-0 bg-indigo-500/5 pointer-events-none" />

            {/* Connection Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {/* Vertical line from nose to shoulders midpoint */}
                {clickStep >= 2 && (
                    <line
                        x1={`${points.nose.x * 100}%`}
                        y1={`${points.nose.y * 100}%`}
                        x2={`${((points.leftShoulder.x + (clickStep >= 3 ? points.rightShoulder.x : points.leftShoulder.x)) / 2) * 100}%`}
                        y2={`${((points.leftShoulder.y + (clickStep >= 3 ? points.rightShoulder.y : points.leftShoulder.y)) / 2) * 100}%`}
                        stroke="#818cf8"
                        strokeWidth="2"
                        strokeDasharray="6 4"
                        strokeOpacity="0.7"
                    />
                )}
                {/* Horizontal line between shoulders */}
                {clickStep >= 3 && (
                    <line
                        x1={`${points.leftShoulder.x * 100}%`}
                        y1={`${points.leftShoulder.y * 100}%`}
                        x2={`${points.rightShoulder.x * 100}%`}
                        y2={`${points.rightShoulder.y * 100}%`}
                        stroke="white"
                        strokeWidth="2"
                        strokeOpacity="0.4"
                    />
                )}
            </svg>

            {/* Draggable Markers - Larger for 2x view */}
            {Object.entries(points).map(([key, pt], idx) => {
                const isPlaced = clickStep > idx;
                if (!isPlaced) return null;

                const isHead = key === 'nose';

                return (
                    <div
                        key={key}
                        onPointerDown={(e) => handleMarkerPointerDown(e, key)}
                        onPointerUp={handlePointerUp}
                        className={cn(
                            "absolute w-10 h-10 -ml-5 -mt-5 rounded-full flex items-center justify-center group z-10 transition-all",
                            isHead
                                ? "bg-indigo-500 border-2 border-indigo-300/60"
                                : "bg-white/40 border-2 border-white/50 backdrop-blur-sm",
                            clickStep === 3 ? "cursor-grab active:cursor-grabbing hover:scale-110" : "pointer-events-none"
                        )}
                        style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%`, touchAction: 'none' }}
                    >
                        <div className={cn(
                            "w-2.5 h-2.5 rounded-full",
                            isHead ? "bg-white" : "bg-white"
                        )} />

                        {/* Pulse effect on head marker when done */}
                        {isHead && clickStep === 3 && (
                            <div className="absolute inset-0 rounded-full animate-ping bg-indigo-500/30 -z-10" />
                        )}

                        {/* Tooltip on hover */}
                        <div className="absolute top-12 whitespace-nowrap px-3 py-1 bg-black/70 backdrop-blur-sm rounded-full text-xs font-medium text-white/80 tracking-widest pointer-events-none border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity uppercase">
                            {key === 'nose' ? 'Head' : key.includes('left') ? 'L-Shoulder' : 'R-Shoulder'}
                        </div>
                    </div>
                );
            })}

        </div>
    );
};
