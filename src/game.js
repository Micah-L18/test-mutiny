import * as THREE from 'three';
import { PlayerController } from './player.js';
import {
  createSky, createOcean, createShip, createIsland, createBean, makeLabel,
  campfire, clueFragment, marker, treasureChest, createFish,
  ISLAND, islandHeight,
} from './world.js';

const ISLAND_ORIGIN = new THREE.Vector3(0, 0, -46);
const EYE = 1.65;
const DECK_TOP = 2.2;

const CREW_DEFS = [
  { name: 'Becky', color: 0xff5a5a },
  { name: 'Salty', color: 0x4fa3ff },
  { name: 'Bones', color: 0x57d97a },
];

// Tuning knobs
const CFG = {
  repairTimeout: 42,
  crossingTime: 38,
  fishGoal: 5,
  cluesNeeded: 3,
  passiveCrew: 0.20,     // mutiny %/s when player is crew
  passiveMutineer: 0.28, // mutiny %/s when player is mutineer
  aiSaboEvery: 15,       // s between AI-mutineer sabotage bumps (player = crew)
  aiSaboAmount: 9,
  mutineerRound: 112,    // s the mutineer has to hit 100%
  sabotage: { restation: 6, keg: 12, rudder: 28, burn: 11, kill: 30 },
  suspicionOnSeen: 42,
  suspicionDecay: 3.5,
  seenRadius: 7.5,
};

export class Game {
  constructor({ canvas, ui, audio }) {
    this.canvas = canvas;
    this.ui = ui;
    this.audio = audio;
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();

    this.zone = 'ship';
    this.phase = 'BRIEFING';
    this.over = false;

    this.mutiny = 0;
    this.suspicion = 0;
    this.roundTimer = CFG.mutineerRound;

    this.spinners = [];
    this.stations = [];
    this.stationMarkers = [];
    this.fragments = [];
    this.fish = [];
    this.fishMeshes = [];
    this.interactables = [];

    this.carrying = false;
    this.cluesAtFire = 0;
    this.fishCount = 0;
    this.treasureDug = false;

    this._keyE = false;
    this._buildRenderer();
    this._buildScene();
    this._bindInput();
    this._assignRole();

    window.addEventListener('resize', () => this._onResize());
  }

  // ------------------------------------------------------------------ setup
  _buildRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xd7ecf5, 0.0018);

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 1600);
  }

  _buildScene() {
    this.scene.add(createSky());

    const hemi = new THREE.HemisphereLight(0xbfe6ff, 0x6a7f5a, 1.0);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.5);
    sun.position.set(-40, 60, 30);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xa9d6ff, 0.4);
    fill.position.set(30, 20, -40);
    this.scene.add(fill);

    this.ocean = createOcean();
    this.scene.add(this.ocean);

    this.ship = createShip();
    this.scene.add(this.ship);

    this.island = createIsland();
    this.island.position.copy(ISLAND_ORIGIN);
    this.island.position.z = -95; // starts far; sails in during the crossing
    this.scene.add(this.island);

    // campfire lives on the island group so it moves with it
    this.fire = campfire();
    this.fire.position.set(-2, islandHeight(Math.hypot(-2, 3)), 3);
    this.island.add(this.fire);

    // treasure chest, buried (hidden below sand) until dug
    this.chest = treasureChest();
    const tl = this.island.userData.treasureLocal;
    this.chest.position.set(tl.x, islandHeight(Math.hypot(tl.x, tl.z)) - 1.6, tl.z);
    this.chest.visible = false;
    this.island.add(this.chest);

    // crew
    this.crew = CREW_DEFS.map((d) => {
      const group = createBean(d.color, d.name);
      this.scene.add(group);
      return {
        name: d.name, color: d.color, group, alive: true, isMutineer: false,
        target: new THREE.Vector3(), speed: 3.0, work: 0, walk: 0,
        state: 'idle', frag: null,
      };
    });
    this._placeCrewOnDeck();

    // player rig
    this.player = new PlayerController(this.camera, this.canvas);
    this.scene.add(this.player.object);
    this.player.setPosition(0, DECK_TOP + EYE, 4.5);
    this.player.object.rotation.set(0, 0, 0); // look toward -Z (the bow / island)
    this._setZone('ship');
  }

  _bindInput() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') this._keyE = true;
    });
    document.addEventListener('keyup', (e) => {
      if (e.code === 'KeyE') this._keyE = false;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this.player.locked && this.phase === 'CROSSING' && this.playerRole === 'CREW') {
        this._tryCatchFish();
      }
    });
    // pause when pointer unlocks mid-round
    this.player.controls.addEventListener('unlock', () => {
      if (!this.over && this._started && !this._overlayOpen()) this.ui.show('pause');
    });
    this.player.controls.addEventListener('lock', () => this.ui.hide('pause'));
  }

  _overlayOpen() {
    return ['briefing', 'map-overlay', 'end'].some((id) => !document.getElementById(id).classList.contains('hidden'));
  }

  _assignRole() {
    const playerIsMutineer = Math.random() < 0.4;
    this.playerRole = playerIsMutineer ? 'MUTINEER' : 'CREW';
    if (playerIsMutineer) {
      this.mutineerName = 'You';
    } else {
      const idx = Math.floor(Math.random() * this.crew.length);
      this.crew[idx].isMutineer = true;
      this.mutineerName = this.crew[idx].name;
    }
  }

  // ------------------------------------------------------------- lifecycle
  showBriefing() {
    if (this.playerRole === 'MUTINEER') {
      this.ui.showBriefing('MUTINEER',
        'Drive the MUTINY METER to 100% before the crew subdues you. Sabotage stations, wreck the rudder, prime the powder keg, burn clues, and eliminate isolated crewmates — but never while a crewmate is watching.',
        'You have limited time. Act only when no one is close, or your suspicion will give you away.');
    } else {
      this.ui.showBriefing('CREW',
        'Repair the ship, survive the crossing, gather the clues, and DIG UP THE TREASURE — before the mutiny meter fills. A traitor is aboard.',
        'Work fast. Hold [E] to interact. The Mutiny Map among the clues will confirm the betrayal.');
    }
  }

  begin() {
    this._started = true;
    this.ui.hide('briefing');
    this.player.lock();
    this._enterPhase('REPAIR');
    if (!this._looping) { this._looping = true; this._loop(); }
  }

  restart() { window.location.reload(); }

  // ------------------------------------------------------------- zones
  _setZone(zone) {
    this.zone = zone;
    if (zone === 'ship') {
      this.player.resolve = (p) => {
        p.x = THREE.MathUtils.clamp(p.x, -2.9, 2.9);
        p.z = THREE.MathUtils.clamp(p.z, -6.0, 5.6);
        // keep out of the mast footprint
        const dx = p.x - 0, dz = p.z - (-1);
        const d = Math.hypot(dx, dz);
        if (d < 0.85 && d > 0.0001) { const s = 0.85 / d; p.x = dx * s; p.z = -1 + dz * s; }
        p.y = DECK_TOP + EYE;
      };
    } else {
      this.player.resolve = (p) => {
        let dx = p.x - ISLAND_ORIGIN.x, dz = p.z - ISLAND_ORIGIN.z;
        let d = Math.hypot(dx, dz);
        const maxR = ISLAND.radius - 1.4;
        if (d > maxR) { const s = maxR / d; dx *= s; dz *= s; p.x = ISLAND_ORIGIN.x + dx; p.z = ISLAND_ORIGIN.z + dz; d = maxR; }
        p.y = islandHeight(d) + EYE;
      };
    }
  }

  _groundY(x, z) {
    if (this.zone === 'ship') return DECK_TOP;
    return islandHeight(Math.hypot(x - ISLAND_ORIGIN.x, z - ISLAND_ORIGIN.z));
  }

  // ------------------------------------------------------------- crew placement
  _placeCrewOnDeck() {
    const spots = [[-1.8, 2.5], [1.8, -1.5], [-1.4, -4.0]];
    this.crew.forEach((c, i) => {
      c.group.position.set(spots[i][0], DECK_TOP, spots[i][1]);
      c.target.set(spots[i][0], DECK_TOP, spots[i][1]);
      c.group.visible = c.alive;
    });
  }

  _placeCrewOnIsland() {
    this.crew.forEach((c, i) => {
      const a = -0.6 + i * 0.5;
      const x = ISLAND_ORIGIN.x + Math.sin(a) * 8;
      const z = ISLAND_ORIGIN.z + Math.cos(a) * 8;
      c.group.position.set(x, this._groundY(x, z), z);
      c.target.copy(c.group.position);
      c.state = 'toFrag'; c.frag = null; c.work = 0;
      c.group.visible = c.alive;
    });
  }

  // ------------------------------------------------------------- phases
  _enterPhase(name) {
    this.phase = name;
    this._clearInteractables();
    if (name === 'REPAIR') this._enterRepair();
    else if (name === 'CROSSING') this._enterCrossing();
    else if (name === 'ISLAND') this._enterIsland();
    else if (name === 'TREASURE') this._enterTreasure();
    this._refreshObjective();
  }

  _refreshObjective() {
    const crew = this.playerRole === 'CREW';
    const map = {
      REPAIR: crew
        ? ['Repair the ship', 'Hold [E] at each glowing station (0/3).']
        : ['Blend in — and sabotage', 'Re-break repairs & prime the keg when unwatched.'],
      CROSSING: crew
        ? ['Catch fish for the crew', 'Look over the side. Left-click a fish to catch it.']
        : ['Wreck the ship while they fish', 'Sabotage the rudder at the stern. Hold [E].'],
      ISLAND: crew
        ? ['Gather the clues', `Bring glowing fragments to the fire (${this.cluesAtFire}/${CFG.cluesNeeded}).`]
        : ['Stop the crew', 'Burn clues at the fire, or eliminate an isolated crewmate.'],
      TREASURE: crew
        ? ['Dig up the treasure', 'Follow the map to the X and hold [E] to dig.']
        : ['Keep the meter climbing', 'Do not let them reach the treasure.'],
    };
    const [t, d] = map[this.phase] || ['', ''];
    this.ui.setObjective(t, d);
    this.ui.setPhaseTag(this._phaseTag());
  }

  _phaseTag() {
    return { REPAIR: '⚓ Phase 1 · Repair', CROSSING: '🎣 Phase 2 · The Crossing',
      ISLAND: '🏝 Phase 3 · Clues', TREASURE: '💰 Phase 4 · Treasure' }[this.phase] || '';
  }

  // ---- Phase 1: Repair ----
  _enterRepair() {
    this._setZone('ship');
    this.phaseTime = 0;
    this.stableTime = 0;
    const defs = [
      { name: 'Hull Breach', pos: new THREE.Vector3(-1.7, DECK_TOP, -3.4) },
      { name: 'Torn Sail', pos: new THREE.Vector3(1.6, DECK_TOP, -0.4) },
      { name: 'Ship\'s Wheel', pos: new THREE.Vector3(-1.3, DECK_TOP, 4.6) },
    ];
    this.stations = defs.map((d) => {
      const mk = marker(0x5ad2ff);
      mk.position.copy(d.pos);
      this.scene.add(mk);
      this.spinners.push(mk);
      this.stationMarkers.push(mk);
      return { ...d, repaired: false, marker: mk };
    });

    // Interactions differ by role
    for (const st of this.stations) {
      this.interactables.push({
        world: st.pos, radius: 2.4, hold: this.playerRole === 'CREW' ? 2.2 : 1.6,
        getPrompt: () => {
          if (this.playerRole === 'CREW') return st.repaired ? null : `Hold <b>E</b> — Repair ${st.name}`;
          return st.repaired ? `Hold <b>E</b> — Sabotage ${st.name}` : null;
        },
        onDone: () => {
          if (this.playerRole === 'CREW') { this._setStation(st, true); this.audio.success(); this.ui.toast(`${st.name} repaired!`); }
          else { this._setStation(st, false); this._sabotage('restation', `You sabotaged the ${st.name}.`); }
        },
      });
    }
    // powder keg (mutineer only)
    let kegPrimed = false;
    this.interactables.push({
      world: new THREE.Vector3(1.8, DECK_TOP, 1.5), radius: 2.2, hold: 2.0,
      getPrompt: () => (this.playerRole === 'MUTINEER' && !kegPrimed) ? 'Hold <b>E</b> — Prime the powder keg' : null,
      onDone: () => { kegPrimed = true; this._sabotage('keg', 'The powder keg is primed to blow.'); },
    });
  }

  _setStation(st, repaired) {
    st.repaired = repaired;
    const col = repaired ? 0x4dff88 : 0xff5a4d;
    st.marker.userData.ring.material.color.setHex(col);
    st.marker.userData.ring.material.emissive.setHex(col);
  }

  // ---- Phase 2: The Crossing ----
  _enterCrossing() {
    this._setZone('ship');
    this.phaseTime = 0;
    this.fishCount = 0;
    this.islandStartZ = -95;

    if (this.playerRole === 'CREW') {
      for (let i = 0; i < 7; i++) this._spawnFish();
    } else {
      let rudderDone = false, kegPrimed = false;
      this.interactables.push({
        world: new THREE.Vector3(1.3, DECK_TOP, 5.0), radius: 2.4, hold: 2.6,
        getPrompt: () => rudderDone ? null : 'Hold <b>E</b> — Sabotage the rudder',
        onDone: () => { rudderDone = true; this._sabotage('rudder', 'You jammed the rudder!'); },
      });
      this.interactables.push({
        world: new THREE.Vector3(1.8, DECK_TOP, 1.5), radius: 2.2, hold: 2.0,
        getPrompt: () => kegPrimed ? null : 'Hold <b>E</b> — Prime the powder keg',
        onDone: () => { kegPrimed = true; this._sabotage('keg', 'The powder keg is primed to blow.'); },
      });
    }
  }

  _spawnFish() {
    const f = createFish(Math.random() < 0.3 ? 0xffc46f : 0x6fd0e0);
    this._roamFish(f, true);
    f.userData.body = f.children[0];
    f.children[0].userData.fish = f;
    f.userData.speed = 1.2 + Math.random() * 1.4;
    f.userData.heading = Math.random() * Math.PI * 2;
    f.userData.turn = 0;
    this.scene.add(f);
    this.fish.push(f);
    this.fishMeshes.push(f.children[0]);
  }

  _roamFish(f, initial) {
    // place somewhere in the water around the ship, avoiding directly under it
    let x, z;
    do {
      x = (Math.random() - 0.5) * 34;
      z = -14 + Math.random() * 18;
    } while (Math.abs(x) < 4.5 && z > -8 && z < 6);
    f.position.set(x, 0.35, z);
    if (initial) f.userData.heading = Math.random() * Math.PI * 2;
  }

  _tryCatchFish() {
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    this.raycaster.far = 60;
    const hits = this.raycaster.intersectObjects(this.fishMeshes, false);
    if (hits.length) {
      const f = hits[0].object.userData.fish;
      this._removeFish(f);
      this.fishCount++;
      this.audio.fish();
      this.ui.toast(`Nice catch! (${this.fishCount}/${CFG.fishGoal})`, 1200);
      setTimeout(() => { if (this.phase === 'CROSSING') this._spawnFish(); }, 900);
    } else {
      this.audio.blip();
    }
  }

  _removeFish(f) {
    this.scene.remove(f);
    this.fish = this.fish.filter((x) => x !== f);
    this.fishMeshes = this.fishMeshes.filter((m) => m !== f.children[0]);
  }

  _clearFish() {
    for (const f of [...this.fish]) this._removeFish(f);
  }

  // ---- Phase 3: Island ----
  _enterIsland() {
    // transition handled by _land(); this only sets up island interactions
    this._setZone('island');
    this.ui.setFish(0, 0, false); // fishing HUD is crossing-only
    this.ui.setTimer(0, this.playerRole === 'MUTINEER');
    this.carrying = false;
    this.cluesAtFire = 0;

    // fragments (local to island group)
    const fragDefs = [
      { local: new THREE.Vector3(-8, 0, 6), playerOnly: true },
      { local: new THREE.Vector3(10, 0, -7), playerOnly: false },
      { local: new THREE.Vector3(-3, 0, -11), playerOnly: false },
    ];
    this.fragments = fragDefs.map((d) => {
      const g = clueFragment(0xffd76a);
      g.position.set(d.local.x, islandHeight(Math.hypot(d.local.x, d.local.z)), d.local.z);
      this.island.add(g);
      this.spinners.push(g);
      return { group: g, local: d.local, playerOnly: d.playerOnly, collected: false, targetedBy: null };
    });

    // campfire interaction: player crew deposits carried clue automatically (proximity);
    // player mutineer can burn a delivered clue.
    this.fireWorld = new THREE.Vector3().copy(this.fire.position).add(ISLAND_ORIGIN);
    this.interactables.push({
      world: this.fireWorld, radius: 3.0, hold: 1.8,
      getPrompt: () => (this.playerRole === 'MUTINEER' && this.cluesAtFire > 0) ? 'Hold <b>E</b> — Burn a clue in the fire' : null,
      onDone: () => {
        this.cluesAtFire = Math.max(0, this.cluesAtFire - 1);
        this._sabotage('burn', 'You burned one of the clues to ash.');
        this._refreshObjective();
      },
    });
  }

  // ---- Phase 4: Treasure ----
  _enterTreasure() {
    const tl = this.island.userData.treasureLocal;
    const mk = marker(0xffd76a);
    mk.position.set(tl.x, islandHeight(Math.hypot(tl.x, tl.z)) + 0.02, tl.z);
    this.island.add(mk);
    this.spinners.push(mk);
    this.treasureMarker = mk;
    const world = new THREE.Vector3(tl.x, 0, tl.z).add(ISLAND_ORIGIN);
    this.interactables.push({
      world, radius: 2.6, hold: 3.0,
      getPrompt: () => (this.playerRole === 'CREW' && !this.treasureDug) ? 'Hold <b>E</b> — Dig up the treasure' : null,
      onDone: () => this._digTreasure(),
    });
  }

  _digTreasure() {
    this.treasureDug = true;
    this.chest.visible = true;
    this.chest.userData.light.intensity = 3;
    this._chestRise = 0;
    this.audio.win();
    this.ui.setPrompt(null); this.ui.setHold(0);
    this.ui.toast('The chest is yours!', 2600);
    // Resolve on wall-clock time so the win never depends on frame rate.
    setTimeout(() => {
      if (!this.over) {
        this._end(true, 'TREASURE CLAIMED',
          `You dug up the hoard before the mutiny took hold. The traitor <b>${this.mutineerName}</b> is exposed!`);
      }
    }, 1800);
  }

  // ------------------------------------------------------------- sabotage/meter
  _sabotage(kind, msg) {
    this.mutiny = Math.min(100, this.mutiny + (CFG.sabotage[kind] || 0));
    this.audio.sabotage();
    // detection: any live crew nearby?
    if (this.playerRole === 'MUTINEER') {
      const seen = this._nearestLiveCrew(CFG.seenRadius);
      if (seen) {
        this.suspicion = Math.min(100, this.suspicion + CFG.suspicionOnSeen);
        this.ui.toast(`${seen.name} saw you! Suspicion rising.`, 2400);
      } else {
        this.ui.toast(msg, 2200);
      }
    } else {
      this.ui.toast(msg, 2200);
    }
  }

  _nearestLiveCrew(maxDist) {
    const p = this.player.object.position;
    let best = null, bd = maxDist;
    for (const c of this.crew) {
      if (!c.alive) continue;
      const d = c.group.position.distanceTo(p);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  _tryEliminate() {
    // player mutineer eliminates an adjacent, isolated crewmate
    const p = this.player.object.position;
    let target = null, td = 2.6;
    for (const c of this.crew) {
      if (!c.alive) continue;
      const d = c.group.position.distanceTo(p);
      if (d < td) { td = d; target = c; }
    }
    if (!target) return;
    // witnesses = any OTHER live crew within seen radius
    const witness = this.crew.some((c) => c.alive && c !== target && c.group.position.distanceTo(p) < CFG.seenRadius);
    if (witness) {
      this.suspicion = Math.min(100, this.suspicion + CFG.suspicionOnSeen);
      this.ui.toast('Too many eyes — someone saw the attempt!', 2400);
      this.audio.alarm();
      return;
    }
    target.alive = false;
    target.group.visible = false;
    this.mutiny = Math.min(100, this.mutiny + CFG.sabotage.kill);
    this.audio.sabotage();
    this.ui.toast(`You eliminated ${target.name}.`, 2400);
  }

  // ------------------------------------------------------------- main loop
  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;

    // world FX
    this.ocean.userData.tick(t);
    this.fire.userData.tick(t);
    for (const s of this.spinners) s.userData.tick && s.userData.tick(t);

    if (!this.over && this._started) {
      this.player.update(dt);
      this._updateCrew(dt, t);
      this._updatePhase(dt, t);
      this._updateInteractions(dt);
      this._updateMeters(dt);
      this._checkEnd();
    }
    if (this._chestRise !== undefined && this._chestRise < 1) {
      this._chestRise = Math.min(1, this._chestRise + dt * 0.6);
      const tl = this.island.userData.treasureLocal;
      const base = islandHeight(Math.hypot(tl.x, tl.z));
      this.chest.position.y = (base - 1.6) + this._chestRise * 2.0;
      this.chest.rotation.y = this._chestRise * Math.PI * 2;
    }

    this.renderer.render(this.scene, this.camera);
  }

  _updatePhase(dt, t) {
    if (this.phase === 'CROSSING') {
      this.phaseTime += dt;
      // sail the island in
      const f = Math.min(1, this.phaseTime / CFG.crossingTime);
      this.island.position.z = this.islandStartZ + (ISLAND_ORIGIN.z - this.islandStartZ) * (f * f * (3 - 2 * f));
      // fish swim
      for (const fish of this.fish) this._swimFish(fish, dt);
      this.ui.setFish(this.fishCount, CFG.fishGoal, this.playerRole === 'CREW');
      if (this.phaseTime >= CFG.crossingTime) { this._land(); }
    } else if (this.phase === 'REPAIR') {
      this.phaseTime += dt;
      const allRepaired = this.stations.every((s) => s.repaired);
      this.stableTime = allRepaired ? this.stableTime + dt : 0;
      if ((allRepaired && this.stableTime > 1.6) || this.phaseTime > CFG.repairTimeout) {
        this.ui.toast('Anchors aweigh! Setting sail…', 2200);
        this._enterPhase('CROSSING');
      }
    } else if (this.phase === 'ISLAND') {
      this._islandLogic(dt);
    }
  }

  _swimFish(f, dt) {
    f.userData.turn -= dt;
    if (f.userData.turn <= 0) { f.userData.heading += (Math.random() - 0.5) * 1.2; f.userData.turn = 1 + Math.random() * 2; }
    const sp = f.userData.speed * dt;
    f.position.x += Math.cos(f.userData.heading) * sp;
    f.position.z += Math.sin(f.userData.heading) * sp;
    // keep within a ring around the ship, out from under it
    const d = Math.hypot(f.position.x, f.position.z + 5);
    if (d > 20 || (Math.abs(f.position.x) < 4 && f.position.z > -8 && f.position.z < 6)) {
      f.userData.heading = Math.atan2(-(f.position.z + 5), -f.position.x) + (Math.random() - 0.5);
    }
    f.position.y = 0.35 + Math.sin(this.clock.elapsedTime * 3 + f.position.x) * 0.12;
    f.rotation.y = -f.userData.heading + Math.PI / 2;
  }

  _islandLogic() {
    // collect fragments the player walks over (one at a time)
    if (!this.carrying) {
      const p = this.player.object.position;
      for (const fr of this.fragments) {
        if (fr.collected) continue;
        const wp = new THREE.Vector3().copy(fr.local).add(ISLAND_ORIGIN);
        if (Math.hypot(p.x - wp.x, p.z - wp.z) < 1.8) {
          fr.collected = true; fr.group.visible = false;
          this.spinners = this.spinners.filter((s) => s !== fr.group);
          this.carrying = true;
          this.audio.progress();
          this.ui.toast('Clue in hand — bring it to the campfire.', 2400);
          break;
        }
      }
    } else {
      // deposit at fire
      const p = this.player.object.position;
      if (Math.hypot(p.x - this.fireWorld.x, p.z - this.fireWorld.z) < 3.0) {
        this.carrying = false;
        this.cluesAtFire++;
        this.audio.success();
        this.ui.toast(`Clue added to the map (${this.cluesAtFire}/${CFG.cluesNeeded}).`, 2000);
        this._refreshObjective();
        this._maybeRevealMap();
      }
    }
    this._refreshObjective();
  }

  _maybeRevealMap() {
    if (this.cluesAtFire >= CFG.cluesNeeded && !this._mapShown && this.playerRole === 'CREW') {
      this._mapShown = true;
      this.player.unlock();
      this.audio.win();
      this.ui.showMap(
        'The pieces fit: "Where three palms lean as one on the eastern shore, and no shadow falls, the X marks the hoard."',
        false
      );
    }
  }

  dismissMap() {
    this.ui.hide('map-overlay');
    this.player.lock();
    this._enterPhase('TREASURE');
    this.ui.toast('Head east to the three palms!', 2600);
  }

  // ------------------------------------------------------------- crew AI
  _updateCrew(dt, t) {
    for (const c of this.crew) {
      if (!c.alive) { c.group.visible = false; continue; }
      this._crewBehavior(c, dt);
      const gp = c.group.position;
      const dx = c.target.x - gp.x, dz = c.target.z - gp.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.12) {
        const step = Math.min(c.speed * dt, d);
        gp.x += dx / d * step; gp.z += dz / d * step;
        c.group.rotation.y = Math.atan2(dx, dz);
        c.walk += dt * 9;
      } else {
        c.walk += dt * 2;
      }
      gp.y = this._groundY(gp.x, gp.z);
      c.group.userData.body.position.y = 0.8 + Math.abs(Math.sin(c.walk)) * 0.06;
    }
  }

  _crewBehavior(c, dt) {
    if (this.phase === 'REPAIR') {
      if (c.isMutineer) { // acts like a repairer visually
        // saunter between stations
      }
      const st = this.stations.find((s) => !s.repaired);
      if (st) {
        c.target.set(st.pos.x + (c.color % 2 ? 0.6 : -0.6), DECK_TOP, st.pos.z + 0.6);
        if (c.group.position.distanceTo(st.pos) < 1.5) {
          c.work += dt;
          if (c.work > 3.2 && !c.isMutineer) { this._setStation(st, true); c.work = 0; }
        }
      } else {
        // idle wander near mast
        if (c.group.position.distanceTo(c.target) < 0.4) {
          c.target.set((Math.random() - 0.5) * 4, DECK_TOP, (Math.random() - 0.5) * 8);
        }
      }
    } else if (this.phase === 'CROSSING') {
      // line up at the starboard rail to "fish"
      const i = this.crew.indexOf(c);
      c.target.set(2.3, DECK_TOP, -3 + i * 2.2);
    } else if (this.phase === 'ISLAND' || this.phase === 'TREASURE') {
      if (c.isMutineer) {
        if (c.group.position.distanceTo(c.target) < 0.6) {
          const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 8;
          c.target.set(ISLAND_ORIGIN.x + Math.cos(a) * r, 0, ISLAND_ORIGIN.z + Math.sin(a) * r);
        }
        return;
      }
      this._crewGather(c, dt);
    }
  }

  _crewGather(c, dt) {
    if (c.state === 'toFire' || c.frag) {
      c.target.copy(this.fireWorld);
      if (c.group.position.distanceTo(this.fireWorld) < 2.4) {
        this.cluesAtFire++;
        c.frag = null; c.state = 'toFrag';
        this._refreshObjective();
        // no map reveal for AI-only deposits unless threshold reached via player too
        this._maybeRevealMap();
      }
      return;
    }
    // pick a fragment to fetch
    let fr = this.fragments.find((f) => f === c._claim && !f.collected);
    if (!fr) {
      fr = this.fragments.find((f) => !f.collected && !f.playerOnly && (!f.targetedBy || f.targetedBy === c));
      if (fr) { fr.targetedBy = c; c._claim = fr; }
    }
    if (!fr) {
      // nothing to do; mill near fire
      if (c.group.position.distanceTo(c.target) < 0.6) {
        const a = Math.random() * Math.PI * 2;
        c.target.set(this.fireWorld.x + Math.cos(a) * 5, 0, this.fireWorld.z + Math.sin(a) * 5);
      }
      return;
    }
    const wp = new THREE.Vector3().copy(fr.local).add(ISLAND_ORIGIN);
    c.target.copy(wp);
    if (c.group.position.distanceTo(wp) < 1.6) {
      fr.collected = true; fr.group.visible = false;
      this.spinners = this.spinners.filter((s) => s !== fr.group);
      c.frag = fr; c._claim = null; c.state = 'toFire';
    }
  }

  // ------------------------------------------------------------- interactions
  _updateInteractions(dt) {
    // free-press actions (eliminate) for mutineer on island
    if (this.playerRole === 'MUTINEER' && (this.phase === 'ISLAND' || this.phase === 'TREASURE')) {
      const near = this._nearestLiveCrew(2.6);
      const other = near && this.crew.some((c) => c.alive && c !== near && c.group.position.distanceTo(this.player.object.position) < CFG.seenRadius);
      if (near && !other) {
        // offer eliminate via same prompt/hold path
      }
    }

    // find nearest valid hold-interactable
    const p = this.player.object.position;
    let best = null, bd = Infinity;
    for (const it of this.interactables) {
      const prompt = it.getPrompt();
      if (!prompt) continue;
      const d = Math.hypot(p.x - it.world.x, p.z - it.world.z);
      if (d < it.radius && d < bd) { bd = d; best = it; }
    }

    // mutineer eliminate as a special interactable-like prompt
    let elimTarget = null;
    if (this.playerRole === 'MUTINEER' && (this.phase === 'ISLAND' || this.phase === 'TREASURE')) {
      const near = this._nearestLiveCrew(2.4);
      if (near) elimTarget = near;
    }

    if (best) {
      this.ui.setPrompt(best.getPrompt());
      if (this._keyE) {
        best._p = (best._p || 0) + dt;
        this.ui.setHold(best._p / best.hold);
        if (best._p >= best.hold) { best._p = 0; this.ui.setHold(0); best.onDone(); this._refreshObjective(); }
      } else {
        best._p = Math.max(0, (best._p || 0) - dt * 3);
        this.ui.setHold(best._p / best.hold);
      }
    } else if (elimTarget) {
      this.ui.setPrompt(`Press <b>E</b> — Eliminate ${elimTarget.name}`);
      this.ui.setHold(0);
      if (this._keyE && !this._elimLatch) { this._elimLatch = true; this._tryEliminate(); this._refreshObjective(); }
      if (!this._keyE) this._elimLatch = false;
    } else {
      this.ui.setPrompt(null);
      this.ui.setHold(0);
    }
  }

  // ------------------------------------------------------------- meters / end
  _updateMeters(dt) {
    if (this.playerRole === 'CREW') {
      this.mutiny = Math.min(100, this.mutiny + CFG.passiveCrew * dt);
      this._saboT = (this._saboT || 0) + dt;
      if (this._saboT > CFG.aiSaboEvery) {
        this._saboT = 0;
        if (this.mutiny < 100) {
          this.mutiny = Math.min(100, this.mutiny + CFG.aiSaboAmount);
          const lines = ['A hatch slams somewhere below…', 'Tools clatter, then silence…', 'The bilge sloshes — was that deliberate?'];
          this.ui.toast(lines[Math.floor(this._saboLine = ((this._saboLine || 0) + 1)) % lines.length], 2200);
          this.audio.sabotage();
        }
      }
      this.ui.setSuspicion(0, false);
      const showTimer = this.phase === 'CROSSING';
      this.ui.setTimer(showTimer ? Math.max(0, CFG.crossingTime - this.phaseTime) : 0, showTimer);
    } else {
      this.mutiny = Math.min(100, this.mutiny + CFG.passiveMutineer * dt);
      this.roundTimer = Math.max(0, this.roundTimer - dt);
      this.suspicion = Math.max(0, this.suspicion - CFG.suspicionDecay * dt);
      this.ui.setSuspicion(this.suspicion, true);
      this.ui.setTimer(this.roundTimer, this.phase !== 'BRIEFING');
    }
    this.ui.setMutiny(this.mutiny);
  }

  _checkEnd() {
    if (this.over) return;
    // Once the crew have dug the treasure the round is decided; the win screen is
    // scheduled on a wall-clock timer in _digTreasure so nothing can steal it.
    if (this.playerRole === 'CREW' && this.treasureDug) return;
    if (this.mutiny >= 100) {
      return this._end(this.playerRole === 'MUTINEER',
        this.playerRole === 'MUTINEER' ? 'MUTINY WINS' : 'THE SHIP IS LOST',
        this.playerRole === 'MUTINEER'
          ? 'You drove the crew to ruin before they ever found the gold.'
          : `The mutiny boiled over. The traitor was <b>${this.mutineerName}</b>.`);
    }
    if (this.playerRole === 'MUTINEER') {
      if (this.suspicion >= 100) {
        return this._end(false, 'CAUGHT RED-HANDED',
          'The crew caught you in the act and threw you overboard. The mutiny is over.');
      }
      if (this.roundTimer <= 0) {
        return this._end(false, 'MUTINY FAILED',
          'You ran out of time. The crew reached safe harbour and rooted you out.');
      }
    }
  }

  _end(win, title, detail) {
    this.over = true;
    this.player.unlock();
    this.player.enabled = false;
    this.ui.setPrompt(null); this.ui.setHold(0);
    if (win) this.audio.win(); else this.audio.lose();
    this.ui.showEnd(win, title, detail);
  }

  // ------------------------------------------------------------- land transition
  _land() {
    this._clearFish();
    this.ui.fade(true);
    this.ui.setTimer(0, false);
    this.ui.setFish(0, 0, false);
    setTimeout(() => {
      this.island.position.copy(ISLAND_ORIGIN);
      this._placeCrewOnIsland();
      // player spawns on the near beach, looking inland
      const spawnZ = ISLAND_ORIGIN.z + (ISLAND.radius - 3);
      this.player.setPosition(0, islandHeight(ISLAND.radius - 3) + EYE, spawnZ);
      this.player.object.rotation.set(0, 0, 0); // face -Z, inland toward the campfire
      this._enterPhase('ISLAND');
      this.ui.toast('Land ho! Search the island for clues.', 2800);
      setTimeout(() => this.ui.fade(false), 400);
    }, 650);
  }

  // ------------------------------------------------------------- misc
  _clearInteractables() {
    // remove station/treasure markers from scene when leaving a phase
    for (const mk of this.stationMarkers) { this.scene.remove(mk); this.spinners = this.spinners.filter((s) => s !== mk); }
    this.stationMarkers = [];
    this.interactables = [];
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
