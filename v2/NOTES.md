# Development Notes

## Decisions Log

### TypeScript strict mode
Using strict mode from the start. The ECS pattern is prone to "stringly typed" component access bugs — TypeScript's generics + a component type map will catch these at compile time.

### Vitest + Vite
- Vitest: Fast, ESM-native, TypeScript-native, no config ceremony
- Vite: Dev server with HMR, builds to single file if needed
- Both understand the same config — no duplicate setup

### Debug graphics first
All renderers start as procedural Canvas2D (colored rectangles, simple shapes). The `drawable` component stores enough data that swapping to sprites later is a renderer-only change. No entity or system modifications needed.

### church.js dissolution
v1's church.js (893 lines) is a god object. In v2 it doesn't exist. Its responsibilities are split:
- Level layout constants -> `src/data/ChurchLayout.ts`
- Entity spawning -> `src/data/LevelGenerator.ts`
- Draw functions -> individual renderer modules in `src/rendering/renderers/`
- Corruption state -> corruption component on a singleton entity
- Pew/statue/window state -> individual entity components

## Open Questions
- Library choice for rendering upgrade (Phase 6): PixiJS vs raw WebGL vs Canvas2D with sprite sheets?
- Audio: preserve v1's Web Audio architecture as-is, or consider Tone.js / Howler.js?
