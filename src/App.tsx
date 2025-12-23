import { useEffect, useState } from 'react';
import { useMediaPipe } from './hooks/useMediaPipe';
import { useCamera } from './hooks/useCamera';
import { usePostureLogic } from './hooks/usePostureLogic';
import { ManualPointDragger } from './components/ManualPointDragger';
import { useAppStore } from './store/useAppStore';
import { ensureAudioReady } from './lib/notification';
import { Ghost, X, Camera, RefreshCw, Play, Pause, Square, Check, Trophy, Clock, TrendingUp } from 'lucide-react';
import { cn } from './lib/utils';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

type AppPhase = 'setup' | 'calibrating' | 'ready' | 'monitoring';

function App() {
  const {
    isMonitoring,
    isPaused,
    baselineHeight,
    sensitivity,
    calibrationSnapshot,
    manualPoints,
    showSessionSummary,
    lastSessionStats,
    setMonitoring,
    setPaused,
    endSession,
    setBaseline,
    setCalibrationSnapshot,
    setManualPoint,
    setSensitivity,
    dismissSummary
  } = useAppStore();

  // State for manual sensitivity input
  const [isEditingSensitivity, setIsEditingSensitivity] = useState(false);
  const [sensitivityInput, setSensitivityInput] = useState(String(Math.round(sensitivity * 100)));

  // Handle manual sensitivity input
  const handleSensitivityChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    // Clamp between 50-95%
    const clamped = Math.max(50, Math.min(95, numValue));
    setSensitivityInput(String(clamped));
    setSensitivity(clamped / 100);
  };

  const handleSensitivityBlur = () => {
    setIsEditingSensitivity(false);
  };

  // Format milliseconds to readable time
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const { videoRef, stream, status: cameraStatus } = useCamera();
  const { landmarker, isLoading: isModelLoading, error: modelError, loadingState } = useMediaPipe();

  // @ts-ignore - RefObject mismatch is benign here
  const { currentHeight, isSlouching, slouchTimer } = usePostureLogic(landmarker, videoRef, stream);

  // Determine current phase
  const getPhase = (): AppPhase => {
    if (isMonitoring) return 'monitoring';
    if (baselineHeight) return 'ready';
    if (calibrationSnapshot) return 'calibrating';
    return 'setup';
  };

  const phase = getPhase();

  // Handle Tray events
  useEffect(() => {
    const unlisten = listen('recalibrate-trigger', () => {
      if (currentHeight !== null) {
        setBaseline(currentHeight);
        setMonitoring(true);
      }
    });
    return () => {
      unlisten.then(f => f());
    };
  }, [currentHeight, setBaseline, setMonitoring]);

  const handleClose = async () => {
    await invoke('hide_window');
  };

  const handleCapture = () => {
    if (videoRef?.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0);
        setCalibrationSnapshot(canvas.toDataURL('image/jpeg', 0.8));
      }
    }
  };

  const handleConfirmCalibration = () => {
    const shoulderMidY = (manualPoints.leftShoulder.y + manualPoints.rightShoulder.y) / 2;
    const verticalDist = shoulderMidY - manualPoints.nose.y;
    const dx = manualPoints.leftShoulder.x - manualPoints.rightShoulder.x;
    const dy = manualPoints.leftShoulder.y - manualPoints.rightShoulder.y;
    const shoulderWidth = Math.sqrt(dx * dx + dy * dy);
    const ratio = shoulderWidth > 0 ? verticalDist / shoulderWidth : 0;
    setBaseline(ratio);
  };

  const handleReset = () => {
    setCalibrationSnapshot(null);
  };

  const handleStartSession = async () => {
    // Unlock audio context with user interaction
    await ensureAudioReady();
    setMonitoring(true);
  };

  const handleRecalibrate = () => {
    endSession();
  };

  return (
    <div className="h-screen text-white select-none font-sans flex flex-col overflow-hidden">
      {/* Compact Header with Settings */}
      <header className="drag-handle flex items-center justify-between px-5 py-3 shrink-0">
        <div className="flex items-center gap-3 no-drag">
          <div className={cn(
            "p-1.5 rounded-lg transition-all duration-500",
            phase === 'monitoring' && !isPaused
              ? "bg-emerald-500/15 animate-spectral-breathe"
              : "bg-white/10"
          )}>
            <Ghost className={cn(
              "w-3.5 h-3.5 transition-colors duration-500",
              phase === 'monitoring' && !isPaused ? "text-emerald-400" : "text-white/70"
            )} />
          </div>
          <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/70">
            Slouch Ghost
          </span>
        </div>

        {/* Close Button */}
        <div className="flex items-center no-drag">
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-white/50 hover:text-white/80"
            title="Hide to Tray"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content - Horizontal Layout */}
      <main className="flex-1 flex flex-row gap-5 px-5 pb-5 overflow-hidden">

        {/* Left Sidebar - Sensitivity & Tips */}
        <div className="flex flex-col gap-5 w-80 shrink-0">

          {/* Sensitivity Slider - Large */}
          <div className="ghost-glass rounded-2xl p-6 space-y-4 animate-fade-in-up">
            <div className="space-y-2">
              <label className="text-base font-bold text-white/90 uppercase tracking-widest">
                Sensitivity
              </label>
              <p className="text-xs text-white/50">
                Adjust how strict slouch detection is (50-95%)
              </p>
            </div>
            <div className="space-y-4">
              <input
                type="range"
                min="50"
                max="95"
                step="1"
                value={Math.round(sensitivity * 100)}
                onChange={(e) => setSensitivity(parseInt(e.target.value) / 100)}
                className="w-full h-3 cursor-pointer"
              />
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-all duration-300">
                <span className="text-sm text-white/70">Current Value</span>
                {isEditingSensitivity ? (
                  <input
                    type="number"
                    min="50"
                    max="95"
                    value={sensitivityInput}
                    onChange={(e) => handleSensitivityChange(e.target.value)}
                    onBlur={handleSensitivityBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSensitivityBlur();
                    }}
                    autoFocus
                    className="w-16 bg-indigo-500/20 border border-indigo-400/50 rounded px-2 py-1 text-right text-lg font-mono font-bold text-indigo-400 focus:outline-none focus:border-indigo-400"
                  />
                ) : (
                  <button
                    onClick={() => {
                      setIsEditingSensitivity(true);
                      setSensitivityInput(String(Math.round(sensitivity * 100)));
                    }}
                    className="text-xl font-mono font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors duration-200 px-3 py-1 rounded hover:bg-indigo-500/10"
                    title="Click to manually enter sensitivity"
                  >
                    {Math.round(sensitivity * 100)}%
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Calibration Guidelines */}
          {phase === 'calibrating' && (
            <div className="ghost-glass rounded-2xl p-6 space-y-4 animate-fade-in-up">
              <div className="space-y-2">
                <div className="inline-flex px-3 py-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Step {calibrationSnapshot ? (manualPoints.nose.x === 0.5 ? 1 : manualPoints.leftShoulder.x === 0.4 ? 2 : 3) : 0}/3
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white/90">Mark Your Landmarks</h3>
              </div>
              <div className="space-y-2 text-xs text-white/60">
                <p className="flex items-start gap-2">
                  <span className="text-indigo-400 font-bold mt-0.5">1.</span>
                  <span>Click on your head/nose</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-indigo-400 font-bold mt-0.5">2.</span>
                  <span>Click on your left shoulder</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-indigo-400 font-bold mt-0.5">3.</span>
                  <span>Click on your right shoulder</span>
                </p>
                <p className="flex items-start gap-2 pt-2 border-t border-white/10">
                  <span className="text-emerald-400 font-bold mt-0.5">→</span>
                  <span>Drag any point to adjust after marking all three</span>
                </p>
              </div>
            </div>
          )}

          {/* Preview Mode Tips - Ready or Paused */}
          {(phase === 'ready' || (phase === 'monitoring' && isPaused)) && (
            <div className="ghost-glass rounded-2xl p-6 space-y-4 animate-fade-in-up">
              <div className="space-y-2">
                <div className="inline-flex px-3 py-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Preview Mode
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white/90">Fine-Tune Your Settings</h3>
                <p className="text-xs text-white/50">Test different postures to find the right sensitivity</p>
              </div>
              <div className="space-y-3 text-xs text-white/60">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-emerald-400 font-bold text-lg">✓</span>
                  <div>
                    <p className="font-bold text-emerald-300">Good Posture</p>
                    <p className="text-white/50">Current stays above Threshold (green)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <span className="text-red-400 font-bold text-lg">!</span>
                  <div>
                    <p className="font-bold text-red-300">Slouching Detected</p>
                    <p className="text-white/50">Current drops below Threshold (red)</p>
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-white/10 space-y-2">
                <p className="text-sm text-white/70 font-medium">
                  💡 How to test:
                </p>
                <ul className="text-xs text-white/50 space-y-1.5">
                  <li>• Sit up straight — Current should be <span className="text-emerald-400 font-medium">green</span></li>
                  <li>• Slouch forward — Current should turn <span className="text-red-400 font-medium">red</span></li>
                  <li>• Adjust slider until slouching triggers red</li>
                </ul>
              </div>
            </div>
          )}

          {/* Active Monitoring Tips */}
          {phase === 'monitoring' && !isPaused && (
            <div className="ghost-glass rounded-2xl p-6 space-y-4 animate-fade-in-up">
              <div className="space-y-2">
                <div className="inline-flex px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    Active Monitoring
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white/90">Session In Progress</h3>
              </div>
              <div className="space-y-2 text-xs text-white/50">
                <p>• Keep your Current ratio above the Threshold</p>
                <p>• Slouching for 5+ seconds triggers an alert</p>
                <p>• Use the slider anytime to adjust sensitivity</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Side - Camera Display */}
        <div className="flex-1 flex flex-col">

          {/* Large Camera Display */}
          <div className={cn(
            "relative rounded-3xl overflow-hidden transition-all duration-700 flex-1",
            "ghost-glass spectral-glow",
            isSlouching && phase === 'monitoring' && !isPaused && "warning-glow"
          )}>
            {/* Video Feed - Hidden during calibration */}
            <div className={cn(
              "aspect-video bg-black/60 relative",
              phase === 'calibrating' && "hidden"
            )}>
              <video
                ref={videoRef}
                className={cn(
                  "w-full h-full object-contain mirror-mode",
                  cameraStatus !== 'active' && 'hidden'
                )}
                muted
                playsInline
              />

              {/* Camera Loading State */}
              {cameraStatus === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4 text-white/30">
                    <Camera className="w-12 h-12 animate-pulse" />
                    <span className="text-sm tracking-widest uppercase">Connecting...</span>
                  </div>
                </div>
              )}

              {/* Slouch Warning Overlay */}
              {isSlouching && phase === 'monitoring' && !isPaused && (
                <div className="absolute inset-0 bg-red-500/5 pointer-events-none animate-pulse" />
              )}
            </div>

            {/* Calibration Snapshot - Replaces video */}
            {phase === 'calibrating' && calibrationSnapshot && (
              <div className="aspect-video relative bg-black/60">
                <ManualPointDragger
                  snapshot={calibrationSnapshot}
                  points={manualPoints}
                  onChange={setManualPoint}
                />
              </div>
            )}

            {/* Status Indicator */}
            <div className="absolute top-4 left-4 z-30">
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-full text-[10px] font-medium tracking-widest uppercase bg-black/50 backdrop-blur-md border border-white/5">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  phase === 'monitoring' && !isPaused && "bg-emerald-400 animate-pulse",
                  phase === 'monitoring' && isPaused && "bg-amber-400",
                  phase === 'ready' && "bg-indigo-400",
                  phase === 'calibrating' && "bg-white/40",
                  phase === 'setup' && "bg-white/20"
                )} />
                <span className="text-white/70">
                  {phase === 'monitoring' && !isPaused && 'Watching'}
                  {phase === 'monitoring' && isPaused && 'Paused'}
                  {phase === 'ready' && 'Ready'}
                  {phase === 'calibrating' && 'Calibrating'}
                  {phase === 'setup' && 'Setup'}
                </span>
              </div>
            </div>

            {/* Slouch Alert Badge */}
            {isSlouching && phase === 'monitoring' && !isPaused && (
              <div className="absolute top-4 right-4 z-30">
                <div className="bg-red-500/90 backdrop-blur-md px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest text-white animate-bounce shadow-lg">
                  Fix Posture
                </div>
              </div>
            )}

            {/* Stats overlay - show during ready, paused, or active monitoring */}
            {(phase === 'ready' || phase === 'monitoring') && baselineHeight && (
              <div className="absolute bottom-4 left-4 z-30">
                <div className="flex flex-col gap-2">
                  {/* Preview mode indicator */}
                  {(phase === 'ready' || isPaused) && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 w-fit">
                      <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                      <span className="text-[10px] text-indigo-300 font-medium uppercase tracking-wider">
                        Preview Mode — Adjust sensitivity above
                      </span>
                    </div>
                  )}

                  {/* Stats panel */}
                  <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl text-[11px] bg-black/60 backdrop-blur-md border border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="text-white/50">Current</span>
                      <span className={cn(
                        "font-mono font-bold text-sm",
                        currentHeight !== null && currentHeight < (baselineHeight * sensitivity)
                          ? "text-red-400"
                          : "text-emerald-400"
                      )}>
                        {currentHeight?.toFixed(2) || '—'}
                      </span>
                    </div>
                    <div className="text-white/30">|</div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/50">Threshold</span>
                      <span className="font-mono font-bold text-sm text-indigo-400">
                        {(baselineHeight * sensitivity).toFixed(2)}
                      </span>
                    </div>
                    {phase === 'monitoring' && !isPaused && (
                      <>
                        <div className="text-white/30">|</div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/50">Slouch</span>
                          <span className={cn(
                            "font-mono font-bold text-sm",
                            slouchTimer > 0 ? "text-red-400" : "text-white/40"
                          )}>
                            {(slouchTimer / 1000).toFixed(1)}s
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Bottom Action Panel */}
      <div className="px-5 pb-5 shrink-0 animate-fade-in-up">
        <div className="ghost-glass rounded-2xl p-4">

          {/* Setup Phase - Snap Photo */}
          {phase === 'setup' && (
            <div className="flex items-center gap-4">
              <p className="text-xs text-white/50 tracking-widest uppercase flex-1">
                Sit comfortably with good posture
              </p>
              <button
                onClick={handleCapture}
                disabled={cameraStatus !== 'active'}
                className="ghost-btn-solid h-12 px-6 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-30"
              >
                <Camera className="w-4 h-4" />
                Capture
              </button>
            </div>
          )}

          {/* Calibrating Phase - Mark Points */}
          {phase === 'calibrating' && (
            <div className="flex items-center gap-4">
              <p className="text-xs text-white/50 tracking-widest uppercase flex-1">
                Mark your head and shoulders
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="ghost-btn h-12 px-5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 text-white/70"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retake
                </button>
                <button
                  onClick={handleConfirmCalibration}
                  className="ghost-btn-solid h-12 px-6 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Confirm
                </button>
              </div>
            </div>
          )}

          {/* Ready Phase - Start Monitoring */}
          {phase === 'ready' && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <span className="text-xs text-white/60 tracking-widest uppercase">
                  Calibrated
                </span>
                <button
                  onClick={handleRecalibrate}
                  className="text-[10px] text-white/30 hover:text-white/50 tracking-widest uppercase ml-2 transition-colors"
                >
                  Reset
                </button>
              </div>
              <button
                onClick={handleStartSession}
                className="ghost-btn-solid h-12 px-6 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                Start Watching
              </button>
            </div>
          )}

          {/* Monitoring Phase - Controls */}
          {phase === 'monitoring' && (
            <div className="flex items-center gap-4">
              <div className="flex-1" />
              <div className="flex gap-2">
                <button
                  onClick={() => setPaused(!isPaused)}
                  className={cn(
                    "h-12 px-6 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all",
                    isPaused
                      ? "ghost-btn-solid"
                      : "ghost-btn text-white/70"
                  )}
                >
                  {isPaused ? (
                    <>
                      <Play className="w-4 h-4" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4" />
                      Pause
                    </>
                  )}
                </button>
                <button
                  onClick={endSession}
                  className="px-5 h-12 rounded-xl text-sm font-medium flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                >
                  <Square className="w-4 h-4" />
                  End
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {(isModelLoading || modelError) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl flex items-center justify-center z-[100]">
          <div className="flex flex-col items-center gap-4 max-w-sm px-6">
            <div className="relative">
              <Ghost className={cn(
                "w-10 h-10",
                modelError ? "text-red-400" : "text-indigo-400 animate-ghost-float"
              )} />
              <div className={cn(
                "absolute inset-0 blur-2xl rounded-full",
                modelError ? "bg-red-500/20" : "bg-indigo-500/20"
              )} />
            </div>
            <div className="flex flex-col items-center gap-3 w-full">
              {modelError ? (
                <>
                  <span className="text-[10px] font-medium tracking-[0.3em] uppercase text-red-400">
                    Model Failed
                  </span>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 w-full">
                    <span className="text-[10px] text-red-300/80 break-words">{modelError}</span>
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="text-[9px] text-white/40 hover:text-white/60 tracking-widest uppercase mt-2"
                  >
                    Retry
                  </button>
                </>
              ) : (
                <>
                  <span className="text-xs font-medium tracking-[0.3em] uppercase text-white/70">
                    {loadingState.step}
                  </span>
                  <div className="h-1.5 w-40 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${loadingState.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-white/40 font-mono">
                    {loadingState.progress}%
                  </span>
                  {loadingState.details && (
                    <span className="text-[10px] text-white/30 font-mono mt-1 max-w-xs text-center break-all">
                      {loadingState.details}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Session Summary Modal */}
      {showSessionSummary && lastSessionStats && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[100] animate-fade-in-up">
          <div className="ghost-glass-strong rounded-3xl p-8 max-w-md w-full mx-6 space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-indigo-500/20 mb-2">
                <Trophy className="w-8 h-8 text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Session Complete</h2>
              <p className="text-xs text-white/50 uppercase tracking-widest">Here's how you did</p>
            </div>

            {/* Stats */}
            <div className="space-y-4">
              {/* Good Posture Percentage */}
              <div className="ghost-glass rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-white/70">Good Posture</span>
                  </div>
                  <span className="text-2xl font-bold text-emerald-400">
                    {lastSessionStats.totalTime > 0
                      ? Math.round((lastSessionStats.goodPostureTime / lastSessionStats.totalTime) * 100)
                      : 0}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${lastSessionStats.totalTime > 0
                        ? (lastSessionStats.goodPostureTime / lastSessionStats.totalTime) * 100
                        : 0}%`
                    }}
                  />
                </div>
              </div>

              {/* Time Breakdown */}
              <div className="grid grid-cols-3 gap-3">
                <div className="ghost-glass rounded-xl p-3 text-center">
                  <Clock className="w-4 h-4 text-white/40 mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{formatTime(lastSessionStats.totalTime)}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">Total</p>
                </div>
                <div className="ghost-glass rounded-xl p-3 text-center">
                  <div className="w-4 h-4 mx-auto mb-1 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                  <p className="text-lg font-bold text-emerald-400">{formatTime(lastSessionStats.goodPostureTime)}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">Good</p>
                </div>
                <div className="ghost-glass rounded-xl p-3 text-center">
                  <div className="w-4 h-4 mx-auto mb-1 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                  </div>
                  <p className="text-lg font-bold text-red-400">{formatTime(lastSessionStats.slouchTime)}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">Slouch</p>
                </div>
              </div>
            </div>

            {/* Dismiss Button */}
            <button
              onClick={dismissSummary}
              className="ghost-btn-solid w-full h-12 rounded-xl text-sm font-medium"
            >
              Start New Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
