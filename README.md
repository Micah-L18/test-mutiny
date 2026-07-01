# ☠︎ Mutiny Seas

A **first-person, browser-based 3D social-deduction pirate game** — *Among Us at
sea*. A crew works together to sail between islands, assemble a treasure map from
scattered clues, and dig up the chest… while a hidden **mutineer** quietly
sabotages the ship and picks off the crew.

This repo is a **single-player playable vertical slice**. AI crewmates stand in
for the other players so the whole loop is playable solo right now. Built with
[Three.js](https://threejs.org) (vendored locally — no build step, no runtime
CDN).

> See **[CONCEPT.md](./CONCEPT.md)** for the full game design.

---

## Run it

```bash
# from the repo root
npm start            # serves on http://localhost:8080
# then open http://localhost:8080 in a desktop browser
```

Any static file server works too — e.g. `npx serve .` or
`python3 -m http.server`. A server is required (ES-module imports don't load over
`file://`).

**Best in desktop Chrome / Edge / Firefox.** Click **Set Sail**, then **Begin**
to lock the mouse for look controls.

---

## Controls

| Input | Action |
|-------|--------|
| **W A S D** / arrows | Move |
| **Mouse** | Look |
| **Shift** | Sprint |
| **E** (hold) | Repair / sabotage / dig |
| **Left-click** | Catch a fish (during the crossing) |
| **Esc** | Pause / release mouse |

---

## The round

Your role — **Crewmate** or hidden **Mutineer** — is rolled at the start of
every voyage, so both sides are one refresh apart.

1. **Repair** — fix the 3 glowing ship stations (hull, sail, wheel).
2. **The Crossing** — catch fish over the rail while the island sails in.
3. **Clues** — gather the glowing fragments and carry them to the campfire; the
   pieces combine into a map (and reveal a Mutiny Map warning).
4. **Treasure** — follow the hint east to the three palms and dig up the gold.

The **mutiny meter** (top of screen) is the shared doom clock. **Crew win** by
digging the treasure before it fills; **the mutineer wins** by filling it — via
sabotage, burning clues, and eliminating isolated crewmates — before the crew
subdue them.

As the **mutineer**, only act when no crewmate is watching, or your
**suspicion** meter fills and you're caught.

---

## Project layout

```
index.html          # HUD + overlays + import map
styles.css          # HUD / menu styling
server.js           # zero-dependency static server
src/
  main.js           # bootstrap + menu wiring
  game.js           # scene, phase state machine, roles, AI crew, meters
  world.js          # all 3D geometry (ship, island, ocean, crew, props)
  player.js         # first-person pointer-lock controller
  ui.js             # HUD/overlay DOM wrapper
  audio.js          # synthesized WebAudio SFX (no assets)
vendor/three/       # Three.js r160 + PointerLockControls (vendored)
```

## Notes

- Single-player by design (AI crew) so it runs from a static server with no
  backend. The phase state machine, per-player roles, and proximity interactions
  are structured to extend to real multiplayer + emergency-meeting voting later.
- All art is generated from Three.js primitives and canvas textures — there are
  no external image/audio assets to load.
