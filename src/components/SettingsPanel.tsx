import { useAppStore } from '../store/useAppStore';

export function SettingsPanel() {
    const { sensitivity, setSensitivity } = useAppStore();

    return (
        <div className="ghost-glass rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium tracking-[0.15em] uppercase text-white/50">
                    Sensitivity
                </span>
                <span className="text-sm font-mono text-indigo-400">
                    {Math.round(sensitivity * 100)}%
                </span>
            </div>

            <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={sensitivity}
                onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                className="w-full cursor-pointer"
            />

            <div className="flex justify-between text-xs tracking-wider uppercase text-white/30">
                <span>Strict</span>
                <span>Relaxed</span>
            </div>
        </div>
    );
}
