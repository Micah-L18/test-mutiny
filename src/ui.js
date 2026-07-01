// Thin wrapper over the HUD/overlay DOM defined in index.html. The game talks to
// the screen only through this object.
export class UI {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this._toastTimer = null;
  }

  show(id) { this.el(id).classList.remove('hidden'); }
  hide(id) { this.el(id).classList.add('hidden'); }
  setHTML(id, html) { this.el(id).innerHTML = html; }
  setText(id, text) { this.el(id).textContent = text; }

  // ---- HUD ----
  setObjective(title, detail) {
    this.el('obj-title').textContent = title;
    this.el('obj-detail').textContent = detail || '';
  }

  setPhaseTag(text) { this.el('phase-tag').textContent = text; }

  setMutiny(pct) {
    pct = Math.max(0, Math.min(100, pct));
    const r = Math.round(pct);
    if (r === this._lastMutiny) return; // skip redundant per-frame DOM writes
    this._lastMutiny = r;
    this.el('mutiny-fill').style.width = pct + '%';
    this.el('mutiny-val').textContent = r + '%';
    this.el('mutiny-bar').classList.toggle('danger', pct >= 70);
  }

  setSuspicion(pct, visible) {
    const wrap = this.el('suspicion-wrap');
    if (!visible) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    pct = Math.max(0, Math.min(100, pct));
    const r = Math.round(pct);
    if (r === this._lastSus) return;
    this._lastSus = r;
    this.el('suspicion-fill').style.width = pct + '%';
  }

  setFish(n, total, visible) {
    const w = this.el('fish-wrap');
    if (!visible) { if (this._fishVis !== false) { w.classList.add('hidden'); this._fishVis = false; } return; }
    if (this._fishVis !== true) { w.classList.remove('hidden'); this._fishVis = true; }
    const key = n + '/' + total;
    if (key === this._lastFish) return;
    this._lastFish = key;
    this.el('fish-val').textContent = `${n} / ${total}`;
  }

  setTimer(seconds, visible) {
    const w = this.el('timer-wrap');
    if (!visible) { if (this._timerVis !== false) { w.classList.add('hidden'); this._timerVis = false; } return; }
    if (this._timerVis !== true) { w.classList.remove('hidden'); this._timerVis = true; }
    const s = Math.ceil(Math.max(0, seconds));
    if (s === this._lastTimer) return;
    this._lastTimer = s;
    this.el('timer-val').textContent = s.toString();
  }

  // ---- interaction prompt + hold ring ----
  setPrompt(text) {
    if (text === this._lastPrompt) return; // avoid rewriting innerHTML every frame
    this._lastPrompt = text;
    const p = this.el('prompt');
    if (!text) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    this.el('prompt-text').innerHTML = text;
  }

  setHold(frac) {
    const deg = frac <= 0 ? -1 : Math.min(360, Math.round(frac * 360));
    if (deg === this._lastHoldDeg) return;
    this._lastHoldDeg = deg;
    const ring = this.el('hold-ring');
    if (deg < 0) { ring.classList.add('hidden'); return; }
    ring.classList.remove('hidden');
    ring.style.background =
      `conic-gradient(#ffd76a ${deg}deg, rgba(255,255,255,0.12) ${deg}deg)`;
  }

  crosshair(visible) { this.el('crosshair').classList.toggle('hidden', !visible); }

  toast(msg, ms = 2600) {
    const t = this.el('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
  }

  // ---- big overlays ----
  showBriefing(role, objective, tip) {
    const card = this.el('role-card');
    card.classList.toggle('mutineer', role === 'MUTINEER');
    this.el('role-name').textContent = role === 'MUTINEER' ? 'MUTINEER' : 'CREWMATE';
    this.el('role-sub').textContent = role === 'MUTINEER'
      ? 'The crew is no longer your friend.'
      : 'Find the treasure — and trust no one.';
    this.el('role-objective').textContent = objective;
    this.el('role-tip').textContent = tip;
    this.show('briefing');
  }

  showMap(hint, isMutineer) {
    this.el('map-hint').textContent = hint;
    const warn = this.el('map-warn');
    warn.textContent = isMutineer
      ? 'The Mutiny Map is yours. Fill the mutiny meter before they dig.'
      : 'One clue was a MUTINY MAP — a traitor sails with us. Hurry.';
    warn.classList.toggle('mutineer', !!isMutineer);
    this.show('map-overlay');
  }

  showEnd(win, title, detail) {
    this.el('end-title').textContent = title;
    this.el('end-title').className = win ? 'win' : 'lose';
    this.el('end-detail').innerHTML = detail;
    this.show('end');
  }

  fade(on) { this.el('fade').classList.toggle('show', on); }
}
