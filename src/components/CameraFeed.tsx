import React from 'react';
import { cn } from '../lib/utils';
import { Camera, CameraOff, AlertCircle } from 'lucide-react';

interface CameraFeedProps {
    className?: string;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    status: 'idle' | 'loading' | 'active' | 'error' | 'denied';
    error: string | null;
    onStreamReady?: (video: HTMLVideoElement) => void;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({
    className,
    videoRef,
    status,
    error,
    onStreamReady
}) => {

    // Notify parent when video is ready
    React.useEffect(() => {
        const video = videoRef.current;
        if (video && status === 'active' && onStreamReady) {
            onStreamReady(video);
        }
    }, [status, onStreamReady, videoRef]);

    return (
        <div className={cn("relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center", className)}>
            <video
                ref={videoRef}
                className={cn("w-full h-full object-cover mirror-mode", status !== 'active' && 'hidden')}
                autoPlay
                muted
                playsInline
            />

            {status === 'loading' && (
                <div className="text-gray-400 flex flex-col items-center gap-2">
                    <Camera className="w-8 h-8 animate-pulse" />
                    <p className="text-sm">Accessing camera...</p>
                </div>
            )}

            {status === 'denied' && (
                <div className="text-red-400 flex flex-col items-center gap-2 p-4 text-center">
                    <CameraOff className="w-8 h-8" />
                    <p className="text-sm font-medium">Camera access denied</p>
                    <p className="text-xs text-red-400/80">Please allow camera access in system settings.</p>
                </div>
            )}

            {status === 'error' && (
                <div className="text-yellow-400 flex flex-col items-center gap-2 p-4 text-center">
                    <AlertCircle className="w-8 h-8" />
                    <p className="text-sm font-medium">Camera error</p>
                    <p className="text-xs text-yellow-400/80">{error}</p>
                </div>
            )}

            <style>{`
        .mirror-mode {
          transform: scaleX(-1);
        }
      `}</style>
        </div>
    );
};
