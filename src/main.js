import { Game } from './game.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';

const canvas = document.getElementById('scene');
const ui = new UI();
const audio = new Audio();

let game = null;

function boot() {
  game = new Game({ canvas, ui, audio });
  window.__game = game; // handy for debugging
}

// Menu -> briefing -> play
document.getElementById('play-btn').addEventListener('click', () => {
  audio.unlock();
  ui.hide('menu');
  if (!game) boot();
  game.showBriefing();
});

document.getElementById('begin-btn').addEventListener('click', () => {
  audio.unlock();
  game.begin();
});

document.getElementById('map-btn').addEventListener('click', () => game.dismissMap());

document.getElementById('resume-btn').addEventListener('click', () => {
  ui.hide('pause');
  game.player.lock();
});

for (const id of ['replay-btn', 'replay-btn-2']) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', () => window.location.reload());
}

// Show a hint if WebGL is unavailable
try {
  const test = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
  if (!test) document.getElementById('webgl-warn').classList.remove('hidden');
} catch (e) {
  document.getElementById('webgl-warn').classList.remove('hidden');
}
