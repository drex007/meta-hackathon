# Time Moves When You Move

A seated, hands-first WebXR shooter for Meta Quest. Enemies, enemy bullets, wave timers, and hostile effects advance with the player's movement speed. When the player becomes still, the world approaches a six-percent near-freeze; the camera, hands, aiming, UI, and player shots always remain in real time.

## Stack

- Immersive Web SDK 1.1 and its browser-based XR emulator (IWER)
- TypeScript and Vite
- Procedural low-poly geometry from IWSDK's shared Three.js runtime
- Client-side gameplay only: no database, backend, or external gameplay API

## Current milestone

The repository has been fully repurposed from the earlier architecture prototype. The first playable foundation includes:

- the specified speed-to-time-scale function with attack/release smoothing;
- EMA-filtered wrist and head movement measurement;
- a keyboard movement fallback for desktop development;
- a `?debug` tuning panel for all time parameters and live telemetry;
- tested pinch hysteresis mathematics;
- a low-poly seated arena and time-scaled test drone; and
- IWSDK hand tracking and Quest 3 emulation configuration.

## Develop

Use a supported Node.js release (20.19, 22.12+, or 24+), then:

```sh
npm install
npm run dev
```

Append `?debug` to the local URL to expose the tuning lab. Outside XR, hold `Space` or `M` to simulate movement and watch the drone and time gauge accelerate.

## Verify

```sh
npm test
npm run typecheck
npm run build
```

## Build order

1. Tune wrist/head tracking and the time-scale feel in IWER and on Quest.
2. Add the hand aim ray, pinch-to-fire, player bullets, and one Drone fight.
3. Add Turret and Swarmer behavior, pooled enemy bullets, health, and four waves.
4. Add hands-only spatial menus, HUD, scoring, feedback, and audio.
5. Profile for 72 fps, test repeated runs, deploy over HTTPS, and record the demo.
