import {
    isPermissionGranted,
    requestPermission,
    sendNotification as tauriSendNotification,
    Options
} from '@tauri-apps/plugin-notification';

// Audio context for playing alert sounds
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new AudioContext();
    }
    return audioContext;
}

// Resume audio context if suspended (required after user interaction)
export async function ensureAudioReady() {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        await ctx.resume();
        console.log("[Audio] Context resumed");
    }
}

// Play a noticeable alert sound - triple chime
export async function playAlertSound() {
    try {
        const ctx = getAudioContext();

        // Resume if suspended
        if (ctx.state === 'suspended') {
            await ctx.resume();
            console.log("[Audio] Context was suspended, now resumed");
        }

        const now = ctx.currentTime;

        // Triple chime - more noticeable
        for (let i = 0; i < 3; i++) {
            const startTime = now + (i * 0.25);

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            // Descending tones: C6 -> A5 -> F5
            const frequencies = [1047, 880, 698];
            osc.frequency.setValueAtTime(frequencies[i], startTime);

            // Envelope
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.6, startTime + 0.02);
            gain.gain.linearRampToValueAtTime(0.4, startTime + 0.1);
            gain.gain.linearRampToValueAtTime(0, startTime + 0.2);

            osc.start(startTime);
            osc.stop(startTime + 0.2);
        }

        console.log("[Alert] ✅ Sound played successfully");
        return true;
    } catch (e) {
        console.error("[Alert] ❌ Failed to play sound:", e);
        return false;
    }
}

export async function sendAppNotification(title: string, body: string) {
    console.log("[Notification] 🔔 Attempting to send:", title, body);

    // Always play the alert sound
    const soundPlayed = await playAlertSound();
    console.log("[Notification] Sound played:", soundPlayed);

    // Try Tauri notification
    try {
        console.log("[Notification] Checking Tauri permission...");
        let permissionGranted = await isPermissionGranted();
        console.log("[Notification] Permission granted:", permissionGranted);

        if (!permissionGranted) {
            console.log("[Notification] Requesting permission...");
            const permission = await requestPermission();
            console.log("[Notification] Permission response:", permission);
            permissionGranted = permission === 'granted';
        }

        if (permissionGranted) {
            // Create ghost icon as data URL
            const ghostIconSvg = '<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ghostGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#818cf8;stop-opacity:1" /><stop offset="100%" style="stop-color:#6366f1;stop-opacity:1" /></linearGradient></defs><path d="M 256 60 C 180 60 120 120 120 200 L 120 350 C 120 420 180 480 256 480 C 332 480 392 420 392 350 L 392 200 C 392 120 332 60 256 60 Z" fill="url(#ghostGradient)" stroke="#4f46e5" stroke-width="8"/><circle cx="160" cy="380" r="35" fill="url(#ghostGradient)" stroke="#4f46e5" stroke-width="6"/><circle cx="220" cy="400" r="38" fill="url(#ghostGradient)" stroke="#4f46e5" stroke-width="6"/><circle cx="290" cy="405" r="40" fill="url(#ghostGradient)" stroke="#4f46e5" stroke-width="6"/><circle cx="355" cy="395" r="38" fill="url(#ghostGradient)" stroke="#4f46e5" stroke-width="6"/><circle cx="200" cy="200" r="32" fill="white"/><circle cx="200" cy="205" r="20" fill="#1f2937"/><circle cx="205" cy="200" r="10" fill="white"/><circle cx="312" cy="200" r="32" fill="white"/><circle cx="312" cy="205" r="20" fill="#1f2937"/><circle cx="317" cy="200" r="10" fill="white"/><circle cx="256" cy="300" r="28" fill="none" stroke="#1f2937" stroke-width="8"/><ellipse cx="200" cy="150" rx="80" ry="60" fill="white" opacity="0.15"/></svg>';
            const ghostIconDataUrl = `data:image/svg+xml;base64,${btoa(ghostIconSvg)}`;

            const options: Options = {
                title,
                body,
                sound: 'default',
                icon: ghostIconDataUrl
            };
            console.log("[Notification] Sending Tauri notification with ghost icon...");
            await tauriSendNotification(options);
            console.log("[Notification] ✅ Tauri notification sent!");
            return;
        } else {
            console.log("[Notification] ⚠️ Permission not granted");
        }
    } catch (e) {
        console.error("[Notification] ❌ Tauri notification error:", e);
    }

    // Fallback to Web Notification API
    console.log("[Notification] Trying Web Notification fallback...");
    try {
        if ('Notification' in window) {
            console.log("[Notification] Web Notification permission:", Notification.permission);
            // Use ghost icon for web notifications
            const ghostIconSvg = '<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ghostGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#818cf8;stop-opacity:1" /><stop offset="100%" style="stop-color:#6366f1;stop-opacity:1" /></linearGradient></defs><path d="M 256 60 C 180 60 120 120 120 200 L 120 350 C 120 420 180 480 256 480 C 332 480 392 420 392 350 L 392 200 C 392 120 332 60 256 60 Z" fill="url(#ghostGradient)" stroke="#4f46e5" stroke-width="8"/><circle cx="160" cy="380" r="35" fill="url(#ghostGradient)" stroke="#4f46e5" stroke-width="6"/><circle cx="220" cy="400" r="38" fill="url(#ghostGradient)" stroke="#4f46e5" stroke-width="6"/><circle cx="290" cy="405" r="40" fill="url(#ghostGradient)" stroke="#4f46e5" stroke-width="6"/><circle cx="355" cy="395" r="38" fill="url(#ghostGradient)" stroke="#4f46e5" stroke-width="6"/><circle cx="200" cy="200" r="32" fill="white"/><circle cx="200" cy="205" r="20" fill="#1f2937"/><circle cx="205" cy="200" r="10" fill="white"/><circle cx="312" cy="200" r="32" fill="white"/><circle cx="312" cy="205" r="20" fill="#1f2937"/><circle cx="317" cy="200" r="10" fill="white"/><circle cx="256" cy="300" r="28" fill="none" stroke="#1f2937" stroke-width="8"/><ellipse cx="200" cy="150" rx="80" ry="60" fill="white" opacity="0.15"/></svg>';
            const ghostIconDataUrl = `data:image/svg+xml;base64,${btoa(ghostIconSvg)}`;

            if (Notification.permission === 'granted') {
                new Notification(title, { body, requireInteraction: true, icon: ghostIconDataUrl });
                console.log("[Notification] ✅ Web notification sent!");
            } else if (Notification.permission !== 'denied') {
                const permission = await Notification.requestPermission();
                console.log("[Notification] Web permission result:", permission);
                if (permission === 'granted') {
                    new Notification(title, { body, requireInteraction: true, icon: ghostIconDataUrl });
                    console.log("[Notification] ✅ Web notification sent!");
                }
            }
        }
    } catch (e) {
        console.error("[Notification] ❌ Web notification error:", e);
    }
}

// Test function - call from console: testNotification()
(window as any).testNotification = async () => {
    console.log("=== TESTING NOTIFICATION ===");
    await ensureAudioReady();
    await sendAppNotification("Test Notification", "If you see this, notifications work!");
    console.log("=== TEST COMPLETE ===");
};

// Test just the sound
(window as any).testSound = async () => {
    console.log("=== TESTING SOUND ===");
    await ensureAudioReady();
    await playAlertSound();
    console.log("=== TEST COMPLETE ===");
};
