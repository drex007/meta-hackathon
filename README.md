# Canvas Atelier

Canvas Atelier is a browser-based oil-painting studio built with TypeScript and Meta's Immersive Web SDK (IWSDK). It supports a hands-first immersive session on Meta Quest and a complete mouse-based desktop fallback using the same painting engine.

## Run it

Use Node.js 20.19, 22.12+, or 24+, then:

```sh
pnpm install
pnpm dev
```

The IWSDK development command opens IWER, IWSDK's browser-based XR emulator. XR means the immersive session in which the canvas, palette, brush, and controls occupy the 3D studio. IWER lets you develop without a headset; it is not a substitute for final Quest testing. See [Testing Your Experience](https://iwsdk.dev/guides/02-testing-experience.html).

Quest Browser requires a secure HTTPS origin except for local development. Open one of the network URLs printed by `npx @iwsdk/cli dev status`, accept the local development certificate warning, then enter the studio.

## Controls

Desktop:

- Drag on the canvas to paint.
- Select a pigment, brush size, Round/Flat/Fan profile, wetness, stabilization, or dry-brush mode from the left panel.
- Import a local reference, adjust trace opacity, or turn the photo into a clean pencil-style sketch with no numbered cells.
- Undo and redo at completed-stroke boundaries.
- Save an editable project to IndexedDB, reopen it from the local gallery, or export a clean 900 x 675 PNG.

Immersive mode:

- Pinch or squeeze the Round, Flat, or Fan brush in the physical brush cup; picking one automatically selects its matching stroke profile.
- Touch its bristles to a pigment or the center of the physical palette to load and mix colour.
- Touch the bristles to the canvas to paint. Pointing a ray at the canvas does not paint.
- Press the spatial panel with a hand or target ray for brush, history, trace, save, and export controls.
- Use IWSDK locomotion microgestures or the emulator's browser movement controls to move around the deck.

## What is implemented

- Continuous contact-only strokes with canvas-local coordinate mapping.
- Three visibly distinct, independently grabbable Round, Flat, and Fan brushes, with matching footprints, physical-width sizing, adjustable stabilization, sparse dry-brush smearing, wet blending, paint-load depletion, and a height/bump texture for raised strokes.
- Pressure approximated from bounded brush-tip penetration. Quest controllers do not measure physical bristle force, so this is intentionally an approximation.
- A stationary physical palette with RYB-style pigment approximation, persistent colour dabs, mixing, brush cleaning, and a resettable mixing area.
- Feature-detected XR entry plus a usable desktop mode.
- Bounded eight-checkpoint undo/redo history rather than unbounded texture snapshots.
- Versioned IndexedDB projects, debounced autosave, visible storage failures, gallery thumbnails, editable reopen, legacy-save migration, and clean PNG export.
- Local reference import, separate opacity-controlled tracing, and an original two-step guided exercise. Reference overlays are excluded from exported artwork.
- A 3D alpine studio, physical easel and palette cart, warm lighting, locomotion, and a spatial control panel.
- A lightweight frame-time/workload readout.

Pigment mixing, wet paint, dry-brush redistribution, pressure, and impasto are performance-focused visual approximations rather than a fluid or spectral paint simulation.

## Architecture

- `oil-paint-engine.ts`: input-independent stroke rendering and paint appearance.
- `canvas-contact.ts`: allocation-free canvas-local contact-to-texture mapping.
- `palette-paint-engine.ts`: physical palette dabs and mixing state.
- `paint-history.ts`: bounded stroke-level undo/redo.
- `paint-project-store.ts`: versioned IndexedDB persistence.
- `sketch-filter.ts`: local grayscale contour extraction for paintable pencil sketches.
- `paint-studio-overlay.ts`: desktop input, reference tools, gallery, autosave, and export.
- `paint-studio-system.ts`: ECS (entity-component system) integration. ECS is IWSDK's way of attaching data and behavior to scene entities; this system connects brush contact and spatial UI to the shared engines.

The controller target-ray pose is the line used to point at spatial buttons. The grip pose is the tracked hand/controller transform used to hold the physical brush. Painting uses the brush/grip path, not the target ray. See [Built-in Interactions](https://iwsdk.dev/guides/06-built-in-interactions.html).

## Verify

```sh
pnpm typecheck
pnpm test
pnpm build
```

Automated checks cover contact mapping, bounded undo/redo behavior, colour tools, and project-version validation.

Physical Quest checklist still required before claiming device validation:

- seated and standing reach to the brush, palette, canvas edges, and spatial controls;
- left/right hand comfort and controller alignment;
- contact haptic strength and support;
- tracking-loss stroke separation;
- easel-edge behavior after locomotion;
- measured 72 Hz frame timing during long strokes, saves, and gallery reopen;
- suspend/resume and storage-quota failure behavior.

## Deliberate backlog

Layers, multiplayer, collaborative undo ownership, mixed-reality placement, framed 3D export, additional environments, and online media are not presented as working features. They come after the single-user painting loop passes physical-headset validation.
