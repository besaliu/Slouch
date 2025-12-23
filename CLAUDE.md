# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Slouch Ghost is a Tauri v2 desktop app that monitors posture using webcam-based pose detection. It alerts users when they slouch for too long via system notifications.

## Development Commands

```bash
# Start development (runs both Vite frontend and Tauri backend)
npm run tauri dev

# Build production app
npm run tauri build

# Frontend only (for UI development without Tauri)
npm run dev
```

## Architecture

### Frontend (React + TypeScript)
- **State Management**: Zustand store at `src/store/useAppStore.ts` with persistence to localStorage
- **Pose Detection**: MediaPipe PoseLandmarker loaded from CDN in `src/hooks/useMediaPipe.ts`
- **Posture Logic**: `src/hooks/usePostureLogic.ts` runs pose detection in a `requestAnimationFrame` loop
  - Calculates a "slouch ratio" = vertical distance (shoulders to nose) / shoulder width
  - This ratio is zoom-invariant and compared against a calibrated baseline
  - Triggers notification after 5 seconds of sustained slouching (with 5-minute cooldown)

### Backend (Rust/Tauri)
- **Entry**: `src-tauri/src/lib.rs` configures the app, system tray, and window behavior
- **System Tray**: Menu with "Open Settings", "Recalibrate", and "Quit" options
- **Window Behavior**: Close button hides to tray instead of quitting; transparent, fullscreen, undecorated window

### Key Data Flow
1. `useCamera` hook acquires webcam stream
2. `useMediaPipe` hook loads the PoseLandmarker model
3. `usePostureLogic` runs detection each frame, computing the slouch ratio
4. When ratio drops below `baselineHeight * sensitivity` for >5s, `sendAppNotification` fires
5. Calibration captures a snapshot where user manually marks nose/shoulders to set baseline

### Calibration System
The app supports both automatic detection and manual calibration:
- Automatic: MediaPipe detects landmarks 0 (nose), 11 (left shoulder), 12 (right shoulder)
- Manual: User captures a snapshot and drags points to mark their position
- Both calculate the same geometric ratio for baseline comparison

## Tauri Plugins
- `tauri-plugin-notification` - System notifications
- `tauri-plugin-opener` - Opening external links
- Tray icon feature enabled

## CSP Configuration
The app has a permissive CSP in `src-tauri/tauri.conf.json` to allow:
- MediaPipe WASM from `cdn.jsdelivr.net`
- Pose model from `storage.googleapis.com`
- Camera access via `mediadevices-video:` scheme
