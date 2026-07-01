# Mutiny Seas — 3D Web Playable Demo Concept

A first-person, browser-based social-deduction pirate game. Think **Among Us at
sea**: a crew works together to sail between islands, assemble a treasure map
from scattered clues, and dig up the chest — while a hidden **mutineer** quietly
sabotages the ship and picks off the crew.

This repo contains a **single-player playable vertical slice** that you can open
in a browser right now. AI crewmates stand in for the other players so the full
loop is playable solo. Every core system described below is implemented in the
demo.

---

## The Fantasy

You are one of a pirate crew. You start adrift with an island on the horizon.
Repair the ship, sail, survive the crossing, comb the island for clues, piece
together the map, and claim the treasure — **before the mutiny gets out of
hand.**

One clue in every haul is the **Mutiny Map**. Whoever finds it is secretly told:
*the crew is no longer your friend.* Their new goal is to sabotage the ship and
thin the crew before the treasure is found.

---

## Core Loop (one island = one round)

| Phase | Everyone's job | The mutineer's opportunity |
|------|----------------|-----------------------------|
| **1. Repair** | Fix 3 damaged ship stations (hull, sail, wheel) by holding a repair | Re-break repaired stations while nobody's looking; prime the powder keg |
| **2. The Crossing (fishing)** | Line up at the rail and catch fish in first person against a timer | Slip to the stern and sabotage the rudder while the crew is distracted |
| **3. Clues** | Everyone gathers glowing clue fragments and brings them to the campfire | Destroy a clue at the fire — or eliminate an isolated crewmate |
| **4. The Map** | Fragments combine into one map + hint (players see the *result*, not who brought what) | Learn where the treasure is too |
| **5. Treasure** | Follow the hint, find the X, dig up the chest | Fill the mutiny meter to 100% first |

**Crew win:** the treasure is dug before the mutiny meter fills.
**Mutiny win:** the meter hits 100% (sabotage + time), or the crew runs out.
**Crew also win** if the mutineer is caught red-handed (suspicion maxes out).

---

## Two roles, two experiences (both playable in the demo)

- **Crewmate** — race the clock. An AI mutineer is loose and periodically
  sabotages, pushing the mutiny meter up. Work fast and efficiently; the Mutiny
  Map clue will warn you that a traitor is aboard.
- **Mutineer** — you're handed a secret objective at the briefing. Sabotage
  stations, wreck the rudder, torch clues, and eliminate isolated crewmates to
  drive the meter to 100% — **but only act when no crewmate is watching**, or
  your suspicion meter fills and you're thrown overboard.

Your role is rolled at the start of each run, so both sides are one refresh
apart.

---

## Design pillars

1. **Shared goal first, betrayal second.** The round opens cooperative. The
   mutiny is a slow-burning pressure that turns a teamwork puzzle into a
   race.
2. **Information asymmetry without menus.** Clues are physical objects. The map
   only ever shows the *assembled* result — never who contributed what — so the
   traitor can hide a bad clue in plain sight.
3. **Every phase is a distraction the mutineer can exploit.** Fishing pulls
   everyone to one rail; clue-hunting scatters everyone across the island. Good
   sabotage windows are baked into the co-op activities.
4. **Readable pressure.** One mutiny meter, always on screen, is the shared
   doom clock both sides are playing against.

---

## What the demo implements

- Full first-person movement (pointer-lock mouse look + WASD, sprint) on a
  hand-built low-poly ship and island.
- Animated ocean, sailing/approach sequence, day-lit pirate atmosphere.
- All five phases wired into one continuous playable round.
- 3 AI crewmates with per-phase behaviour (repair, line up to fish, gather
  clues, carry them to the fire), one of whom may be the hidden mutineer.
- Role assignment with distinct crew vs. mutineer objectives and UI.
- Hold-to-interact system (repair / sabotage / dig), first-person fishing
  mini-game, clue gathering, map assembly + hint, treasure dig.
- Mutiny meter, mutineer suspicion meter, and lose/win resolution for both
  sides, including the "kill an isolated crewmate" mechanic.

## Multiplayer & scope notes

The demo is deliberately single-player (AI crew) so it runs from a static file
server with no backend. The systems are structured to map cleanly onto real
multiplayer later: authoritative phase state machine, per-player role/objective,
proximity interactions, and an emergency-meeting/voting layer would slot on top
of the existing phase manager.
