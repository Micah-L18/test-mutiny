import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Shared materials (reused to keep draw calls / allocations down)
// ---------------------------------------------------------------------------
const M = {
  woodDark:  new THREE.MeshStandardMaterial({ color: 0x4a3423, roughness: 0.9 }),
  wood:      new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 0.85 }),
  woodLight: new THREE.MeshStandardMaterial({ color: 0x9c744a, roughness: 0.8 }),
  sail:      new THREE.MeshStandardMaterial({ color: 0xe9ddc2, roughness: 1, side: THREE.DoubleSide }),
  rope:      new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 1 }),
  gold:      new THREE.MeshStandardMaterial({ color: 0xe8b64c, roughness: 0.35, metalness: 0.6 }),
  sand:      new THREE.MeshStandardMaterial({ color: 0xe6d29a, roughness: 1, flatShading: true }),
  sandDark:  new THREE.MeshStandardMaterial({ color: 0xcdb478, roughness: 1 }),
  leaf:      new THREE.MeshStandardMaterial({ color: 0x3f9a4e, roughness: 0.9, flatShading: true }),
  bark:      new THREE.MeshStandardMaterial({ color: 0x6d4a2b, roughness: 1 }),
  rock:      new THREE.MeshStandardMaterial({ color: 0x8c8f96, roughness: 1, flatShading: true }),
  visor:     new THREE.MeshStandardMaterial({ color: 0x9fdfff, roughness: 0.2, metalness: 0.3, emissive: 0x113344, emissiveIntensity: 0.4 }),
  black:     new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.9 }),
};

// ---------------------------------------------------------------------------
// Sky + ocean
// ---------------------------------------------------------------------------
export function createSky() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#2a6ea6');
  grad.addColorStop(0.55, '#8fc4e8');
  grad.addColorStop(0.8, '#f4dcb0');
  grad.addColorStop(1.0, '#f7c98a');
  g.fillStyle = grad; g.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(600, 24, 16);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
  return new THREE.Mesh(geo, mat);
}

export function createOcean() {
  const size = 900, seg = 80;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1f6f8f, roughness: 0.55, metalness: 0.1,
    transparent: true, opacity: 0.96, flatShading: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = false;
  const pos = geo.attributes.position;
  const count = pos.count;
  let frame = 0;
  const wave = (x, z, t) =>
    Math.sin(x * 0.06 + t * 0.9) * 0.55 +
    Math.sin(z * 0.08 + t * 1.1) * 0.4 +
    Math.sin((x + z) * 0.03 - t * 0.6) * 0.5;

  mesh.userData.tick = (t) => {
    for (let i = 0; i < count; i++) {
      pos.setY(i, wave(pos.getX(i), pos.getZ(i), t));
    }
    pos.needsUpdate = true;
    if ((frame++ % 3) === 0) geo.computeVertexNormals(); // cheaper than every frame
  };
  return mesh;
}

// ---------------------------------------------------------------------------
// Name-tag sprite (floats over crew heads)
// ---------------------------------------------------------------------------
export function makeLabel(text, color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 8;
  g.strokeText(text, 128, 34);
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true });
  const s = new THREE.Sprite(mat);
  s.scale.set(2.2, 0.55, 1);
  return s;
}

// ---------------------------------------------------------------------------
// A "bean" pirate crew member
// ---------------------------------------------------------------------------
export function createBean(color, name) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 6, 14), bodyMat);
  body.position.y = 0.8;
  body.castShadow = true;
  g.add(body);

  const backpack = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.4, 4, 8),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), roughness: 0.7 }));
  backpack.position.set(0, 0.95, -0.34);
  g.add(backpack);

  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), M.visor);
  visor.rotation.x = Math.PI * 0.5;
  visor.position.set(0, 1.12, 0.28);
  visor.scale.set(1.15, 1, 0.7);
  g.add(visor);

  // pirate hat: black cone + brim
  const hat = new THREE.Group();
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.06, 16), M.black);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.3, 16), M.black);
  crown.position.y = 0.16;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xf2efe4 }));
  skull.position.set(0, 0.06, 0.34);
  hat.add(brim, crown, skull);
  hat.position.y = 1.42;
  g.add(hat);

  const label = makeLabel(name, '#' + new THREE.Color(color).getHexString());
  label.position.y = 2.15;
  g.add(label);

  g.userData.body = body;
  g.userData.label = label;
  return g;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export function barrel() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 14), M.woodDark);
  const r1 = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.08, 14), M.gold);
  r1.position.y = 0.3;
  const r2 = r1.clone(); r2.position.y = -0.3;
  g.add(b, r1, r2);
  return g;
}

export function crate() {
  const g = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), M.wood);
  const edges = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.2, 0.95), M.woodDark);
  const g2 = new THREE.Group();
  g2.add(g); g2.add(edges);
  return g2;
}

export function palmTree() {
  const g = new THREE.Group();
  const h = 4 + Math.random() * 2;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, h, 8), M.bark);
  trunk.position.y = h / 2;
  trunk.rotation.z = (Math.random() - 0.5) * 0.3;
  g.add(trunk);
  const crown = new THREE.Group();
  crown.position.set(Math.sin(trunk.rotation.z) * -h / 2, h, 0);
  for (let i = 0; i < 6; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.4, 5), M.leaf);
    frond.geometry.translate(0, 1.2, 0);
    frond.rotation.z = Math.PI / 2 - 0.5;
    frond.rotation.y = (i / 6) * Math.PI * 2;
    crown.add(frond);
  }
  const coco = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), M.bark);
  coco.position.y = -0.1;
  crown.add(coco);
  g.add(crown);
  g.castShadow = true;
  return g;
}

export function rock(scale = 1) {
  const r = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), M.rock);
  r.scale.set(scale * (0.8 + Math.random() * 0.5), scale * (0.6 + Math.random() * 0.5), scale * (0.8 + Math.random() * 0.5));
  r.rotation.set(Math.random(), Math.random(), Math.random());
  return r;
}

// A glowing interaction marker (ring on the ground + a floating icon)
export function marker(color = 0x66e0ff, icon = 'wrench') {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.08, 8, 32),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.4 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  g.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 3, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false })
  );
  beam.position.y = 1.5;
  g.add(beam);
  g.userData.ring = ring;
  g.userData.color = new THREE.Color(color);
  g.userData.tick = (t) => { ring.rotation.z = t * 0.8; };
  return g;
}

// A floating clue fragment (spins + bobs)
export function clueFragment(color = 0xffd76a) {
  const g = new THREE.Group();
  const shard = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.35, 0),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.3 })
  );
  shard.position.y = 1.1;
  g.add(shard);
  const glow = new THREE.PointLight(color, 6, 6, 2);
  glow.position.y = 1.1;
  g.add(glow);
  g.userData.tick = (t) => {
    shard.rotation.y = t * 1.6;
    shard.rotation.x = t * 0.9;
    shard.position.y = 1.1 + Math.sin(t * 2.2) * 0.18;
  };
  return g;
}

export function campfire() {
  const g = new THREE.Group();
  const ring = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), M.rock);
    const a = (i / 8) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.85, 0.1, Math.sin(a) * 0.85);
    ring.add(s);
  }
  g.add(ring);
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.0, 8), M.woodDark);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 4) * Math.PI;
    log.position.y = 0.15;
    g.add(log);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.4, 1.1, 10),
    new THREE.MeshBasicMaterial({ color: 0xff8a3c, transparent: true, opacity: 0.9 })
  );
  flame.position.y = 0.75;
  g.add(flame);
  const inner = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.7, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe066 })
  );
  inner.position.y = 0.65;
  g.add(inner);
  const light = new THREE.PointLight(0xff9a4c, 10, 22, 2);
  light.position.y = 1.2;
  g.add(light);
  g.userData.tick = (t) => {
    const s = 1 + Math.sin(t * 12) * 0.12 + Math.sin(t * 7) * 0.06;
    flame.scale.set(1, s, 1);
    inner.scale.set(1, s * 0.9, 1);
    light.intensity = 9 + Math.sin(t * 15) * 2.5;
  };
  return g;
}

export function treasureChest() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.95), M.wood);
  base.position.y = 0.4;
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.48, 1.4, 16, 1, false, 0, Math.PI),
    M.wood
  );
  lid.rotation.z = Math.PI / 2;
  lid.rotation.y = Math.PI / 2;
  lid.position.y = 0.8;
  g.add(base, lid);
  for (const y of [0.4]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.14, 1.0), M.gold);
    band.position.y = y; g.add(band);
  }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.1), M.gold);
  lock.position.set(0, 0.55, 0.5);
  g.add(lock);
  // sparkle of gold inside
  const coins = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.gold);
  coins.position.y = 0.78;
  g.add(coins);
  const light = new THREE.PointLight(0xffd76a, 0, 8, 2);
  light.position.y = 1.2;
  g.add(light);
  g.userData.light = light;
  return g;
}

// ---------------------------------------------------------------------------
// The ship — built from primitives, length along Z, bow at -Z
// ---------------------------------------------------------------------------
export function createShip() {
  const ship = new THREE.Group();
  const L = 16, W = 7;

  // Deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W, 0.4, L), M.woodLight);
  deck.position.y = 2;
  deck.receiveShadow = true;
  ship.add(deck);

  // deck plank lines (thin dark strips for texture)
  for (let i = -2; i <= 2; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, L - 0.4), M.woodDark);
    plank.position.set(i * 1.15, 2.01, 0);
    ship.add(plank);
  }

  // Hull (below deck), slightly wider, tapered look via scaled box + wedge bow
  const hull = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 2.4, L), M.wood);
  hull.position.y = 0.9;
  ship.add(hull);
  const hullBottom = new THREE.Mesh(new THREE.BoxGeometry(W - 1.6, 1.6, L - 1.4), M.woodDark);
  hullBottom.position.y = -0.4;
  ship.add(hullBottom);

  // Bow wedge (pointy front at -Z)
  const bow = new THREE.Mesh(new THREE.ConeGeometry(W / 2 + 0.2, 4.2, 4), M.wood);
  bow.rotation.x = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.set(1, 0.55, 1);
  bow.position.set(0, 1.1, -L / 2 - 1.4);
  ship.add(bow);

  // Bulwarks (railings) around the deck, with a gap at the stern for disembark feel
  const railMat = M.wood;
  const railH = 1.0;
  const mkRail = (w, d, x, z) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, railH, d), railMat);
    r.position.set(x, 2.5, z);
    ship.add(r);
  };
  mkRail(0.3, L, -W / 2 + 0.15, 0);      // port
  mkRail(0.3, L, W / 2 - 0.15, 0);       // starboard
  mkRail(W, 0.3, 0, L / 2 - 0.15);       // stern
  mkRail(W, 0.3, 0, -L / 2 + 0.15);      // bow rail

  // Mast + sail
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 12, 12), M.woodDark);
  mast.position.set(0, 8, -1);
  ship.add(mast);
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7.5, 8), M.woodDark);
  yard.rotation.z = Math.PI / 2;
  yard.position.set(0, 11.5, -1);
  ship.add(yard);

  // Sail with skull emblem
  const sailCanvas = document.createElement('canvas');
  sailCanvas.width = 256; sailCanvas.height = 256;
  const sg = sailCanvas.getContext('2d');
  sg.fillStyle = '#e9ddc2'; sg.fillRect(0, 0, 256, 256);
  sg.strokeStyle = 'rgba(0,0,0,0.12)'; sg.lineWidth = 3;
  for (let i = 0; i < 6; i++) { sg.beginPath(); sg.moveTo(0, i * 45 + 20); sg.lineTo(256, i * 45 + 20); sg.stroke(); }
  sg.fillStyle = '#2a2a2a';
  sg.beginPath(); sg.arc(128, 110, 40, 0, Math.PI * 2); sg.fill();     // skull
  sg.fillStyle = '#e9ddc2';
  sg.beginPath(); sg.arc(114, 104, 9, 0, Math.PI * 2); sg.fill();
  sg.beginPath(); sg.arc(142, 104, 9, 0, Math.PI * 2); sg.fill();
  sg.fillRect(120, 118, 16, 12);
  sg.strokeStyle = '#2a2a2a'; sg.lineWidth = 12; sg.lineCap = 'round';
  sg.beginPath(); sg.moveTo(90, 165); sg.lineTo(166, 200); sg.stroke();  // crossbones
  sg.beginPath(); sg.moveTo(166, 165); sg.lineTo(90, 200); sg.stroke();
  const sailTex = new THREE.CanvasTexture(sailCanvas);
  sailTex.colorSpace = THREE.SRGBColorSpace;
  const sailMat = new THREE.MeshStandardMaterial({ map: sailTex, roughness: 1, side: THREE.DoubleSide });
  const sailGeo = new THREE.PlaneGeometry(7, 7, 8, 8);
  // gentle billow
  const sp = sailGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i);
    sp.setZ(i, Math.cos((x / 7) * Math.PI) * 0.6 + 0.3);
  }
  sailGeo.computeVertexNormals();
  const sail = new THREE.Mesh(sailGeo, sailMat);
  sail.position.set(0, 8, -1);
  sail.name = 'sail';
  ship.add(sail);

  // Ship's wheel (stern)
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 8, 20), M.woodDark);
  wheel.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 10), M.woodDark);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 6), M.woodDark);
    spoke.rotation.z = (i / 6) * Math.PI * 2;
    wheel.add(spoke);
  }
  wheel.position.set(0, 3.2, L / 2 - 1.2);
  wheel.name = 'wheel';
  ship.add(wheel);
  const wheelPost = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.3), M.woodDark);
  wheelPost.position.set(0, 2.6, L / 2 - 1.1);
  ship.add(wheelPost);

  // Powder keg (mutineer sabotage target near the mast)
  const keg = barrel();
  keg.scale.set(1.1, 1.1, 1.1);
  keg.position.set(1.8, 2.75, 1.5);
  keg.name = 'keg';
  const fuse = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 10), M.rope);
  fuse.position.set(0, 0.55, 0);
  keg.add(fuse);
  ship.add(keg);

  // Decorative barrels & crates
  const b1 = barrel(); b1.position.set(-2.2, 2.7, 3.5); ship.add(b1);
  const b2 = barrel(); b2.position.set(-1.4, 2.7, 3.5); ship.add(b2);
  const c1 = crate(); c1.position.set(2.3, 2.65, -3.2); ship.add(c1);
  const c2 = crate(); c2.position.set(2.3, 2.65, -2.1); c2.scale.set(0.8, 0.8, 0.8); ship.add(c2);

  // Ropes from mast to bow/stern
  const mkRope = (a, b) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 5), M.rope);
    rope.position.copy(a).add(b).multiplyScalar(0.5);
    rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    ship.add(rope);
  };
  mkRope(new THREE.Vector3(0, 13, -1), new THREE.Vector3(0, 3, -L / 2 - 0.5));
  mkRope(new THREE.Vector3(0, 13, -1), new THREE.Vector3(0, 3.5, L / 2 - 0.5));

  ship.userData.deckTop = 2.2;
  return ship;
}

// ---------------------------------------------------------------------------
// The island (cone with gentle beach). Height is exposed for walking.
// ---------------------------------------------------------------------------
export const ISLAND = { radius: 20, height: 3 };

export function islandHeight(dist) {
  if (dist >= ISLAND.radius) return 0;
  const t = 1 - dist / ISLAND.radius;
  return ISLAND.height * t * t; // eased dome
}

export function createIsland() {
  const g = new THREE.Group();

  // sand dome
  const sandGeo = new THREE.ConeGeometry(ISLAND.radius, ISLAND.height, 40, 6);
  sandGeo.translate(0, ISLAND.height / 2, 0);
  // ease the cone into a dome by pulling vertices toward islandHeight
  const p = sandGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const d = Math.hypot(x, z);
    p.setY(i, islandHeight(d));
  }
  sandGeo.computeVertexNormals();
  const sand = new THREE.Mesh(sandGeo, M.sand);
  sand.receiveShadow = true;
  g.add(sand);

  // an underwater skirt so no gap at the shoreline
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND.radius + 1, ISLAND.radius + 4, 4, 40), M.sandDark);
  skirt.position.y = -2;
  g.add(skirt);

  // Palms — remember three of them mark the treasure
  const palmSpots = [
    [-6, -5], [7, -3], [3, 8], [-9, 6], [11, 5], [-2, 11], [9, -9], [-11, -6],
  ];
  for (const [x, z] of palmSpots) {
    const pt = palmTree();
    pt.position.set(x, islandHeight(Math.hypot(x, z)), z);
    g.add(pt);
  }

  // "Three palms" landmark cluster near the treasure
  const cluster = [[13, -2], [14.5, 0.5], [12.5, 1.5]];
  for (const [x, z] of cluster) {
    const pt = palmTree();
    pt.position.set(x, islandHeight(Math.hypot(x, z)), z);
    pt.scale.set(1.1, 1.1, 1.1);
    g.add(pt);
  }

  // Rocks
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 8 + Math.random() * 10;
    const r = rock(0.6 + Math.random() * 0.8);
    r.position.set(Math.cos(a) * d, islandHeight(d) + 0.2, Math.sin(a) * d);
    g.add(r);
  }

  g.userData.treasureLocal = new THREE.Vector3(13.3, 0, 0); // between the three palms
  return g;
}

// ---------------------------------------------------------------------------
// A fish (used in the fishing mini-game) — a flat dark shadow under the water
// plus a little body so a caught fish reads.
// ---------------------------------------------------------------------------
export function createFish(color = 0x6fd0e0) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 10, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.15 })
  );
  body.scale.set(1.6, 0.7, 0.7);
  g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 4), new THREE.MeshStandardMaterial({ color }));
  tail.rotation.z = Math.PI / 2;
  tail.position.x = 0.9;
  g.add(tail);
  return g;
}

export { M as MATERIALS };
