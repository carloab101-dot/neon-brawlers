/**
 * NEON PAW — 3D arena duel, embeddable module.
 * A floating 3D tile board in one of four arenas (Chrome Canopy, Neon Megacity, Cyber Shrine, Data Core); two collectables take turns hopping and striking lit tiles.
 *
 *   import { mountForest } from "./fight-forest/forest.mjs";
 *   const duel = mountForest(el, SAMPLE_CATS, { THREE });   // pass the page's THREE to share one copy (optional)
 *   duel.destroy();
 *
 * Returns { ready: Promise, destroy(), setFighters(l, r), setArena(name|0-3), fight(), getState() }.  opts.onEnd({winner, loser, winnerSide, turns}).
 * opts.arena: 'canopy' | 'megacity' | 'shrine' | 'datacore' (or 0–3), default 'canopy'.
 * Character fields used: name (required), hue, speed, weight, aesthetics (0–100), location, id.
 * Without opts.THREE it loads ./three.module.min.js (Three.js r160, same version as the site's import map).
 */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, k) => a + (b - a) * k, rr = (a, b) => a + Math.random() * (b - a);
const easeOut = k => 1 - (1 - k) * (1 - k);
function mulberry(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hsl = (h, s, l, a) => "hsla(" + Math.round(((h % 360) + 360) % 360) + "," + s + "%," + l + "%," + (a == null ? 1 : a) + ")";
const hslC = (h, s, l) => "hsl(" + Math.round(((h % 360) + 360) % 360) + ", " + s + "%, " + l + "%)";   // THREE.Color-parsable

/* ======================= characters ======================= */
const LBL = { slash: "Claw", dash: "Dash", wall: "Pulse", bomb: "Drop", beam: "Beam", petal: "Swarm" };
function prep(c, i) {
  c = c || {};
  const stat = v => { v = +v; return isFinite(v) ? clamp(v, 1, 100) : 60; };
  const name = String(c.name || "Fighter " + (i + 1)), h = hash(name);
  const hue = isFinite(+c.hue) ? ((+c.hue % 360) + 360) % 360 : h % 360;
  const words = name.split(/\s+/).filter(Boolean), w1 = words[0] || name, w2 = words[1] || w1;
  const p = { src: c, idx: i, name, short: w1, location: c.location ? String(c.location) : "", speed: stat(c.speed), weight: stat(c.weight), aesthetics: stat(c.aesthetics), hue };
  const top = p.speed >= p.weight && p.speed >= p.aesthetics ? "speed" : p.weight >= p.aesthetics ? "weight" : "aesthetics";
  p.look = { ear: h % 3, pat: (h >>> 2) % 4, tail: (h >>> 4) % 2, eyes: (h >>> 6) % 3, acc: (hue + (((h >>> 8) & 1) ? 150 : 200)) % 360, bulk: .84 + p.weight / 100 * .36, top };
  p.maxHp = Math.round(100 + p.weight * .8);
  p.steps = p.speed >= 85 ? 3 : p.speed >= 58 ? 2 : 1;
  const k0 = p.speed >= 80 ? "dash" : "slash", k1 = p.weight >= 70 ? "bomb" : "wall", k2 = p.aesthetics >= 88 ? "petal" : "beam";
  p.moves = [
    { kind: k0, name: w1 + " " + LBL[k0], base: 20 + p.speed * .25 + (k0 === "dash" ? 3 : 0), w: p.speed * p.speed, col: hslC(hue, 95, 62) },
    { kind: k1, name: w2 + " " + LBL[k1], base: 18 + p.weight * .3, w: p.weight * p.weight, col: hslC(p.look.acc, 100, 62) },
    { kind: k2, name: w2 + " " + LBL[k2], base: 18 + p.aesthetics * .25, w: p.aesthetics * p.aesthetics, col: hslC((hue + 40) % 360, 100, 70) }
  ];
  return p;
}
function faceSVG(p) {
  const L = p.look, c = hsl(p.hue, 90, 60), d = hsl(p.hue, 70, 26), a = hsl(L.acc, 100, 66);
  const ears = L.ear === 0 ? `<polygon points="18,28 28,8 34,28" fill="${c}"/><polygon points="62,28 52,8 46,28" fill="${c}"/>`
    : L.ear === 1 ? `<circle cx="24" cy="26" r="9" fill="${c}"/><circle cx="56" cy="26" r="9" fill="${c}"/>`
    : `<polygon points="16,30 22,2 34,28" fill="${c}"/><polygon points="64,30 58,2 46,28" fill="${c}"/>`;
  const eyes = L.eyes === 0 ? `<rect x="20" y="40" width="40" height="9" rx="3" fill="#0a0e17"/><rect x="22" y="42" width="36" height="3" fill="${a}"/>`
    : `<rect x="24" y="39" width="10" height="10" fill="#0a0e17"/><rect x="46" y="39" width="10" height="10" fill="#0a0e17"/><rect x="29" y="40" width="3" height="3" fill="${a}"/><rect x="51" y="40" width="3" height="3" fill="${a}"/>` +
      (L.eyes === 2 ? `<circle cx="51" cy="44" r="9" fill="none" stroke="${a}" stroke-width="2"/>` : "");
  return `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${ears}<rect x="12" y="26" width="56" height="42" rx="7" fill="${c}" stroke="${a}" stroke-width="2"/>${eyes}<rect x="36" y="53" width="8" height="4" fill="${d}"/></svg>`;
}

/* ======================= board + tactics (instance-free helpers) ======================= */
function sqBoard(w, h, blk, start) {
  const B = { w, h, cells: [], blocked: new Set(blk), start }, D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const K = (x, y) => x + "," + y, P = k => k.split(",").map(Number);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) B.cells.push(K(x, y));
  B.has = k => { const [x, y] = P(k); return x >= 0 && y >= 0 && x < w && y < h; };
  B.step = (k, d) => { const [x, y] = P(k), n = K(x + D[d][0], y + D[d][1]); return B.has(n) ? n : null; };
  B.nb = k => [0, 1, 2, 3].map(d => B.step(k, d)).filter(Boolean);
  B.dist = (a, b) => { const [ax, ay] = P(a), [bx, by] = P(b); return Math.abs(ax - bx) + Math.abs(ay - by); };
  B.dir = (a, b) => { const [ax, ay] = P(a), [bx, by] = P(b), dx = bx - ax, dy = by - ay; if ((dx && dy) || (!dx && !dy)) return -1; return dx > 0 ? 0 : dx < 0 ? 1 : dy > 0 ? 2 : 3; };
  B.plus = k => [k].concat(B.nb(k));
  B.blast = k => { const [x, y] = P(k), o = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const n = K(x + dx, y + dy); if (B.has(n)) o.push(n); } return o; };
  B.pos = k => { const [x, y] = P(k); return { x, y }; };
  return B;
}
function lineFrom(B, k, d, max) { const o = []; let c = k; for (let i = 0; i < (max || 99); i++) { c = B.step(c, d); if (!c) break; o.push(c); } return o; }
function req(kind, B, from, to) {
  const md = B.dist(from, to), al = B.dir(from, to) >= 0;
  switch (kind) {
    case "slash": return md === 1 ? 0 : 10 + md;
    case "petal": return md >= 2 && md <= 4 ? 0 : 5 + Math.abs(md - 3);
    case "dash": return al && md >= 2 && md <= 5 ? 0 : 6 + (al ? 0 : 3) + Math.abs(md - 3);
    case "beam": return al ? 0 : 7 + md * .2;
    case "wall": return md <= 2 ? 0 : 4 + md;
    case "bomb": return md >= 1 ? 0 : 3;
  }
  return 0;
}
const BLOCKED = ["1,4", "4,1"], SP = 1.18;

/* ======================= styles ======================= */
const CSS = `
.npfo{--c:#7df9ff;--m:#ff2bd6;--bg:#070b12;--glass:rgba(13,20,32,.62);--line:rgba(125,249,255,.22);--txt:#e8f0ff;--mut:#8aa0c0;position:relative;width:100%;color:var(--txt);
 font-family:"Segoe UI",system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
.npfo *,.npfo *::before,.npfo *::after{box-sizing:border-box}
.npfo-stage{position:relative;width:100%;height:360px;border-radius:16px;overflow:hidden;background:#0a0418;border:1px solid var(--line);
 box-shadow:0 0 0 1px rgba(255,43,214,.08),0 10px 40px rgba(0,0,0,.45),0 0 28px rgba(125,249,255,.08)}
.npfo-stage canvas{display:block;width:100%!important;height:100%!important;touch-action:none;cursor:grab}
.npfo-stage canvas:active{cursor:grabbing}
.npfo-load{position:absolute;inset:0;display:grid;place-items:center;color:var(--mut);font-size:13px;letter-spacing:2px}
.npfo-hud{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.npfo-cards{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;padding:10px;align-items:flex-start}
.npfo-card{flex:1;min-width:0;display:flex;gap:9px;align-items:center;padding:7px 10px;border-radius:12px;background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:box-shadow .25s,border-color .25s}
.npfo-card[data-side="0"]{border-color:rgba(125,249,255,.4)}.npfo-card[data-side="1"]{flex-direction:row-reverse;text-align:right;border-color:rgba(255,43,214,.4)}
.npfo-card.is-act[data-side="0"]{border-color:var(--c);box-shadow:0 0 16px rgba(125,249,255,.45)}.npfo-card.is-act[data-side="1"]{border-color:var(--m);box-shadow:0 0 16px rgba(255,43,214,.45)}
.npfo-face{flex:none;width:38px;height:38px;border-radius:9px;background:rgba(0,0,0,.35);display:grid;place-items:center}.npfo-face svg{width:32px;height:32px}
.npfo-info{flex:1;min-width:0}
.npfo-name{font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.npfo-sub{font-size:10.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.npfo-sub b{color:var(--txt)}
.npfo-hp{position:relative;height:10px;margin-top:4px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden;border:1px solid rgba(255,255,255,.12)}
.npfo-hp i{position:absolute;top:0;bottom:0;left:0;border-radius:6px}.npfo-card[data-side="1"] .npfo-hp i{left:auto;right:0}
.npfo-hp .lag{background:rgba(255,255,255,.75)}.npfo-hp.is-low .fill{background:linear-gradient(90deg,#ff4d6d,#ff2bd6)!important}
.npfo-num{display:block;font:700 10px/1 ui-monospace,Menlo,Consolas,monospace;color:var(--mut);margin-top:3px}
.npfo-vs{flex:none;align-self:center;font-weight:900;font-size:13px;letter-spacing:2px;color:#fff;text-shadow:0 0 8px var(--c),0 0 14px var(--m)}
.npfo-co{position:absolute;top:78px;font-weight:900;font-style:italic;font-size:18px;color:#fff;white-space:nowrap;opacity:0;text-shadow:0 0 10px var(--c)}
.npfo-co[data-side="0"]{left:14px}.npfo-co[data-side="1"]{right:14px;text-shadow:0 0 10px var(--m)}
.npfo-dm{position:absolute;transform:translate(-50%,-50%);font-weight:900;font-style:italic;font-size:26px;color:#fff;white-space:nowrap;text-shadow:0 0 8px var(--m),0 2px 0 rgba(0,0,0,.6)}
.npfo-dm.m{font-size:16px;text-shadow:0 0 8px var(--c)}.npfo-dm.c{color:#ffc14a}
.npfo-big{position:absolute;left:50%;top:55%;transform:translate(-50%,-50%) scale(.6);opacity:0;text-align:center;white-space:nowrap;font-weight:900;letter-spacing:4px;
 font-size:clamp(28px,8vw,58px);color:#fff;text-shadow:0 0 10px var(--c),0 0 26px var(--m);transition:opacity .25s,transform .35s cubic-bezier(.2,1.6,.4,1)}
.npfo-big.is-on{opacity:1;transform:translate(-50%,-50%) scale(1)}.npfo-big small{display:block;font-size:.34em;letter-spacing:3px;margin-top:6px}
.npfo-ft{position:absolute;left:0;right:0;bottom:8px;text-align:center;font-size:11px;color:rgba(232,240,255,.7);text-shadow:0 0 4px #000;letter-spacing:.5px}
.npfo-bar{display:flex;align-items:center;gap:12px;margin:12px 0 10px}
.npfo-go{all:unset;box-sizing:border-box;flex:none;cursor:pointer;min-width:132px;min-height:46px;padding:0 22px;border-radius:999px;text-align:center;font-weight:900;letter-spacing:3px;font-size:15px;line-height:46px;color:#070b12;
 background:linear-gradient(90deg,var(--c),var(--m));box-shadow:0 0 18px rgba(255,43,214,.35),0 0 18px rgba(125,249,255,.25);transition:transform .12s,filter .2s}
.npfo-go:hover{filter:brightness(1.1)}.npfo-go:active{transform:scale(.96)}.npfo-go:focus-visible,.npfo-mu:focus-visible,.npfo-chip:focus-visible{outline:2px solid #fff;outline-offset:2px}.npfo-go[disabled]{opacity:.55;cursor:default;filter:saturate(.4)}
.npfo-log{flex:1;min-width:0;margin:0;font-size:13px;color:var(--mut);line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.npfo-log b{color:var(--txt)}
.npfo-mu{all:unset;box-sizing:border-box;flex:none;cursor:pointer;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-size:18px;background:var(--glass);border:1px solid var(--line);color:var(--mut)}
.npfo-mu[aria-pressed="true"]{color:#fff;border-color:var(--c);box-shadow:0 0 12px rgba(125,249,255,.4)}
.npfo-picks{display:grid;gap:8px}
.npfo-arenas{display:flex;align-items:center;gap:7px;margin:0 0 8px;padding:6px 8px;border-radius:14px;background:var(--glass);border:1px solid var(--line)}
.npfo-atag{flex:none;font:900 10px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:1.5px;color:var(--mut)}
.npfo-achs{flex:1;min-width:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}
.npfo-ach{all:unset;box-sizing:border-box;cursor:pointer;min-width:0;height:34px;padding:0 4px;border-radius:999px;text-align:center;font-size:11px;font-weight:800;letter-spacing:.2px;line-height:32px;color:#1b2130;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:linear-gradient(180deg,#f6f8fc 0%,#b9c2d3 44%,#e6ebf3 56%,#8a94a8 100%);border:1px solid rgba(255,255,255,.55);box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 1px 3px rgba(0,0,0,.45);opacity:.62;filter:saturate(.6);transition:opacity .15s,box-shadow .15s,transform .1s}
.npfo-ach:hover{opacity:.85}.npfo-ach:active{transform:scale(.95)}.npfo-ach:focus-visible{outline:2px solid #fff;outline-offset:2px}
.npfo-ach[aria-pressed="true"]{opacity:1;filter:none;box-shadow:inset 0 1px 0 #fff,0 0 0 2px var(--c),0 0 14px rgba(125,249,255,.55)}
.npfo-flash{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 55%,rgba(255,255,255,.95),rgba(125,249,255,.55) 45%,rgba(255,43,214,.35) 100%);transition:opacity .55s ease-out}.npfo-flash.is-on{opacity:1;transition:none}
.npfo-pick{display:flex;align-items:center;gap:8px;padding:8px;border-radius:14px;background:var(--glass);border:1px solid var(--line)}
.npfo-lbl{flex:none;width:30px;text-align:center;font-weight:900;font-size:12px;letter-spacing:1px}
.npfo-pick[data-side="0"] .npfo-lbl{color:var(--c);text-shadow:0 0 8px var(--c)}.npfo-pick[data-side="1"] .npfo-lbl{color:var(--m);text-shadow:0 0 8px var(--m)}
.npfo-chips{flex:1;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}
.npfo-chip{all:unset;box-sizing:border-box;cursor:pointer;min-height:48px;border-radius:10px;padding:5px 2px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.1);transition:border-color .15s,background .15s,transform .1s}
.npfo-chip svg{width:26px;height:26px}.npfo-chip span{font-size:10px;font-weight:700;color:var(--mut);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px}
.npfo-chip:hover{background:rgba(255,255,255,.06)}.npfo-chip:active{transform:scale(.95)}
.npfo-pick[data-side="0"] .npfo-chip[aria-pressed="true"]{border-color:var(--c);background:rgba(125,249,255,.12);box-shadow:0 0 12px rgba(125,249,255,.35)}
.npfo-pick[data-side="1"] .npfo-chip[aria-pressed="true"]{border-color:var(--m);background:rgba(255,43,214,.12);box-shadow:0 0 12px rgba(255,43,214,.35)}
.npfo-chip[aria-pressed="true"] span{color:var(--txt)}
.npfo--narrow .npfo-cards{padding:7px;gap:5px}.npfo--narrow .npfo-card{padding:6px 7px;gap:6px}.npfo--narrow .npfo-face{width:28px;height:28px}.npfo--narrow .npfo-face svg{width:24px;height:24px}
.npfo--narrow .npfo-name{font-size:12px}.npfo--narrow .npfo-sub{display:none}.npfo--narrow .npfo-vs{font-size:11px;letter-spacing:1px}.npfo--narrow .npfo-co{top:62px;font-size:14px}
.npfo--narrow .npfo-dm{font-size:20px}.npfo--narrow .npfo-bar{gap:8px}.npfo--narrow .npfo-go{min-width:108px;padding:0 14px;font-size:14px}.npfo--narrow .npfo-log{font-size:12px}
.npfo--narrow .npfo-chip span{font-size:9px}.npfo--narrow .npfo-pick{padding:6px;gap:5px}.npfo--narrow .npfo-lbl{width:22px;font-size:11px}.npfo--narrow .npfo-chips{gap:4px}
.npfo--narrow .npfo-arenas{padding:5px 6px;gap:5px}.npfo--narrow .npfo-atag{font-size:9px;letter-spacing:.5px}.npfo--narrow .npfo-achs{gap:4px}.npfo--narrow .npfo-ach{font-size:10px;padding:0 2px}`;
let styleRefs = 0;
function addStyle(doc) { styleRefs++; if (!doc.getElementById("npfo-style")) { const s = doc.createElement("style"); s.id = "npfo-style"; s.textContent = CSS; doc.head.appendChild(s); } }
/* page-zoom guard while a duel is mounted: viewport meta gets maximum-scale=1,user-scalable=no (original restored on destroy),
   iOS Safari gesture* events and multi-touch touchmove are cancelled so a two-finger pinch zooms the 3D camera instead of the page */
const zoomGuards = new Map();
function addZoomGuard(doc) {
  let g = zoomGuards.get(doc); if (g) { g.refs++; return; }
  let meta = doc.querySelector('meta[name="viewport"]'), created = false;
  if (!meta) { meta = doc.createElement("meta"); meta.name = "viewport"; doc.head.appendChild(meta); created = true; }
  const orig = meta.getAttribute("content");
  const keep = (orig || "width=device-width, initial-scale=1").split(",").map(x => x.trim()).filter(x => x && !/^(maximum-scale|user-scalable)\s*=/i.test(x));
  meta.setAttribute("content", keep.concat(["maximum-scale=1", "user-scalable=no"]).join(", "));
  const stop = e => e.preventDefault(), multi = e => { if (e.touches && e.touches.length > 1) e.preventDefault(); };
  for (const n of ["gesturestart", "gesturechange", "gestureend"]) doc.addEventListener(n, stop, { passive: false });
  doc.addEventListener("touchmove", multi, { passive: false });
  zoomGuards.set(doc, { refs: 1, meta, orig, created, stop, multi });
}
function dropZoomGuard(doc) {
  const g = zoomGuards.get(doc); if (!g || --g.refs > 0) return; zoomGuards.delete(doc);
  for (const n of ["gesturestart", "gesturechange", "gestureend"]) doc.removeEventListener(n, g.stop, { passive: false });
  doc.removeEventListener("touchmove", g.multi, { passive: false });
  if (g.created) g.meta.remove(); else if (g.orig == null) g.meta.removeAttribute("content"); else g.meta.setAttribute("content", g.orig);
}
function dropStyle(doc) { styleRefs = Math.max(0, styleRefs - 1); if (!styleRefs) { const s = doc.getElementById("npfo-style"); if (s) s.remove(); } }

/* ======================= Three.js loading ======================= */
let localThree = null;
function getThree(opts) {
  if (opts.THREE && opts.THREE.WebGLRenderer) return Promise.resolve(opts.THREE);
  return localThree || (localThree = import("./three.module.min.js"));
}


/* ======================= arenas (metadata; builders live inside mountForest) ======================= */
const ARENAS = [
  { key: "canopy", label: "Canopy", title: "Chrome Canopy" }, { key: "megacity", label: "Megacity", title: "Neon Megacity" },
  { key: "shrine", label: "Shrine", title: "Cyber Shrine" }, { key: "datacore", label: "Data Core", title: "Data Core" }
];
function arenaIndex(v) {
  if (typeof v === "number" || (typeof v === "string" && /^\s*\d+\s*$/.test(v))) { const n = Math.floor(+v); return n >= 0 && n < ARENAS.length ? n : -1; }
  if (typeof v !== "string") return -1; const s = v.toLowerCase().replace(/[^a-z]/g, ""); if (!s) return -1;
  return ARENAS.findIndex(a => a.key === s || a.title.toLowerCase().replace(/[^a-z]/g, "") === s || (s.length >= 4 && a.key.startsWith(s)));
}
/* ======================= optional music: one procedural Web Audio track per arena (ported from the cyber-forest soundtrack) ======================= */
function createMusic() {
  if (!(window.AudioContext || window.webkitAudioContext)) return null;
const MUS={ctx:null,master:null,out:null,conv:null,noise:null,vol:.7,muted:false,want:-1,tracks:[],timer:0,shape:null};
const mtof=m=>440*Math.pow(2,(m-69)/12);
function musNoise(ctx){const b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b;}
function musImpulse(ctx,sec,decay){const n=ctx.sampleRate*sec|0,b=ctx.createBuffer(2,n,ctx.sampleRate);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,decay);}return b;}
function musGraph(ctx){const G={ctx};G.noise=musNoise(ctx);G.comp=ctx.createDynamicsCompressor();G.comp.threshold.value=-14;G.comp.ratio.value=6;G.comp.attack.value=.002;G.comp.release.value=.2;G.master=ctx.createGain();G.master.gain.value=MUS.muted?0:MUS.vol*.8;
 G.dc=ctx.createBiquadFilter();G.dc.type='highpass';G.dc.frequency.value=25;G.master.connect(G.dc);G.dc.connect(G.comp);G.comp.connect(ctx.destination);G.conv=ctx.createConvolver();G.conv.buffer=musImpulse(ctx,2.4,3);G.revOut=ctx.createGain();G.revOut.gain.value=.9;G.conv.connect(G.revOut);G.revOut.connect(G.master);
 const k=new Float32Array(257);for(let i=0;i<257;i++){const x=i/128-1;k[i]=Math.tanh(x*4);}G.shape=k;return G;}
function env(g,t,a,peak,d,sus,r,len){const p=g.gain;p.setValueAtTime(0,t);p.linearRampToValueAtTime(peak,t+a);p.exponentialRampToValueAtTime(Math.max(1e-4,peak*sus),t+a+d);if(len!=null){p.setValueAtTime(Math.max(1e-4,peak*sus),t+len);p.exponentialRampToValueAtTime(1e-4,t+len+r);}}
function osc(ctx,type,f,t,stop){const o=ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(f,t);o.start(t);o.stop(stop);return o;}
function I_kick(T,t,v,hard){const c=T.ctx,o=osc(c,'sine',hard?180:150,t,t+.5),g=c.createGain();o.frequency.exponentialRampToValueAtTime(hard?38:45,t+.14);env(g,t,.002,v,.35,.001);
 if(hard){const ws=c.createWaveShaper();ws.curve=T.G.shape;o.connect(ws);ws.connect(g);}else o.connect(g);g.connect(T.bus);}
function I_noise(T,t,dur,type,f,q,v,send,dest){const c=T.ctx,s=c.createBufferSource();s.buffer=T.G.noise;const fl=c.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q||1;const g=c.createGain();env(g,t,.001,v,dur,.001);
 s.connect(fl);fl.connect(g);g.connect(dest||T.bus);if(send)g.connect(T.rev);s.start(t,Math.random()*1.5);s.stop(t+dur+.05);return fl;}
function I_snare(T,t,v,rev){I_noise(T,t,.18,'bandpass',1800,.8,v,rev);const c=T.ctx,o=osc(c,'triangle',210,t,t+.12),g=c.createGain();o.frequency.exponentialRampToValueAtTime(120,t+.1);env(g,t,.001,v*.6,.1,.001);o.connect(g);g.connect(T.bus);}
function I_hat(T,t,v,open){I_noise(T,t,open?.22:.045,'highpass',open?7000:9000,1,v);}
function I_tone(T,t,type,f,dur,v,o){o=o||{};const c=T.ctx,x=osc(c,type,f,t,t+dur+(o.r||.1)+.05),g=c.createGain();let n=x;if(o.det){x.detune.value=o.det;}
 if(o.lp){const fl=c.createBiquadFilter();fl.type='lowpass';fl.Q.value=o.q||1;fl.frequency.setValueAtTime(o.lp,t);if(o.lpEnv){fl.frequency.setValueAtTime(o.lpEnv,t);fl.frequency.exponentialRampToValueAtTime(o.lp,t+(o.lpD||.15));}n.connect(fl);n=fl;}
 if(o.bend){x.frequency.setValueAtTime(f*o.bend,t);x.frequency.exponentialRampToValueAtTime(f,t+.04);}
 if(o.vib){const l=osc(c,'sine',o.vib,t,t+dur+.6),lg=c.createGain();lg.gain.setValueAtTime(0,t);lg.gain.linearRampToValueAtTime(f*.012,t+dur*.7);l.connect(lg);lg.connect(x.frequency);}
 n.connect(g);env(g,t,o.a||.005,v,o.d||dur,o.s==null?.5:o.s,o.r||.1,o.len==null?dur:o.len);g.connect(T.bus);if(o.send)g.connect(T.rev);if(o.delay&&T.dly)g.connect(T.dly);return x;}
const TRACKS=[
 {name:'Chrome Canopy — dreamy synthwave',bpm:96,bars:16,lvl:1.6,delay:.469,rev:.5,
  step(T,s,t){const st=s%16,bar=Math.floor(s/16)%16,C=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]][bar%4],sd=T.sd;
   if(st===0){for(const n of C)for(const d of[-7,7])I_tone(T,t,'sawtooth',mtof(n),sd*16,.022,{det:d,a:.6,d:.5,s:.8,r:.8,len:sd*15,lp:1300,send:1});}
   const up=bar>=8?24:12,ord=[0,1,2,1][Math.floor(st/4)%4];I_tone(T,t,'square',mtof(C[(st+ord)%3]+up+(st%8>5?12:0)),.12,.035,{lp:2600,d:.12,s:.2,r:.08,delay:1,send:1});
   if(st%4===0||st===14)I_tone(T,t,'sawtooth',mtof(C[0]-24),sd*3,.09,{lp:420,lpEnv:1400,lpD:.12,d:.2,s:.5,r:.06});
   if(st===0||st===8||(bar%4===3&&st===10))I_kick(T,t,.9);if(st===4||st===12)I_snare(T,t,.35,1);if(st%2===0)I_hat(T,t,st%4===2?.12:.07);
   if(bar>=8){const mel=[76,-1,74,72,-1,71,72,-1,76,-1,79,-1,77,76,74,-1];const m=mel[(st+bar*3)%16];if(st%2===0&&m>0&&bar%2===0)I_tone(T,t,'triangle',mtof(m),sd*1.8,.06,{vib:5,a:.03,d:.3,s:.7,r:.4,delay:1,send:1});}}},
 {name:'Neon Megacity — driving darksynth',bpm:118,bars:16,lvl:.9,delay:.381,rev:.3,rain:true,
  step(T,s,t){const st=s%16,bar=Math.floor(s/16)%16,R_=[50,46,43,45][Math.floor(bar/2)%4],sd=T.sd;
   const oct=(st%4===2)?12:0;I_tone(T,t,'sawtooth',mtof(R_-12+oct),sd*.9,.11,{lp:180,lpEnv:1500+(bar%4)*300,lpD:.09,q:6,d:.1,s:.3,r:.05});
   I_tone(T,t,'square',mtof(R_-24),sd*.9,.05,{lp:260,d:.1,s:.5,r:.04});
   if(st%4===0)I_kick(T,t,1,true);if(st===4||st===12){I_snare(T,t,.45,1);I_noise(T,t+.01,.12,'bandpass',1200,2,.25,1);}
   I_hat(T,t,st%2?.09:.04);if(st===0){const ch=[R_,R_+3+(R_===45?1:0),R_+7];for(const n of ch)I_tone(T,t,'sawtooth',mtof(n),sd*30,.018,{det:(n%2?9:-9),a:.8,d:1,s:.8,r:1,len:sd*30,lp:900,send:1});}
   if(bar%2===1&&(st===0||st===3||st===6)){for(const n of[R_+12,R_+15+(R_===45?1:0),R_+19])I_tone(T,t,'sawtooth',mtof(n),.14,.03,{lp:2400,lpEnv:5000,d:.14,s:.1,r:.1,delay:1,send:1});}
   if(bar>=8&&st%8===0)I_tone(T,t,'sawtooth',mtof(R_+24+(st?7:0)),sd*6,.04,{vib:6,lp:3000,a:.02,d:.4,s:.6,r:.3,delay:1,send:1});}},
 {name:'Cyber Shrine — lo-fi koto & shakuhachi',bpm:78,bars:16,lvl:2.1,delay:.577,rev:.65,swing:.14,
  step(T,s,t){const st=s%16,bar=Math.floor(s/16)%16,SC=[62,63,67,69,72,74,75,79,81],sd=T.sd,Rn=mulberry(bar*31+st*7+1);
   if(st===0||st===10||(st===7&&bar%2))I_kick(T,t,.55);if(st===4||st===12)I_noise(T,t,.07,'bandpass',2400,3,.28,1);if(st%2===0)I_hat(T,t,.035+(st%4===2?.02:0));
   if(Math.random()<.25)I_noise(T,t+Math.random()*sd,.01,'highpass',3000,1,.05);  // vinyl crackle
   if([0,3,6,8,11,14].includes(st)&&Rn()<.85){const n=SC[(Math.floor(Rn()*6)+bar)%SC.length];I_tone(T,t,'triangle',mtof(n),.5,.08,{bend:1.03,a:.002,d:.6,s:.05,r:.3,send:1,delay:1});I_tone(T,t,'sine',mtof(n+12),.25,.03,{a:.002,d:.25,s:.05,r:.2});}
   if(st===0&&bar%4===0)for(const n of[50,57,60])I_tone(T,t,'sine',mtof(n),sd*60,.035,{a:1.5,d:2,s:.8,r:2,len:sd*60,send:1});
   const PH=[[0,6,4],[6,2,3],[8,8,2],[20,4,4],[24,6,5],[32,10,3],[44,4,2],[48,12,0]];if(bar%4===1||bar%4===2){const off=(bar%4===1?0:16)+st;for(const [o,l,i] of PH)if(o===off){const f=mtof(SC[i]+12);
    I_tone(T,t,'sine',f,sd*l,.07,{vib:5,a:.18,d:.4,s:.85,r:.35,len:sd*l,send:1});I_tone(T,t,'triangle',f,sd*l,.02,{a:.2,d:.4,s:.8,r:.3,len:sd*l});I_noise(T,t,sd*Math.min(l,3),'bandpass',f*2,6,.05,1);}}}},
 {name:'Data Core — industrial techno',bpm:136,bars:16,lvl:.8,delay:.331,rev:.25,
  step(T,s,t){const st=s%16,bar=Math.floor(s/16)%16,sd=T.sd,Rn=mulberry(bar*97+st*13+5),E=[40,41,43,45,47,48,50];
   if(st%4===0)I_kick(T,t,1.1,true);if(st%4===2)I_hat(T,t,.1,true);else I_hat(T,t,.04);
   if((bar>=2)&&(st===4||st===12)){I_noise(T,t,.1,'bandpass',1500,1.5,.35,1);I_noise(T,t+.012,.1,'bandpass',1100,1.5,.25);}
   if(Rn()<.35){const f=[540,720,810,1210][(Rn()*4)|0];const x=I_tone(T,t,'square',f,.05,.03,{d:.05,s:.1,r:.03});I_tone(T,t,'square',f*1.47,.05,.02,{d:.05,s:.1,r:.03});}
   const acc=Rn()<.3,n=E[[0,0,1,0,3,0,1,5,0,0,2,0,4,1,0,6][st]]+(acc?12:0);I_tone(T,t,'sawtooth',mtof(n-12),sd*.8,.09,{lp:300+400*(1+Math.sin(bar*.8)),lpEnv:acc?3500:1800,lpD:.1,q:14,d:.1,s:.3,r:.04});
   if(Math.random()<.07){const k=4;for(let i=0;i<k;i++)I_noise(T,t+i*sd/4,.02,'bandpass',rr(800,6000),8,.18);}
   if(Math.random()<.05)I_tone(T,t,'square',rr(200,2000),.03,.03,{d:.03,s:.1,r:.02,delay:1});
   if(bar%8===7){if(st===0){const fl=I_noise(T,t,sd*16,'highpass',400,4,.001);}if(st%2===0)I_noise(T,t,.08,'highpass',400+st*500,3,.02+st*.008,1);}
   if(st===0&&bar%4===0)for(const d of[-12,12])I_tone(T,t,'sawtooth',mtof(28),sd*62,.03,{det:d,a:.5,d:1,s:.8,r:1,len:sd*62,lp:220});}}];
function musStartTrack(G,i,t0,fadeIn){const ctx=G.ctx,D=TRACKS[i],T={ctx,G,def:D,i,sd:60/D.bpm/4,step:0,next:t0,alive:true};
 T.bus=ctx.createGain();T.bus.gain.setValueAtTime(fadeIn?0:1,t0);if(fadeIn)T.bus.gain.linearRampToValueAtTime(1,t0+fadeIn);T.trim=ctx.createGain();T.trim.gain.value=D.lvl||1;T.bus.connect(T.trim);T.trim.connect(G.master);
 T.rev=ctx.createGain();T.rev.gain.value=D.rev*(D.lvl||1);T.revGate=ctx.createGain();  // reverb send, gated by the same fade as the bus
 T.rev.connect(T.revGate);T.revGate.connect(G.conv);T.revGate.gain.setValueAtTime(fadeIn?0:1,t0);if(fadeIn)T.revGate.gain.linearRampToValueAtTime(1,t0+fadeIn);
 T.dly=ctx.createDelay(1);T.dly.delayTime.value=D.delay;const fb=ctx.createGain();fb.gain.value=.35;const dl=ctx.createGain();dl.gain.value=.35;T.dly.connect(fb);fb.connect(T.dly);T.dly.connect(dl);dl.connect(T.bus);T.dlyNodes=[fb,dl];
 if(D.rain){const s=ctx.createBufferSource();s.buffer=G.noise;s.loop=true;const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=500;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=4500;const g=ctx.createGain();g.gain.value=.07;
  s.connect(hp);hp.connect(lp);lp.connect(g);g.connect(T.bus);s.start(t0);T.rainSrc=s;}
 return T;}
function musSchedule(T,until){while(T.next<until){const st=T.step%16;let t=T.next;if(T.def.swing&&st%2===1)t+=T.sd*T.def.swing;try{T.def.step(T,T.step,t);}catch(e){console.error(e);}T.step++;T.next+=T.sd;}}
function musFadeOut(T,dur){const c=T.ctx,t=c.currentTime;for(const g of[T.bus.gain,T.revGate.gain]){g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(0,t+dur);}T.alive=false;T.end=t+dur;
 if(T.rainSrc)T.rainSrc.stop(t+dur+.05);}
function musFree(T){for(const n of[T.bus,T.trim,T.rev,T.revGate,T.dly,...T.dlyNodes])try{n.disconnect();}catch(_){}}
function musTick(){const G=MUS.G;if(!G)return;const now=G.ctx.currentTime;for(const T of MUS.tracks){if(T.alive)musSchedule(T,now+.15);}
 MUS.tracks=MUS.tracks.filter(T=>{if(!T.alive&&now>T.end+.3){musFree(T);return false;}return true;});
 if(!MUS.tracks.length&&MUS.cur<0&&G.ctx.state==='running'&&now>(MUS.idleAt||0)+1.5)G.ctx.suspend();}   // idle outside v3 -> suspend (zero audio CPU)
MUS.unlock=function(){if(MUS.G)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;try{const ctx=new AC();MUS.G=musGraph(ctx);MUS.ctx=ctx;if(ctx.state==='suspended')ctx.resume();
 MUS.timer=setInterval(musTick,25);if(MUS.want>=0){const w=MUS.want;MUS.want=-1;MUS.play(w);}}catch(e){console.error(e);}};
MUS.play=function(i){if(!MUS.G){MUS.want=i;return;}const G=MUS.G,ctx=G.ctx;if(ctx.state==='suspended')ctx.resume();const cur=MUS.tracks.find(T=>T.alive);if(cur&&cur.i===i)return;
 if(cur)musFadeOut(cur,1.6);const T=musStartTrack(G,i,ctx.currentTime+.05,cur?1.6:.8);MUS.tracks.push(T);MUS.cur=i;};
MUS.stop=function(){MUS.want=-1;if(!MUS.G)return;MUS.idleAt=MUS.G.ctx.currentTime;for(const T of MUS.tracks)if(T.alive)musFadeOut(T,.6);MUS.cur=-1;};
MUS.setVol=function(v){MUS.vol=v;if(MUS.G){const g=MUS.G.master.gain,t=MUS.G.ctx.currentTime;g.cancelScheduledValues(t);g.setTargetAtTime(MUS.muted?0:v*.8,t,.05);}};
MUS.toggleMute=function(){MUS.muted=!MUS.muted;MUS.setVol(MUS.vol);};
MUS.sfx=function(kind,big){if(!MUS.G||MUS.cur<0)return;const G=MUS.G,T={ctx:G.ctx,G,bus:G.master,rev:G.conv,sd:.1},t=G.ctx.currentTime+.01;
 if(kind==='hit'){I_noise(T,t,big?.3:.16,'bandpass',big?900:1600,1.2,big?.5:.35,1);I_tone(T,t,'square',big?160:320,.12,.12,{lp:1800,d:.12,s:.1,r:.05,bend:2});}
 if(kind==='miss')I_tone(T,t,'sine',900,.1,.06,{bend:.6,d:.1,s:.1,r:.05});};
MUS.renderOffline=async function(i,sec){const ctx=new OfflineAudioContext(2,44100*sec,44100);const G=musGraph(ctx);const T=musStartTrack(G,i,0,0);musSchedule(T,sec);const buf=await ctx.startRendering();const d=buf.getChannelData(0);let s=0,p=0;for(let k=0;k<d.length;k++){s+=d[k]*d[k];p=Math.max(p,Math.abs(d[k]));}
 return {track:TRACKS[i].name,rms:+Math.sqrt(s/d.length).toFixed(4),peak:+p.toFixed(3)};};

  MUS.vol = .6; MUS.unlock();
  if (!MUS.G) return null;
  let on = false, cur = 0;
  return {
    get on() { return on; },
    set(v, arena) { on = v; if (arena != null) cur = arena; if (v) { if (MUS.G.ctx.state === "suspended") MUS.G.ctx.resume(); if (!MUS.timer) MUS.timer = setInterval(musTick, 25); MUS.play(cur); } else MUS.stop(); },
    track(i) { cur = i; if (on) MUS.play(i); },
    pause() { if (MUS.timer) { clearInterval(MUS.timer); MUS.timer = 0; } if (MUS.G.ctx.state === "running") MUS.G.ctx.suspend(); },
    resume() { if (!on) return; MUS.G.ctx.resume(); if (!MUS.timer) MUS.timer = setInterval(musTick, 25); },
    hit(big) { if (on) MUS.sfx("hit", big); },
    close() { if (MUS.timer) clearInterval(MUS.timer); MUS.timer = 0; MUS.tracks.forEach(musFree); MUS.tracks = []; return MUS.G.ctx.close(); },
    renderOffline: MUS.renderOffline, get ctx() { return MUS.G.ctx; }
  };
}

/* ======================= mount ======================= */
export function mountForest(container, characters, opts) {
  opts = opts || {};
  if (!container || !container.appendChild) throw new Error("mountForest: containerEl is required");
  const list = (Array.isArray(characters) ? characters : []).slice(0, 12).map(prep);
  if (!list.length) throw new Error("mountForest: characters array is empty");
  const doc = container.ownerDocument || document, win = doc.defaultView || window;
  addStyle(doc); addZoomGuard(doc);
  const reduce = !!(win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const speedMul = clamp(+opts.speed || 1, .25, 8);
  const showMusic = opts.music !== false;
  let arenaI = Math.max(0, arenaIndex(opts.arena != null ? opts.arena : 0));

  /* ---------- DOM ---------- */
  const el = doc.createElement("div"); el.className = "npfo";
  const chips = side => list.map((p, i) => `<button type="button" class="npfo-chip" data-i="${i}" aria-pressed="false" title="${esc(p.name)}" aria-label="${side ? "Right" : "Left"} fighter: ${esc(p.name)}">${faceSVG(p)}<span>${esc(p.short)}</span></button>`).join("");
  const card = s => `<div class="npfo-card" data-side="${s}"><div class="npfo-face"></div><div class="npfo-info"><div class="npfo-name"></div><div class="npfo-sub"></div><div class="npfo-hp"><i class="lag"></i><i class="fill"></i></div><span class="npfo-num"></span></div></div>`;
  el.innerHTML = `<div class="npfo-stage"><div class="npfo-load">LOADING ${ARENAS[arenaI].title.toUpperCase()}…</div><div class="npfo-hud"><div class="npfo-flash"></div><div class="npfo-cards">${card(0)}<div class="npfo-vs">VS</div>${card(1)}</div>` +
    `<div class="npfo-co" data-side="0"></div><div class="npfo-co" data-side="1"></div><div class="npfo-big" aria-hidden="true"></div><div class="npfo-ft">drag to orbit · pinch to zoom · tap the arena to fight</div></div></div>` +
    `<div class="npfo-bar"><button type="button" class="npfo-go">FIGHT</button><p class="npfo-log" aria-live="polite"></p>${showMusic ? '<button type="button" class="npfo-mu" aria-pressed="false" aria-label="Music on/off" title="Music">♪</button>' : ""}</div>` +
    `<div class="npfo-arenas"><span class="npfo-atag">ARENA</span><div class="npfo-achs" role="group" aria-label="Choose arena">${ARENAS.map((a, i) => `<button type="button" class="npfo-ach" data-a="${i}" aria-pressed="${i === arenaI}" title="${a.title}">${a.label}</button>`).join("")}</div></div>` +
    `<div class="npfo-picks"><div class="npfo-pick" data-side="0"><span class="npfo-lbl">P1</span><div class="npfo-chips" role="group" aria-label="Choose left fighter">${chips(0)}</div></div>` +
    `<div class="npfo-pick" data-side="1"><span class="npfo-lbl">P2</span><div class="npfo-chips" role="group" aria-label="Choose right fighter">${chips(1)}</div></div></div>`;
  container.appendChild(el);
  const q = s => el.querySelector(s);
  const stage = q(".npfo-stage"), hud = q(".npfo-hud"), big = q(".npfo-big"), goBtn = q(".npfo-go"), logEl = q(".npfo-log"), muBtn = q(".npfo-mu"), loadEl = q(".npfo-load"), flashEl = q(".npfo-flash");
  const cards = [0, 1].map(s => { const c = el.querySelector(`.npfo-card[data-side="${s}"]`); return { root: c, face: c.querySelector(".npfo-face"), name: c.querySelector(".npfo-name"), sub: c.querySelector(".npfo-sub"), hp: c.querySelector(".npfo-hp"), fill: c.querySelector(".fill"), lag: c.querySelector(".lag"), num: c.querySelector(".npfo-num"), co: el.querySelector(`.npfo-co[data-side="${s}"]`), cache: {} }; });

  /* ---------- game state ---------- */
  let dead = false, ready = false, T = null, DT = 1 / 60, rnd = Math.random, matchNo = 0;
  const sel = [clamp(opts.left != null ? opts.left | 0 : 0, 0, list.length - 1), clamp(opts.right != null ? opts.right | 0 : Math.min(1, list.length - 1), 0, list.length - 1)];
  const R = { phase: "idle", t: 0, time: 0, over: false, overT: 0, winner: null, loser: null, fighters: [], callout: null, texts: [], hitstop: 0, turns: 0, banner: "" };
  const TB = { board: sqBoard(6, 6, BLOCKED, ["0,2", "5,3"]), active: 0, turn: 1, reach: null, path: null, pat: null, patCol: "#fff", patT: 0, gen: null, fx: [], miss: [], shake: 0, decals: [] };
  const S = { mats: [], texs: [], spin: [], fxLive: [], sink: null };
  let music = null;

  const mkF = side => { const p = list[sel[side]]; return { side, p, hp: p.maxHp, disp: p.maxHp, flash: 0, lastAtk: -1, atk: null, name: p.name }; };
  const foe = f => R.fighters[1 - f.side];
  function* wait(s) { for (let t = 0; t < s; t += DT) yield 0; }
  const P_ = k => TB.board.pos(k);

  function resetBoard() {
    TB.fx = []; TB.miss = []; TB.decals = []; TB.pat = TB.reach = TB.path = null; TB.turn = 1; TB.gen = null; TB.shake = 0;
    const [a, b] = R.fighters; TB.active = b.p.speed > a.p.speed ? 1 : 0;
    R.fighters.forEach((f, i) => { f.p3 = { cell: TB.board.start[i], anim: null, z: 0, pose: null, poseT: 0, poseD: .3, sq: 0, sqv: 0, t: rr(0, 3) }; });
  }
  function newMatchState() { R.over = false; R.overT = 0; R.winner = R.loser = null; R.callout = null; R.texts = []; R.turns = 0; R.hitstop = 0; R.fighters = [mkF(0), mkF(1)]; resetBoard(); }
  const free = (k, ign) => { const B = TB.board; return B.has(k) && !B.blocked.has(k) && !R.fighters.some(f => f.p3 && f !== ign && f.p3.cell === k); };
  function fpos(f) { const p = f.p3, B = TB.board; if (p.anim) { const a = p.anim, k = Math.min(1, a.t / a.dur), A = B.pos(a.from), C = B.pos(a.to); return { x: lerp(A.x, C.x, k), y: lerp(A.y, C.y, k), z: Math.sin(k * Math.PI) * a.h }; } const P = B.pos(p.cell); return { x: P.x, y: P.y, z: 0 }; }
  function startHop(f, to, dur, h) { const p = f.p3; p.anim = { from: p.cell, to, t: 0, dur, h }; p.cell = to; }
  function* hopG(f, to, dur, h) { startHop(f, to, dur, h); while (f.p3.anim) yield 0; }
  function reachable(f, steps) { const B = TB.board, o = foe(f), res = {}; res[f.p3.cell] = [f.p3.cell]; let fr = [f.p3.cell];
    for (let s = 0; s < steps; s++) { const nf = []; for (const c of fr) for (const n of B.nb(c)) { if (res[n] || !free(n, f) || o.p3.cell === n) continue; res[n] = res[c].concat([n]); nf.push(n); } fr = nf; } return res; }
  function planMove(f, i) { const B = TB.board, qc = foe(f).p3.cell, rs = reachable(f, f.p.steps), kind = f.p.moves[i].kind; let best = null, bs = 1e9;
    for (const k in rs) { const e = rs[k][rs[k].length - 1], sc = req(kind, B, e, qc) * 10 + rs[k].length * .6 + rnd() * 1.2; if (sc < bs) { bs = sc; best = rs[k]; } }
    return { path: best, ok: req(kind, B, best[best.length - 1], qc) === 0, reach: rs }; }
  function pickAttack(f) { const M = f.p.moves, tot = M.reduce((a, m) => a + m.w, 0); let i = 0;
    for (let tries = 0; tries < 4; tries++) { let r = rnd() * tot; for (i = 0; i < 3; i++) { if ((r -= M[i].w) <= 0) break; } i = Math.min(i, 2); if (i !== f.lastAtk || rnd() < .3) break; }
    f.lastAtk = i; return i; }
  const pose = (f, name, t) => { f.p3.pose = name; f.p3.poseT = 0; f.p3.poseD = t || .3; };
  function log(html) { if (logEl.innerHTML !== html) logEl.innerHTML = html; }

  function damage(a, b, dmg, pos, crit) {
    if (R.over || b.hp <= 0) return false; b.hp = Math.max(0, b.hp - dmg); b.flash = .18;
    const stack = R.texts.filter(t => t.target === b && t.life > t.max - .55).length;
    R.texts.push(Object.assign({ text: (crit ? "CRIT -" : "-") + dmg, crit, target: b, life: 1.1, max: 1.1, stack }, pos));
    R.hitstop = Math.max(R.hitstop, dmg >= 40 ? .09 : .05);
    if (b.hp <= 0) { R.over = true; R.overT = 0; R.winner = a; R.loser = b; R.callout = null; R.phase = "ko"; R.t = 0; S.shake = .5; showBig("K.O.", "", "#ff4d6d"); }
    return true;
  }
  function* telegraph(f, o, tiles, col, dur, kind) {
    TB.pat = tiles; TB.patCol = col; TB.patT = 0; let dodged = false;
    const pDodge = clamp(.1 + (o.p.speed - f.p.speed) * .006, .04, .3) * (kind === "beam" ? .6 : 1);
    for (let t = 0; t < dur; t += DT) { TB.patT = t / dur;
      if (!dodged && t > dur * .45) { dodged = true; const qc = o.p3.cell;
        if (tiles.includes(qc) && rnd() < pDodge) { const op = TB.board.nb(qc).filter(n => free(n, o) && !tiles.includes(n));
          if (op.length) { const n = op[(rnd() * op.length) | 0]; startHop(o, n, .28, .5); const P = P_(n); TB.miss.push({ text: "DODGE!", x: P.x, y: P.y, life: 1, max: 1 }); log(`<b>${esc(o.name)}</b> dodged!`); } } }
      yield 0; }
  }
  function hit(a, b, m, tiles) {
    const qc = b.p3.cell, P = P_(qc);
    if (tiles.includes(qc)) {
      const crit = rnd() < .04 + a.p.aesthetics * .0012;
      const dmg = Math.round(m.base * (.85 + rnd() * .3) * (1 - b.p.weight * .0022) * (crit ? 1.5 : 1));
      if (damage(a, b, dmg, { x: P.x, y: P.y }, crit)) {
        TB.fx.push({ kind: "hit", x: P.x, y: P.y, col: m.col, t: 0, life: .6, big: dmg >= 40 || crit }); TB.shake = dmg >= 40 ? 1 : .6; b.p3.sqv = -4;
        if (music) music.hit(dmg >= 40);
        log(`<b>${esc(a.name)}</b> · <b>${esc(m.name)}</b> — ${dmg} dmg${crit ? " · <b>style crit!</b>" : ""}`); return true; }
    } else { TB.miss.push({ text: "MISS", x: P.x, y: P.y, life: 1, max: 1 }); log(`<b>${esc(a.name)}</b>'s ${esc(m.name)} missed.`); }
    return false;
  }
  const fx = (kind, o) => { const e = Object.assign({ kind, t: 0, life: .6 }, o); TB.fx.push(e); return e; };
  function* doAttack(f, i) {
    const B = TB.board, o = foe(f), p = f.p3, m = f.p.moves[i], col = m.col, me = p.cell, qc = o.p3.cell; let Tt;
    switch (m.kind) {
      case "slash": { const d = B.dir(me, qc); Tt = [qc]; const b2 = d >= 0 && B.step(qc, d); if (b2) Tt.push(b2); yield* telegraph(f, o, Tt, col, .7, m.kind);
        pose(f, "swing", .35); yield* wait(.12); fx("slash", { from: P_(me), to: P_(qc), col, life: .4, side: f.side });
        if (hit(f, o, m, Tt)) { const k = d >= 0 && B.step(o.p3.cell, d); if (k && free(k, o)) startHop(o, k, .25, .25); } yield* wait(.4); break; }
      case "petal": { Tt = B.plus(qc); yield* telegraph(f, o, Tt, col, .9, m.kind); pose(f, "cast", .5); yield* wait(.15);
        fx("petal", { from: P_(me), to: P_(qc), tiles: Tt.map(P_), col, life: .9, side: f.side }); yield* wait(.6); hit(f, o, m, Tt);
        TB.decals.push({ tiles: Tt, col, life: 2.5, max: 2.5 }); yield* wait(.35); break; }
      case "dash": { const d = B.dir(me, qc); Tt = lineFrom(B, me, d, 5); yield* telegraph(f, o, Tt, col, 1, m.kind); pose(f, "dash", .6); yield* wait(.12);
        let end = me; for (const c of Tt) { if (B.blocked.has(c)) break; if (c !== o.p3.cell && c !== qc) end = c; }
        fx("dash", { from: P_(me), to: P_(end), col, life: .7, side: f.side }); if (end !== me) startHop(f, end, .22, .15);
        yield* wait(.1); hit(f, o, m, Tt); while (p.anim) yield 0; yield* wait(.4); break; }
      case "beam": { const d = B.dir(me, qc); Tt = lineFrom(B, me, d); yield* telegraph(f, o, Tt, col, .8, m.kind); pose(f, "cast", .6); yield* wait(.15);
        fx("beam", { from: P_(me), to: P_(Tt[Tt.length - 1]), col, life: .7, side: f.side }); yield* wait(.12); hit(f, o, m, Tt); yield* wait(.55); break; }
      case "wall": { Tt = B.cells.filter(c => { const dd = B.dist(me, c); return dd >= 1 && dd <= 2; }); yield* telegraph(f, o, Tt, col, .9, m.kind); pose(f, "cast", .6); yield* wait(.1);
        fx("wall", { from: P_(me), to: P_(me), col, life: .8, side: f.side }); yield* wait(.28); hit(f, o, m, Tt); yield* wait(.5); break; }
      case "bomb": { Tt = B.blast(qc); yield* telegraph(f, o, Tt, col, 1.1, m.kind); pose(f, "cast", .7); yield* wait(.12);
        fx("bomb", { from: P_(me), to: P_(qc), col, life: 1.15, side: f.side, who: f.p }); yield* wait(.55); TB.shake = 1.2; hit(f, o, m, Tt);
        TB.decals.push({ tiles: Tt, col: "#ff6a3d", life: 3, max: 3 }); yield* wait(.6); break; }
    }
  }
  function* turnG(f) {
    yield* wait(.3);
    let i = pickAttack(f), pl = planMove(f, i);
    if (!pl.ok) { const alt = [0, 1, 2].filter(j => j !== i).map(j => ({ j, pl: planMove(f, j) })).find(a => a.pl.ok); if (alt) { i = alt.j; pl = alt.pl; f.lastAtk = i; } }
    TB.reach = Object.keys(pl.reach); TB.path = pl.path; yield* wait(.55); TB.reach = null;
    for (const st of pl.path.slice(1)) yield* hopG(f, st, .3, .35);
    TB.path = null;
    if (!R.over) { const m = f.p.moves[i]; R.callout = { side: f.side, text: m.name, life: 1.8, max: 1.8 }; R.turns++; log(`<b>${esc(f.name)}</b> uses <b>${esc(m.name)}</b>…`); f.atk = { i, t: 0 }; yield* doAttack(f, i); }
    f.atk = null; TB.pat = null; yield* wait(.35);
  }
  function tbUpdate(dt) {
    for (const f of R.fighters) { const p = f.p3; p.t += dt; if (f.atk) f.atk.t += dt; if (p.pose) { p.poseT += dt; if (p.poseT > p.poseD) p.pose = null; }
      if (p.anim) { const a = p.anim; a.t += dt; if (a.t >= a.dur) { p.anim = null; p.sqv = -3; } }
      p.sqv += (-p.sq * 260 - p.sqv * 12) * dt; p.sq += p.sqv * dt;
      if (R.over && f === R.winner && !p.anim && R.overT > .5) startHop(f, p.cell, .4, .45);
      if (f.flash > 0) f.flash -= dt; f.disp += (f.hp - f.disp) * Math.min(1, dt * (f.disp > f.hp ? 2.2 : 8)); }
    if (R.phase === "battle" && !R.over) { if (!TB.gen) TB.gen = turnG(R.fighters[TB.active]); if (TB.gen.next().done) { TB.gen = null; TB.active = 1 - TB.active; TB.turn++; } }
    if (R.over) { TB.gen = null; TB.pat = null; }
    for (const e of TB.fx) e.t += dt; TB.fx = TB.fx.filter(e => e.t < e.life);
    for (const e of TB.decals) e.life -= dt; TB.decals = TB.decals.filter(e => e.life > 0);
    for (const t of TB.miss) t.life -= dt; TB.miss = TB.miss.filter(t => t.life > 0);
    for (const t of R.texts) t.life -= dt; R.texts = R.texts.filter(t => t.life > 0);
    if (R.callout) { R.callout.life -= dt; if (R.callout.life <= 0) R.callout = null; }
    TB.shake = Math.max(0, TB.shake - dt * 3);
  }
  function flow(dt) {
    R.time += dt; R.t += dt;
    if (R.phase === "intro") { if (R.t > .8 && R.banner !== "FIGHT!") showBig("FIGHT!", "", "#ff2bd6"); if (R.t > 1.4) { hideBig(); R.phase = "battle"; R.t = 0; } }
    if (R.over) R.overT += dt;
    if (R.phase === "ko" && R.t > 1.3) {
      R.phase = "done"; const w = R.winner;
      showBig(w.name.toUpperCase(), "WINS · " + R.turns + " moves", hsl(w.p.hue, 100, 62));
      goBtn.disabled = false; goBtn.textContent = "REMATCH";
      log(`<b>${esc(w.name)}</b> wins with ${Math.ceil(w.hp)} HP left. Tap <b>REMATCH</b> or swap fighters.`);
      if (typeof opts.onEnd === "function") { try { opts.onEnd({ winner: w.p.src, loser: R.loser.p.src, winnerSide: w.side, turns: R.turns }); } catch (e) { console.error(e); } }
    }
  }
  function showBig(main, sub, col) { R.banner = main; big.innerHTML = esc(main) + (sub ? `<small>${esc(sub)}</small>` : ""); big.style.textShadow = col ? `0 0 10px ${col},0 0 26px ${col}` : ""; big.classList.remove("is-on"); void big.offsetWidth; big.classList.add("is-on"); }
  function hideBig() { R.banner = ""; big.classList.remove("is-on"); }

  /* ---------- flow controls ---------- */
  function toIdle(msg) { R.phase = "idle"; R.t = 0; freeAllFx(); newMatchState(); hideBig(); goBtn.textContent = "FIGHT"; goBtn.disabled = false; log(msg || "Pick a fighter for each side, then tap <b>FIGHT</b>."); kick(); }
  function fight() {
    if (dead) return; if (!ready) { pendingFight = true; return; }
    if (R.phase === "intro" || R.phase === "battle" || R.phase === "ko") return;
    matchNo++; rnd = opts.seed != null ? mulberry((+opts.seed + matchNo * 7919) >>> 0) : Math.random;
    freeAllFx(); newMatchState(); R.phase = "intro"; R.t = 0; goBtn.disabled = true; goBtn.textContent = "REMATCH";
    showBig("READY", R.fighters[0].name + "  vs  " + R.fighters[1].name);
    log(`<b>${esc(R.fighters[0].name)}</b> vs <b>${esc(R.fighters[1].name)}</b> — stats pick the moves.`); kick();
  }
  let pendingFight = !!opts.autoStart;
  function setFighter(side, idx) {
    idx = clamp(idx | 0, 0, list.length - 1); if (sel[side] === idx && R.fighters[side] && R.fighters[side].p === list[idx]) return;
    sel[side] = idx; hudStatic(side);
    if (!ready) return;
    rebuildModel(side);
    const busy = R.phase !== "idle";
    toIdle(busy ? "Fighter switched — tap <b>FIGHT</b> for a new match." : undefined);
  }

  /* ---------- HUD ---------- */
  const setTxt = (n, v) => { if (n._t !== v) { n._t = v; n.textContent = v; } };
  function hudStatic(side) {
    const p = list[sel[side]], c = cards[side];
    c.face.innerHTML = faceSVG(p); setTxt(c.name, p.name);
    c.sub.innerHTML = (p.location ? esc(p.location) + " · " : "") + `SPD <b>${p.speed}</b> WGT <b>${p.weight}</b> AES <b>${p.aesthetics}</b>`;
    c.fill.style.background = `linear-gradient(${side ? 270 : 90}deg,${hsl(p.hue, 95, 58)},${hsl(p.look.acc, 100, 66)})`; c.cache = {};
    el.querySelectorAll(`.npfo-pick[data-side="${side}"] .npfo-chip`).forEach(b => b.setAttribute("aria-pressed", +b.dataset.i === sel[side] ? "true" : "false"));
  }
  const dmEls = new Map();
  function hudFrame() {
    R.fighters.forEach((f, i) => {
      const c = cards[i], k = clamp(f.hp / f.p.maxHp, 0, 1), kl = clamp(f.disp / f.p.maxHp, 0, 1);
      const w = (k * 100).toFixed(1) + "%", wl = (kl * 100).toFixed(1) + "%", num = Math.max(0, Math.ceil(f.hp)) + " / " + f.p.maxHp + " HP", act = R.phase === "battle" && TB.active === i;
      if (c.cache.w !== w) { c.fill.style.width = w; c.cache.w = w; c.hp.classList.toggle("is-low", k < .3 && k > 0); }
      if (c.cache.wl !== wl) { c.lag.style.width = wl; c.cache.wl = wl; }
      if (c.cache.num !== num) { c.num.textContent = num; c.cache.num = num; }
      if (c.cache.act !== act) { c.root.classList.toggle("is-act", act); c.cache.act = act; }
      const co = R.callout; if (co && co.side === i) { setTxt(c.co, co.text + "!"); c.co.style.opacity = Math.min(1, co.life * 3); } else if (c.co.style.opacity !== "0") c.co.style.opacity = 0;
    });
    if (!S.camera) return;
    const live = new Set(), W = S.W, H = S.H, v = new T.Vector3();
    const put = (t, cls, txt, yo) => { live.add(t); let e = dmEls.get(t); if (!e) { e = doc.createElement("div"); e.className = "npfo-dm " + cls; e.textContent = txt; hud.appendChild(e); dmEls.set(t, e); }
      v.set((t.x - 2.5) * SP, 2.2 + yo, (t.y - 2.5) * SP); S.board.localToWorld(v); v.project(S.camera);
      e.style.left = ((v.x * .5 + .5) * W).toFixed(1) + "px"; e.style.top = ((-v.y * .5 + .5) * H).toFixed(1) + "px"; e.style.opacity = Math.min(1, t.life * 3); };
    for (const t of R.texts) put(t, t.crit ? "c" : "", t.text, (1 - t.life / t.max) * .6 + t.stack * .4);
    for (const t of TB.miss) put(t, "m", t.text, (1 - t.life / t.max) * .5);
    for (const [t, e] of dmEls) if (!live.has(t)) { e.remove(); dmEls.delete(t); }
  }

  /* ---------- Three.js helpers (resources tracked for dispose) ---------- */
  const sinkOf = () => S.sink || S;
  const V3 = (x, y, z) => new T.Vector3(x, y, z), w3 = P => V3((P.x - 2.5) * SP, 0, (P.y - 2.5) * SP);
  function tex(w, h, draw, linear) { const c = doc.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new T.CanvasTexture(c); if (!linear) t.colorSpace = T.SRGBColorSpace; sinkOf().texs.push(t); return t; }
  function std(o) { const m = new T.MeshStandardMaterial(Object.assign({ metalness: .1, roughness: .6, flatShading: true }, o)); sinkOf().mats.push(m); return m; }
  function add(col, op) { const m = new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op == null ? 1 : op, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }); sinkOf().mats.push(m); return m; }
  function mesh(geo, mat, parent, x, y, z, rot, sc) { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); if (rot) m.rotation.set(rot[0], rot[1], rot[2]); if (sc) m.scale.set(sc[0], sc[1], sc[2]); (parent || S.scene).add(m); return m; }
  function glow(col, size, parent, x, y, z, op) { const s = new T.Sprite(new T.SpriteMaterial({ map: S.glowTex, color: col, transparent: true, opacity: op == null ? .8 : op, blending: T.AdditiveBlending, depthWrite: false })); sinkOf().mats.push(s.material);
    s.scale.set(size, size, 1); s.position.set(x || 0, y || 0, z || 0); (parent || S.scene).add(s); return s; }
  function freeObj(obj, res) { if (!obj) return; const geos = new Set(); obj.traverse(o => { if (o.geometry && !o.isSprite && !o.geometry.userData.shared) geos.add(o.geometry); }); geos.forEach(g => g.dispose());
    if (res) { res.mats.forEach(m => m.dispose()); res.texs.forEach(t => t.dispose()); res.mats.length = res.texs.length = 0; } if (obj.parent) obj.parent.remove(obj); }

  /* ---------- scene ---------- */
  const TREES = [[-8, -6, 18], [8, -7, 20], [-9, 5, 15], [9, 6, 17], [0, -11, 22], [-3, 10, 14], [12, -1, 16], [-13, 0, 19], [5, 12, 15], [-11, -11, 21], [12, -11, 17]];
  function envMap(r) {
    const es = new T.Scene(), made = [];
    const skyM = new T.ShaderMaterial({ side: T.BackSide, vertexShader: "varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: "varying vec3 vp;void main(){float h=vp.y;vec3 c=mix(vec3(.01,.005,.03),vec3(.12,.03,.2),smoothstep(-.2,.5,h));c=mix(c,vec3(.01,.08,.14),smoothstep(.5,1.,h)*.6);c+=vec3(.8,.1,.6)*smoothstep(.97,1.,1.-abs(h-.05))*.4;gl_FragColor=vec4(c,1.);}" });
    es.add(new T.Mesh(new T.SphereGeometry(50, 24, 12), skyM));
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, col = [0x35f4ff, 0xff3fb0, 0xffffff, 0xb06bff][i % 4]; const p = new T.Mesh(new T.PlaneGeometry(2.5, 40), new T.MeshBasicMaterial({ color: col, side: T.DoubleSide })); p.position.set(Math.cos(a) * 40, 5, Math.sin(a) * 40); p.lookAt(0, 5, 0); es.add(p); }
    const pm = new T.PMREMGenerator(r); const rt = pm.fromScene(es, .02); pm.dispose();
    es.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    S.envRT = rt; return rt.texture;
  }
  function tree(x, z, h, seed, par, low) {
    const Rn = mulberry(seed), g = new T.Group(); g.position.set(x, -h * .62, z); par.add(g); const chrome = S.chrome;
    const segs = low ? 4 : 5; let y = 0, r = h * .05;
    for (let i = 0; i < segs; i++) { const sh = h / segs, r2 = r * .78; const m = mesh(new T.CylinderGeometry(r2, r, sh, 7), chrome, g, Math.sin(i * 1.3 + seed) * .3, y + sh / 2, Math.cos(i * 1.1 + seed) * .3);
      if (i % 2 === 0) mesh(new T.TorusGeometry(r * 1.05, .05, 6, 24), add(i % 4 ? 0xff3fb0 : 0x35f4ff), g, m.position.x, y + sh * .3, m.position.z, [Math.PI / 2, 0, 0]); y += sh; r = r2; }
    for (let b = 0; b < (low ? 3 : 5); b++) { const a = Rn() * 6.283, L = h * (.18 + Rn() * .12), yy = h * (.55 + Rn() * .37);
      mesh(new T.CylinderGeometry(.08, .18, L, 5), chrome, g, Math.cos(a) * L * .4, yy, Math.sin(a) * L * .4, [Math.sin(a) * .9, 0, -Math.cos(a) * .9]);
      const cx = Math.cos(a) * L * .85, cz = Math.sin(a) * L * .85, cy = yy + L * .35, s = (1.2 + Rn()) * h / 16;
      const cr = mesh(new T.IcosahedronGeometry(s, 0), chrome, g, cx, cy, cz, [Rn(), Rn(), Rn()]);
      const core = mesh(new T.IcosahedronGeometry(s * .55, 0), add(b % 2 ? 0xff3fb0 : 0x35f4ff, .9), g, cx, cy, cz); glow(b % 2 ? 0xff3fb0 : 0x35f4ff, s * 3.2, g, cx, cy, cz, .55); S.spin.push(cr, core); }
    const top = mesh(new T.IcosahedronGeometry(h * .14, 0), chrome, g, 0, h, 0); S.spin.push(top); glow(0xb06bff, h * .5, g, 0, h, 0, .4);
  }
  function points(par, N, col, size, fill, o) { const pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const v = fill(i); pos[i * 3] = v[0]; pos[i * 3 + 1] = v[1]; pos[i * 3 + 2] = v[2]; }
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(pos, 3)); const m = new T.PointsMaterial(Object.assign({ color: col, size, transparent: true, depthWrite: false }, o || {})); sinkOf().mats.push(m);
    const p = new T.Points(g, m); p.frustumCulled = false; par.add(p); return p; }

  function buildScene() {
    const cw = stage.clientWidth || 360, dpr = win.devicePixelRatio || 1;
    LOW = S.low = opts.quality === "low" || (opts.quality !== "high" && (cw < 560 || (navigator.hardwareConcurrency || 8) <= 4));
    S.maxPr = clamp(+opts.maxPixelRatio || 1.5, .5, 2); S.pr = Math.min(dpr, S.maxPr);
    const r = new T.WebGLRenderer({ antialias: S.pr < 1.5 && !S.low, powerPreference: "high-performance" });
    r.setPixelRatio(S.pr); r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.0; r.outputColorSpace = T.SRGBColorSpace;
    S.renderer = r; stage.insertBefore(r.domElement, hud); loadEl.remove();
    const sc = S.scene = new T.Scene(); sc.fog = new T.FogExp2(0x12052a, .014); sc.background = new T.Color(0x0a0418);
    S.camera = new T.PerspectiveCamera(48, 1, .1, 300);
    S.glowTex = tex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.25, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }, true);
    S.env = envMap(r);
    S.chrome = std({ color: 0xdfe6f2, metalness: 1, roughness: .12, envMap: S.env, envMapIntensity: 1.3 });
    // floating board
    const B = S.board = new T.Group(); sc.add(B); S.tiles = {};
    const tg = new T.BoxGeometry(1.04, .22, 1.04), eg = new T.EdgesGeometry(tg), og = new T.PlaneGeometry(.96, .96);
    const tm = std({ color: 0x0c0a18, metalness: .85, roughness: .32, envMap: S.env, envMapIntensity: .7 });
    const em = [0x35f4ff, 0xff3fb0].map(c => { const m = new T.LineBasicMaterial({ color: c, transparent: true, opacity: .55 }); S.mats.push(m); return m; });
    for (const k of TB.board.cells) { const P = TB.board.pos(k), w = w3(P); const t = new T.Group(); t.position.set(w.x, -.11, w.z); B.add(t); mesh(tg, tm, t); t.add(new T.LineSegments(eg, em[(P.x + P.y) % 2]));
      const ov = mesh(og, add(0xffffff, 0), t, 0, .115, 0, [-Math.PI / 2, 0, 0]); ov.visible = false; S.tiles[k] = { g: t, ov, ph: Math.random() * 6 }; }
    S.tileMat = tm; S.edgeMats = em; const ped = S.pedestal = new T.Group(); B.add(ped);
    mesh(new T.CylinderGeometry(3.4, .6, 4, 6, 1), std({ color: 0x2a2440, metalness: 1, roughness: .3, envMap: S.env }), ped, 0, -2.3, 0, [0, Math.PI / 6, 0]);
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + Math.PI / 6; mesh(new T.BoxGeometry(.04, 3.6, .04), add(i % 2 ? 0xff3fb0 : 0x35f4ff), ped, Math.cos(a) * 2, -2.2, Math.sin(a) * 2, [Math.cos(a + Math.PI / 2) * .6, 0, Math.sin(a + Math.PI / 2) * -.6]); }
    glow(0xb06bff, 6, ped, 0, -4.5, 0, .6);
    // telegraph pillars (pool)
    S.pill = []; const pgeo = new T.CylinderGeometry(.42, .42, 2.4, 12, 1, true); for (let i = 0; i < 24; i++) { const m = mesh(pgeo, add(0xffffff, 0), B, 0, 1.2, 0); m.visible = false; S.pill.push(m); }
    buildArena(arenaI);
    S.models = [null, null]; S.modelRes = [null, null]; rebuildModel(0); rebuildModel(1);
    S.cam = { th: .55, ph: .58, zoom: 1, drag: null, last: -99 }; S.shake = 0;
  }


  /* ---------- arenas (ported from cyber-forest.html v3; lighter builds on the phone tier) ---------- */
  let LOW = false; const PLK = Math.PI * 10;
  function lights3(par, hemi, hemiG, hi, dir, di, pts) { par.add(new T.HemisphereLight(hemi, hemiG, hi * Math.PI)); const dl = new T.DirectionalLight(dir, di * Math.PI); dl.position.set(6, 12, 4); par.add(dl);
    const L = []; for (const [c, i, x, y, z, d] of pts) { const p = new T.PointLight(c, i * PLK, d || 16, 2); p.position.set(x, y, z); par.add(p); L.push(p); } return L; }
  function skyDome(par, frag) { const m = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, vertexShader: "varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}", fragmentShader: frag });
    sinkOf().mats.push(m); const s = new T.Mesh(new T.SphereGeometry(150, 24, 16), m); par.add(s); return s; }
  function tileStyle(o) {
    S.tileMat.color.set(o.tile); S.tileMat.roughness = o.rough != null ? o.rough : .32; S.tileMat.metalness = o.metal != null ? o.metal : .85; S.tileMat.emissive.set(o.emis || 0);
    S.edgeMats.forEach((m, i) => { m.color.set(o.edge[i]); m.opacity = o.edgeOp != null ? o.edgeOp : .55; });
    S.pedestal.visible = !!o.ped; S.scene.background.set(o.bg); S.scene.fog.color.set(o.fog); S.scene.fog.density = o.fogD; S.renderer.toneMappingExposure = o.exp || 1;
  }
  function arenaCanopy(A, G) {
    tileStyle({ tile: 0x0c0a18, rough: .32, metal: .85, edge: [0x35f4ff, 0xff3fb0], edgeOp: .55, ped: true, bg: 0x0a0418, fog: 0x12052a, fogD: .014, exp: 1 });
    lights3(G, 0x8a5cff, 0x0a2a40, .45, 0xffc8f0, .8, [[0xff3fb0, 1.5, -5, 3, -4], [0x35f4ff, 1.5, 5, 3, 4]]);
    skyDome(G, "varying vec3 vp;void main(){float h=vp.y;vec3 c=mix(vec3(.04,.01,.1),vec3(.22,.04,.3),smoothstep(-.3,.25,h));c=mix(c,vec3(.02,.05,.12),smoothstep(.25,.9,h));c+=vec3(1.,.2,.6)*pow(max(0.,1.-abs(h-.02)*6.),3.)*.35;gl_FragColor=vec4(c,1.);}");
    points(G, LOW ? 250 : 500, 0xbfe8ff, .5, () => { const a = Math.random() * 6.283, rad = rr(60, 120); return [Math.cos(a) * rad, rr(-.1, 1) * 80, Math.sin(a) * rad]; }, { fog: false, transparent: false, depthWrite: true });
    const trees = LOW ? TREES.slice(0, 7) : TREES; trees.forEach((p, i) => tree(p[0] * 1.45, p[1] * 1.45, p[2] * 1.3, i * 17 + 3, G, LOW));
    for (let i = 0; i < (LOW ? 6 : 14); i++) { const a = i / (LOW ? 6 : 14) * 6.283; glow(i % 2 ? 0xff3fb0 : 0x35f4ff, rr(10, 18), G, Math.cos(a) * rr(18, 30), rr(-4, 4), Math.sin(a) * rr(18, 30), .18); }
    const spores = points(G, LOW ? 100 : 240, 0xff8fe0, .35, () => [rr(-12, 12), rr(-3, 9), rr(-12, 12)], { map: S.glowTex, blending: T.AdditiveBlending });
    for (const k of BLOCKED) { const w = w3(TB.board.pos(k)); const s = new T.Group(); s.position.set(w.x, 0, w.z); G.add(s); mesh(new T.CylinderGeometry(.06, .14, 1.1, 6), S.chrome, s, 0, .55, 0);
      S.spin.push(mesh(new T.IcosahedronGeometry(.42, 0), S.chrome, s, 0, 1.3, 0)); mesh(new T.IcosahedronGeometry(.22, 0), add(0x7dff9a), s, 0, 1.3, 0); glow(0x7dff9a, 1.6, s, 0, 1.3, 0, .6); mesh(new T.TorusGeometry(.5, .02, 4, 24), add(0x7dff9a), s, 0, .2, 0, [Math.PI / 2, 0, 0]); }
    A.upd = dt => { for (const m of S.spin) { m.rotation.y += dt * .4; m.rotation.x += dt * .15; }
      const a = spores.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.array[i * 3 + 1] + dt * .3; if (y > 9) y = -3; a.array[i * 3 + 1] = y; } a.needsUpdate = true; };
  }
  const ARENA_BUILD = [arenaCanopy, arenaMegacity, arenaShrine, arenaDatacore];
  function buildArena(i) {
    if (S.arena) { freeObj(S.arena.G, S.arena.res); S.arena = null; }
    const A = { i, res: { mats: [], texs: [] }, upd: null }, G = A.G = new T.Group(); S.scene.add(G); S.spin = []; S.sink = A.res;
    try { ARENA_BUILD[i](A, G); } finally { S.sink = null; }
    S.arena = A;
  }
  function winTex(seed,warm){return tex(128,256,(c,w,h)=>{const Rn=mulberry(seed);c.fillStyle='#000';c.fillRect(0,0,w,h);for(let y=4;y<h;y+=10)for(let x=4;x<w;x+=10){const r=Rn();if(r<.45)continue;c.fillStyle=r<.62?(warm?'#ffcf7a':'#9fe8ff'):r<.75?'#35f4ff':r<.85?'#ff3fb0':r<.93?'#fff4d0':'#5a6aa0';c.globalAlpha=.5+Rn()*.5;c.fillRect(x,y,6,6);}
   c.globalAlpha=1;if(Rn()<.8){c.fillStyle=Rn()<.5?'#ff3fb0':'#35f4ff';c.fillRect(0,(Rn()*h)|0,w,3);}});}
  function uvScale(geo,sx,sy){const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*sx,uv.getY(i)*sy);uv.needsUpdate=true;return geo;}
  function adTex(kind){return tex(256,256,(c,w,h)=>{c.fillStyle='rgba(0,0,0,0)';c.clearRect(0,0,w,h);const g=c.createLinearGradient(0,0,0,h);
   if(kind===0){g.addColorStop(0,'rgba(255,63,176,.55)');g.addColorStop(1,'rgba(80,0,120,.35)');c.fillStyle=g;c.fillRect(0,0,w,h);c.fillStyle='#fff';c.strokeStyle='#fff';c.lineWidth=8;
    c.beginPath();c.moveTo(60,110);c.lineTo(80,40);c.lineTo(110,90);c.lineTo(146,90);c.lineTo(176,40);c.lineTo(196,110);c.arc(128,130,70,-.2,Math.PI+.2);c.closePath();c.stroke();c.fillRect(95,120,16,10);c.fillRect(145,120,16,10);
    c.font='bold 48px sans-serif';c.textAlign='center';c.fillText('\u30cd\u30b3',128,236);}
   else if(kind===1){g.addColorStop(0,'rgba(53,244,255,.55)');g.addColorStop(1,'rgba(0,40,120,.35)');c.fillStyle=g;c.fillRect(0,0,w,h);c.fillStyle='#eaffff';c.font='bold 110px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('\u672a\u6765',128,110);
    c.font='bold 30px sans-serif';c.fillText('NEO-TOKYO 2099',128,210);}
   else{g.addColorStop(0,'rgba(255,210,63,.55)');g.addColorStop(1,'rgba(120,40,0,.35)');c.fillStyle=g;c.fillRect(0,0,w,h);c.fillStyle='#fff';c.font='bold 120px Georgia,serif';c.textAlign='center';c.textBaseline='middle';c.fillText('A\u2660',128,110);
    c.font='bold 28px sans-serif';c.fillText('MOCHI CASINO',128,215);}
   c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=6;c.strokeRect(3,3,w-6,h-6);c.fillStyle='rgba(0,0,0,.25)';for(let y=0;y<h;y+=4)c.fillRect(0,y,w,1);});}
  function arenaMegacity(A,G){tileStyle({tile:0x14161f,rough:.12,metal:.7,edge:[0x35f4ff,0xffd23f],edgeOp:.7,ped:false,bg:0x05060f,fog:0x0b1226,fogD:.011,exp:1.05});
   const PL=lights3(G,0x5070ff,0x101020,.4,0xa8c4ff,.7,[[0xff3fb0,1.6,-6,4,-5,20],[0x35f4ff,1.6,6,4,5,20]]);
   skyDome(G,'varying vec3 vp;void main(){float h=vp.y;vec3 c=mix(vec3(.25,.05,.25),vec3(.03,.03,.09),smoothstep(-.15,.45,h));c+=vec3(1.,.35,.2)*pow(max(0.,1.-abs(h+.02)*5.),3.)*.35;gl_FragColor=vec4(c,1.);}');
   // helipad rooftop + tower below
   const wt=[winTex(11,false),winTex(23,true),winTex(37,false)];wt.forEach(t=>{t.wrapS=t.wrapT=T.RepeatWrapping;});
   const bm=wt.map(t=>std({color:0x080a12,roughness:.45,metalness:.6,emissive:0xffffff,emissiveMap:t,emissiveIntensity:1.1,envMap:S.env,flatShading:false}));
   mesh(new T.CylinderGeometry(6.3,6.3,.5,48),std({color:0x121318,roughness:.8,metalness:.3}),G,0,-.51,0);
   const deck=tex(512,512,(c,w,h)=>{c.fillStyle='#000';c.fillRect(0,0,w,h);c.strokeStyle='#ffd23f';c.lineWidth=14;c.beginPath();c.arc(256,256,238,0,7);c.stroke();c.setLineDash([30,20]);c.lineWidth=6;c.beginPath();c.arc(256,256,214,0,7);c.stroke();c.setLineDash([]);
    c.fillStyle='#35f4ff';for(let i=0;i<24;i++){const a=i/24*6.283;c.fillRect(256+Math.cos(a)*228-4,256+Math.sin(a)*228-4,8,8);}});
   const dm=new T.MeshBasicMaterial({map:deck,transparent:true,blending:T.AdditiveBlending,depthWrite:false});sinkOf().mats.push(dm);mesh(new T.PlaneGeometry(12.6,12.6),dm,G,0,-.255,0,[-Math.PI/2,0,0]);
   mesh(uvScale(new T.BoxGeometry(13,70,13),4,22),bm[0],G,0,-35.8,0);
   const rail=[];const NRL=LOW?16:32;for(let i=0;i<NRL;i++){const a=i/NRL*6.283;rail.push(glow(i%2?0xff3040:0xffd23f,.5,G,Math.cos(a)*6.25,-.2,Math.sin(a)*6.25,.9));}
   // puddles on the deck rim (mirror-like)
   const pm=std({color:0x1a2438,metalness:1,roughness:.04,envMap:S.env,envMapIntensity:1.6,flatShading:false});for(const [a,r,s] of[[.4,5.5,.45],[1.9,5.6,.35],[2.9,5.45,.5],[4.1,5.6,.4],[5.3,5.5,.45]])mesh(new T.CircleGeometry(s,20),pm,G,Math.cos(a)*r,-.25,Math.sin(a)*r,[-Math.PI/2,0,0],[1.4,1,1]);
   // skyscrapers
   const Rn=mulberry(99);for(let i=0;i<(LOW?22:46);i++){const a=Rn()*6.283,r=16+Rn()*55,w=3+Rn()*6,d=3+Rn()*6,top=-12+Rn()*34-(r>45?0:6),hgt=top+60;const x=Math.cos(a)*r,z=Math.sin(a)*r;
    mesh(uvScale(new T.BoxGeometry(w,hgt,d),w/3,hgt/6),bm[i%3],G,x,top-hgt/2,z,[0,Rn()*1.5,0]);if(Rn()<.5){const c=Rn()<.5?0xff3fb0:0x35f4ff;glow(c,2.2,G,x,top+.6,z,.8);mesh(new T.BoxGeometry(.08,3,.08),add(c),G,x,top+1.5,z);}}
   // hologram billboards (animated ad rotation + flicker)
   const ads=[adTex(0),adTex(1),adTex(2)];const bbs=[];for(const [x,y,z,s,ry] of[[-13,5,-9,7,.9],[14,7,-6,8,-1],[4,10,-17,9,0],[-10,3,13,6,2.4],[15,2,11,6,-2.2]].slice(0,LOW?3:5)){const m=new T.MeshBasicMaterial({map:ads[bbs.length%3],transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide});sinkOf().mats.push(m);
    const b=mesh(new T.PlaneGeometry(s,s),m,G,x,y,z,[0,ry,0]);mesh(new T.BoxGeometry(.2,y+30,.2),std({color:0x20222a,metalness:.8,roughness:.4}),G,x,y-s/2-(y+30)/2,z);bbs.push({b,m,k:bbs.length});}
   // flying cars on lanes
   const cars=[];const cb=std({color:0x1a1c26,metalness:.9,roughness:.25,envMap:S.env});const cg=new T.BoxGeometry(1.1,.35,.55);for(let i=0;i<(LOW?9:22);i++){const g=new T.Group();G.add(g);mesh(cg,cb,g);glow(0xffffff,.9,g,.6,0,0,.9);glow(0xff2030,.8,g,-.6,0,0,.9);glow(i%2?0xff3fb0:0x35f4ff,1.6,g,0,-.25,0,.6);
    cars.push({g,r:rr(11,30),y:[3,7,11,-3][i%4]+rr(-.5,.5),a:rr(0,6.283),s:rr(.08,.2)*(i%2?1:-1)});}
   // rain
   const N=LOW?350:900,rp=new Float32Array(N*6);for(let i=0;i<N;i++){const x=rr(-16,16),y=rr(-8,16),z=rr(-16,16);rp.set([x,y,z,x-.05,y-.6,z],i*6);}const rg=new T.BufferGeometry();rg.setAttribute('position',new T.BufferAttribute(rp,3));
   const rmat=new T.LineBasicMaterial({color:0x9fd8ff,transparent:true,opacity:.35,depthWrite:false});sinkOf().mats.push(rmat);const rain=new T.LineSegments(rg,rmat);rain.frustumCulled=false;G.add(rain);
   const spl=[];for(let i=0;i<(LOW?6:14);i++){const s=mesh(new T.RingGeometry(.05,.09,12),add(0xbfe8ff,.0),G,0,-.24,0,[-Math.PI/2,0,0]);spl.push({m:s,t:rr(0,.5)});}
   let adT=0;A.upd=(dt,t)=>{for(const c of cars){c.a+=c.s*dt;c.g.position.set(Math.cos(c.a)*c.r,c.y+Math.sin(t+c.r)*.3,Math.sin(c.a)*c.r);c.g.rotation.y=-c.a+(c.s>0?-Math.PI/2:Math.PI/2);}
    adT+=dt;for(const b of bbs){b.m.opacity=.75+.25*Math.sin(t*23+b.k)*Math.sin(t*3.1+b.k*2)-(Math.random()<.01?.6:0);if(adT>2.6)b.m.map=ads[(ads.indexOf(b.m.map)+1)%3];}if(adT>2.6)adT=0;
    const a=rg.attributes.position.array;for(let i=0;i<N;i++){let y=a[i*6+1]-dt*18;if(y<-8)y+=24;a[i*6+1]=y;a[i*6+4]=y-.6;}rg.attributes.position.needsUpdate=true;
    for(const s of spl){s.t+=dt;if(s.t>.5){s.t=0;const ang=rr(0,6.283),r=rr(0,5.8);s.m.position.set(Math.cos(ang)*r,-.23+(r<5?.24:0),Math.sin(ang)*r);}const k=s.t/.5;s.m.scale.setScalar(1+k*3);s.m.material.opacity=.7*(1-k);}
    for(let i=0;i<rail.length;i++)rail[i].material.opacity=((i+Math.floor(t*6))%8<2)?1:.35;PL[0].intensity=(1.6+Math.sin(t*2)*.3)*PLK;};
   // blocked tiles: rooftop AC units / antenna
   for(const [n,k] of BLOCKED.entries()){const w=w3(TB.board.pos(k)),g=new T.Group();g.position.set(w.x,0,w.z);G.add(g);if(n===0){mesh(new T.BoxGeometry(.8,.6,.8),std({color:0x8a90a0,metalness:.7,roughness:.4,envMap:S.env}),g,0,.3,0);
     const fan=mesh(new T.CylinderGeometry(.3,.3,.04,16),std({color:0x20242c}),g,0,.62,0);mesh(new T.BoxGeometry(.82,.03,.1),add(0x35f4ff),g,0,.45,.41);A.fan=fan;}
    else{mesh(new T.CylinderGeometry(.04,.08,2.2,6),std({color:0x707888,metalness:.8,roughness:.3}),g,0,1.1,0);const tip=glow(0xff2030,.8,g,0,2.25,0,1);A.tip=tip;mesh(new T.TorusGeometry(.25,.02,4,16),add(0xffd23f),g,0,1.4,0,[Math.PI/2,0,0]);}}
   const up0=A.upd;A.upd=(dt,t)=>{up0(dt,t);if(A.fan)A.fan.rotation.y+=dt*8;if(A.tip)A.tip.material.opacity=Math.sin(t*4)>0?1:.1;};}
  // ---------------- 2: CYBER SHRINE ----------------
  function n3torii(G,x,z,ry,s,mRed,mBlk){const g=new T.Group();g.position.set(x,-1.6,z);g.rotation.y=ry;g.scale.setScalar(s);G.add(g);
   for(const sx of[-2,2]){mesh(new T.CylinderGeometry(.22,.26,5,10),mRed,g,sx,2.5,0);mesh(new T.CylinderGeometry(.32,.32,.4,10),mBlk,g,sx,.2,0);}
   mesh(new T.BoxGeometry(5.6,.3,.45),mRed,g,0,3.9,0);mesh(new T.BoxGeometry(6.6,.32,.6),mRed,g,0,4.8,0);mesh(new T.BoxGeometry(7,.18,.7),mBlk,g,0,5.04,0);mesh(new T.BoxGeometry(.3,.9,.3),mRed,g,0,4.35,0);
   glow(0xff2050,3,g,-2,4.8,0,.5);glow(0xff2050,3,g,2,4.8,0,.5);return g;}
  function n3lantern(G,x,z,col,s){const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(s||1);G.add(g);const st=std({color:0x3a3a44,roughness:.95,metalness:0});
   mesh(new T.BoxGeometry(.7,.2,.7),st,g,0,.1,0);mesh(new T.CylinderGeometry(.12,.16,.9,8),st,g,0,.65,0);mesh(new T.BoxGeometry(.55,.14,.55),st,g,0,1.15,0);
   mesh(new T.BoxGeometry(.38,.36,.38),add(col,.9),g,0,1.4,0);mesh(new T.ConeGeometry(.52,.35,4),st,g,0,1.76,0,[0,Math.PI/4,0]);mesh(new T.SphereGeometry(.07,6,4),st,g,0,1.98,0);const gl=glow(col,2.2,g,0,1.4,0,.7);return gl;}
  function arenaShrine(A,G){tileStyle({tile:0x0e0a0e,rough:.6,metal:.3,edge:[0xff3f6a,0xffc0e0],edgeOp:.6,ped:false,bg:0x07040e,fog:0x1a0a24,fogD:.02,exp:1.05});
   lights3(G,0xff80c0,0x100818,.45,0xffd0e8,.6,[[0xff3f6a,1.8,-5,3,-5,18],[0x35f4ff,1.2,5,3,5,18]]);
   skyDome(G,'varying vec3 vp;void main(){float h=vp.y;vec3 c=mix(vec3(.2,.04,.18),vec3(.02,.01,.06),smoothstep(-.1,.5,h));gl_FragColor=vec4(c,1.);}');
   points(G,400,0xffe0f0,.45,()=>{const a=Math.random()*6.283,rad=rr(60,120);return [Math.cos(a)*rad,rr(.05,1)*80,Math.sin(a)*rad];},{fog:false,transparent:false,depthWrite:true});
   const gt=tex(256,256,(c,w,h)=>{c.fillStyle='#0c0a10';c.fillRect(0,0,w,h);c.strokeStyle='#2a2430';c.lineWidth=3;for(let i=0;i<=4;i++){c.beginPath();c.moveTo(i*64,0);c.lineTo(i*64,h);c.moveTo(0,i*64);c.lineTo(w,i*64);c.stroke();}c.strokeStyle='rgba(255,63,106,.35)';c.lineWidth=1;c.strokeRect(1,1,w-2,h-2);});
   gt.wrapS=gt.wrapT=T.RepeatWrapping;gt.repeat.set(40,40);mesh(new T.PlaneGeometry(200,200),std({map:gt,roughness:.35,metalness:.5,envMap:S.env,flatShading:false}),G,0,-1.6,0,[-Math.PI/2,0,0]);
   // stone platform under the board + glowing rim + steps
   const stone=std({color:0x2a2630,roughness:.9,metalness:0});mesh(new T.BoxGeometry(7.9,1.36,7.9),stone,G,0,-.92,0);mesh(new T.BoxGeometry(8.02,.06,8.02),add(0xff3f6a,.8),G,0,-.3,0);
   for(let s=0;s<3;s++)mesh(new T.BoxGeometry(3,.34,.8),stone,G,0,-1.43+s*.0-(0)+s*.36*0,-4.35-s*.8+0,null,[1,1-s*.0,1]);
   // torii row receding into the fog
   const mRed=std({color:0xc01020,emissive:0xc0001a,emissiveIntensity:1,roughness:.4}),mBlk=std({color:0x14101a,roughness:.6});for(let i=0;i<(LOW?4:7);i++)n3torii(G,0,-7-i*5.5,0,1-i*.03,mRed,mBlk);
   // holographic cherry trees (wireframe crowns + pixel petals)
   const crowns=[];const TP=[[-7,-4],[7,-5],[-8,5],[8,4],[-4,-12],[5,-13]].slice(0,LOW?4:6);const wf=[0xff7ac8,0xffb0e0];for(const [i,[x,z]] of TP.entries()){const g=new T.Group();g.position.set(x,-1.6,z);G.add(g);const tr=std({color:0x2a1820,roughness:.8});
    mesh(new T.CylinderGeometry(.18,.32,3.4,7),tr,g,0,1.7,0,[0,0,.08]);for(let b=0;b<3;b++)mesh(new T.CylinderGeometry(.06,.12,1.6,5),tr,g,Math.cos(b*2.1)*.5,3.2,Math.sin(b*2.1)*.5,[Math.sin(b*2.1)*.7,0,-Math.cos(b*2.1)*.7]);
    for(let c=0;c<(LOW?2:4);c++){const m=new T.MeshBasicMaterial({color:wf[c%2],wireframe:true,transparent:true,opacity:.7,blending:T.AdditiveBlending,depthWrite:false});sinkOf().mats.push(m);const cr=mesh(new T.IcosahedronGeometry(1.1+c*.15,1),m,g,Math.cos(c*1.7)*.9,3.9+(c%2)*.5,Math.sin(c*1.7)*.9);cr.userData.id=crowns.length;crowns.push(cr);}
    glow(0xff7ac8,6,g,0,4,0,.35);}
   const NP=LOW?220:600,pet=points(G,NP,0xff9ad8,.13,()=>[0,-99,0],{sizeAttenuation:true});const pv=[];for(let i=0;i<NP;i++)pv.push({life:rr(0,4),vx:0,vz:0});
   // stone lanterns around the plaza
   const lg=[];for(const [x,z,c] of[[-5.2,-5.2,0x35f4ff],[5.2,-5.2,0xff3f6a],[-5.2,5.2,0xff3f6a],[5.2,5.2,0x35f4ff],[-2.5,-6.2,0xffd23f],[2.5,-6.2,0xffd23f]])lg.push(n3lantern(G,x,z,c,1.2));G.children.slice(-6).forEach(g=>g.position.y=-1.6);
   // data waterfall
   const wtex=tex(256,512,(c,w,h)=>{c.clearRect(0,0,w,h);c.font='bold 16px monospace';for(let x=0;x<w;x+=14)for(let y=0;y<h;y+=18){const r=Math.random();if(r<.35)continue;c.fillStyle=r<.6?'rgba(125,255,154,.8)':r<.85?'rgba(53,244,255,.8)':'rgba(255,255,255,.95)';c.fillText(String.fromCharCode(r<.5?48+((r*100)|0)%10:0x30A0+((r*1000)|0)%90),x,y);}});
   wtex.wrapS=wtex.wrapT=T.RepeatWrapping;wtex.repeat.set(2,2);const wmat=new T.MeshBasicMaterial({map:wtex,transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide});sinkOf().mats.push(wmat);
   const wf2=mesh(new T.PlaneGeometry(7,26),wmat,G,15,10,-8,[0,-1.05,0]);const rock=std({color:0x2a2630,roughness:.9});mesh(new T.BoxGeometry(3,28,6),rock,G,17,8,-10,[0,-1.05,0]);mesh(new T.BoxGeometry(3,28,6),rock,G,12,8,-5,[0,-1.05,0]);
   mesh(new T.CircleGeometry(4,24),add(0x7dff9a,.35),G,14.5,-1.58,-7.5,[-Math.PI/2,0,0]);const mist=[glow(0x7dff9a,8,G,14.5,-.5,-7.5,.35),glow(0x35f4ff,6,G,14,1,-7,.25)];
   // floating wireframe moon
   const mm=new T.MeshBasicMaterial({color:0xcff8ff,wireframe:true,transparent:true,opacity:.8,fog:false});sinkOf().mats.push(mm);const moon=mesh(new T.IcosahedronGeometry(7,2),mm,G,-34,34,-62);const mg=glow(0x9ff0ff,40,G,-34,34,-62,.4);mg.material.fog=false;
   const inner=mesh(new T.IcosahedronGeometry(6.2,1),add(0x35f4ff,.12),G,-34,34,-62);
   for(const k of BLOCKED){const w=w3(TB.board.pos(k));lg.push(n3lantern(G,w.x,w.z,0xff3f6a,.7));}
   A.upd=(dt,t)=>{moon.rotation.y+=dt*.08;moon.rotation.x+=dt*.03;inner.rotation.y-=dt*.1;wtex.offset.y+=dt*.35;for(const c of crowns){c.rotation.y+=dt*.2;c.material.opacity=.55+.25*Math.sin(t*3+c.userData.id);}
    for(let i=0;i<lg.length;i++)lg[i].material.opacity=.55+.2*Math.sin(t*2.3+i*1.7)+(Math.random()<.02?-.4:0);mist[0].material.opacity=.3+.08*Math.sin(t*3);
    const a=pet.geometry.attributes.position.array;for(let i=0;i<NP;i++){const p=pv[i];p.life-=dt;if(p.life<=0){const tr=TP[i%TP.length];p.life=rr(3,6);a[i*3]=tr[0]+rr(-1.6,1.6);a[i*3+1]=rr(1.5,3.5);a[i*3+2]=tr[1]+rr(-1.6,1.6);p.vx=rr(.2,.8);p.vz=rr(-.3,.3);}
     a[i*3]+=(p.vx+Math.sin(t*2+i)*.4)*dt;a[i*3+1]-=dt*.55;a[i*3+2]+=(p.vz+Math.cos(t*1.7+i)*.3)*dt;}pet.geometry.attributes.position.needsUpdate=true;};}
  // ---------------- 3: UNDERGROUND DATA CORE ----------------
  function arenaDatacore(A,G){tileStyle({tile:0x0a1210,rough:.3,metal:.9,emis:0x000806,edge:[0x7dff9a,0x35f4ff],edgeOp:.75,ped:false,bg:0x010305,fog:0x021014,fogD:.032,exp:1.1});
   const PL=lights3(G,0x40ffc0,0x001008,.35,0xa0fff0,.4,[[0x35f4ff,2.4,0,-2.5,0,14],[0x7dff9a,1.2,-6,4,-6,18],[0xff3040,.8,6,4,6,18]]);
   const ft=tex(256,256,(c,w,h)=>{c.fillStyle='#000';c.fillRect(0,0,w,h);c.strokeStyle='rgba(53,244,255,.7)';c.lineWidth=2;c.strokeRect(0,0,w,h);c.strokeStyle='rgba(125,255,154,.25)';c.beginPath();c.moveTo(w/2,0);c.lineTo(w/2,h);c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();});
   ft.wrapS=ft.wrapT=T.RepeatWrapping;ft.repeat.set(30,30);mesh(new T.PlaneGeometry(120,120),new T.MeshBasicMaterial({map:ft,transparent:true,opacity:.8}),G,0,-9,0,[-Math.PI/2,0,0]);sinkOf().mats.push(G.children[G.children.length-1].material);
   mesh(new T.CylinderGeometry(40,40,40,24,1,true),std({color:0x05080a,roughness:.9,side:T.BackSide}),G,0,5,0);
   // reactor core beneath the board
   const beam=mesh(new T.CylinderGeometry(.9,1.4,9,24,1,true),add(0x35f4ff,.35),G,0,-4.6,0);const core=mesh(new T.IcosahedronGeometry(1.3,1),new T.MeshBasicMaterial({color:0xd8ffff}),G,0,-4.8,0);sinkOf().mats.push(core.material);
   const shell=mesh(new T.IcosahedronGeometry(1.8,1),new T.MeshBasicMaterial({color:0x35f4ff,wireframe:true,transparent:true,opacity:.6}),G,0,-4.8,0);sinkOf().mats.push(shell.material);
   const rings=[0,1,2].map(i=>mesh(new T.TorusGeometry(2.4+i*.6,.05,6,48),add(i===1?0x7dff9a:0x35f4ff,.9),G,0,-4.8,0));const cg=[glow(0x35f4ff,9,G,0,-4.8,0,.8),glow(0xffffff,4,G,0,-4.8,0,.9)];
   const halo=mesh(new T.TorusGeometry(5.3,.06,6,64),add(0x7dff9a,.9),G,0,-.32,0,[Math.PI/2,0,0]);for(let i=0;i<4;i++){const a=i/4*6.283+.785;mesh(new T.BoxGeometry(.3,.3,5),std({color:0x20282a,metalness:.9,roughness:.3,envMap:S.env}),G,Math.cos(a)*3.2,-.6,Math.sin(a)*3.2,[0,-a+Math.PI/2,0]);}
   const cond=[];for(let i=0;i<4;i++){const a=i/4*6.283+.785,x=Math.cos(a)*5.4,z=Math.sin(a)*5.4;cond.push(mesh(new T.CylinderGeometry(.12,.12,8,8,1,true),add(0x35f4ff,.6),G,x,-3.5,z));mesh(new T.CylinderGeometry(.3,.3,8,8,1,true),std({color:0x1a2226,metalness:.9,roughness:.3,transparent:true,opacity:.35,envMap:S.env}),G,x,-3.5,z);cond.push(glow(0x35f4ff,1.4,G,x,.55,z,.9));}
   // server racks (ring) with LED points
   const ledT=tex(64,256,(c,w,h)=>{c.fillStyle='#07090b';c.fillRect(0,0,w,h);c.fillStyle='#1a2226';for(let y=0;y<h;y+=16)c.fillRect(2,y+2,w-4,12);c.fillStyle='#0f1416';for(let y=0;y<h;y+=16)c.fillRect(6,y+6,w-26,4);});ledT.wrapT=T.RepeatWrapping;
   const rm=std({color:0xffffff,map:ledT,roughness:.5,metalness:.7,envMap:S.env,envMapIntensity:.4});const racks=[];const NR=LOW?16:28;for(let i=0;i<NR;i++){const a=i/NR*6.283,r=(i%2?13.5:15.5);const x=Math.cos(a)*r,z=Math.sin(a)*r;
    const h=13+(i%3)*2;const m=mesh(uvScale(new T.BoxGeometry(1.4,h,1.1),1,h/4),rm,G,x,-9+h/2,z,[0,-a,0]);racks.push({x,z,a,h,r});}
   const NL=NR*36,lp=new Float32Array(NL*3),lc=new Float32Array(NL*3),pal=[[.2,1,.5],[.2,.9,1],[1,.2,.25],[1,.8,.2]];let li=0;for(const k of racks){const nx=-Math.cos(k.a),nz=-Math.sin(k.a),tx=-Math.sin(k.a),tz=Math.cos(k.a);
    for(let j=0;j<36;j++){const u=((j%3)-1)*.4,y=-8.5+Math.floor(j/3)*(k.h-1)/12;lp.set([k.x+nx*.72+tx*u,y,k.z+nz*.72+tz*u],li*3);lc.set(pal[(Math.random()*4)|0],li*3);li++;}}
   const lgeo=new T.BufferGeometry();lgeo.setAttribute('position',new T.BufferAttribute(lp,3));lgeo.setAttribute('color',new T.BufferAttribute(lc,3));const lmat=new T.PointsMaterial({size:.13,vertexColors:true});sinkOf().mats.push(lmat);const leds=new T.Points(lgeo,lmat);leds.frustumCulled=false;G.add(leds);const ledOn=new Float32Array(lc);
   // pulsing cable bundles from rack tops down to the core
   const ct=tex(128,16,(c,w,h)=>{c.fillStyle='#000';c.fillRect(0,0,w,h);const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.8,'#35f4ff');g.addColorStop(1,'#ffffff');c.fillStyle=g;c.fillRect(0,4,w,8);});ct.wrapS=T.RepeatWrapping;ct.repeat.set(6,1);
   const cm=std({color:0x0a0e10,roughness:.6,emissive:0xffffff,emissiveMap:ct,flatShading:false});for(let i=0;i<(LOW?4:10);i++){const k=racks[(i*3)%NR];const a=k.a+rr(-.1,.1);
    const curve=new T.CatmullRomCurve3([V3(k.x*.95,-9+k.h*.45,k.z*.95),V3(Math.cos(a)*9,-9+k.h*.4,Math.sin(a)*9),V3(Math.cos(a)*4,-4,Math.sin(a)*4),V3(Math.cos(a)*1.6,-6.5,Math.sin(a)*1.6)]);mesh(new T.TubeGeometry(curve,LOW?20:40,.12+(i%3)*.04,6,false),cm,G);}
   // sparks
   const NS=LOW?70:160,sp=points(G,NS,0xffd080,.12,()=>[0,-99,0],{blending:T.AdditiveBlending});const sv=[];for(let i=0;i<NS;i++)sv.push({vx:0,vy:0,vz:0,life:0});let spT=0;
   // scanning lasers
   const lz=[];for(let i=0;i<2;i++){const g=new T.Group();G.add(g);g.position.y=.9;mesh(new T.BoxGeometry(.03,.03,16),add(0xff2040,.9),g);mesh(new T.PlaneGeometry(16,.8),add(0xff2040,.12),g,0,0,0,[0,Math.PI/2,0]);lz.push(g);}
   const scan=mesh(new T.RingGeometry(13,16,48),add(0x7dff9a,.18),G,0,0,0,[-Math.PI/2,0,0]);
   const dust=points(G,LOW?90:200,0x9ff8ff,.06,()=>[rr(-9,9),rr(-8,6),rr(-9,9)],{opacity:.6});
   for(const k of BLOCKED){const w=w3(TB.board.pos(k)),g=new T.Group();g.position.set(w.x,0,w.z);G.add(g);mesh(new T.BoxGeometry(.62,1.1,.62),std({color:0x14181a,metalness:.9,roughness:.3,envMap:S.env}),g,0,.55,0);
    mesh(new T.BoxGeometry(.64,.04,.64),add(0x7dff9a),g,0,.95,0);mesh(new T.BoxGeometry(.64,.04,.64),add(0x7dff9a),g,0,.25,0);glow(0x7dff9a,1.4,g,0,1.2,0,.5);}
   A.upd=(dt,t)=>{const pu=.5+.5*Math.sin(t*3.2);core.scale.setScalar(1+pu*.12);shell.rotation.y+=dt*.6;shell.rotation.x+=dt*.2;rings.forEach((r,i)=>{r.rotation.x=t*(.6+i*.3);r.rotation.y=t*(.4-i*.2);});cg[0].material.opacity=.5+pu*.4;cg[0].scale.setScalar(8+pu*3);
    beam.material.opacity=.25+pu*.2;PL[0].intensity=(1.8+pu*1.4)*PLK;halo.material.opacity=.5+pu*.4;cond.forEach((c,i)=>c.material.opacity=(i%2?.6:.4)+.4*Math.sin(t*6-i));ct.offset.x-=dt*1.4;
    for(let i=0;i<40;i++){const j=(Math.random()*NL)|0,on=Math.random()<.6;lc[j*3]=on?ledOn[j*3]:.05;lc[j*3+1]=on?ledOn[j*3+1]:.05;lc[j*3+2]=on?ledOn[j*3+2]:.05;}lgeo.attributes.color.needsUpdate=true;
    lz[0].rotation.y=t*.7;lz[1].rotation.y=-t*.5+1.3;lz[1].position.y=.9+Math.sin(t*.8)*.4;scan.position.y=-8+((t*2.2)%14);scan.material.opacity=.18*(1-((t*2.2)%14)/14);
    spT-=dt;const a=sp.geometry.attributes.position.array;if(spT<=0){spT=rr(.25,.9);const k=racks[(Math.random()*NR)|0];let n=0;for(let i=0;i<NS&&n<18;i++)if(sv[i].life<=0){a[i*3]=k.x*.95;a[i*3+1]=-9+k.h*rr(.3,.6);a[i*3+2]=k.z*.95;sv[i].vx=rr(-2,2)-k.x*.1;sv[i].vy=rr(1,4);sv[i].vz=rr(-2,2)-k.z*.1;sv[i].life=rr(.5,1.1);n++;}}
    for(let i=0;i<NS;i++){const s=sv[i];if(s.life<=0){a[i*3+1]=-99;continue;}s.life-=dt;s.vy-=9*dt;a[i*3]+=s.vx*dt;a[i*3+1]+=s.vy*dt;a[i*3+2]+=s.vz*dt;}sp.geometry.attributes.position.needsUpdate=true;
    const d=dust.geometry.attributes.position.array;for(let i=0;i<d.length;i+=3){d[i+1]+=dt*.25;if(d[i+1]>6)d[i+1]=-8;}dust.geometry.attributes.position.needsUpdate=true;};}



  /* ---------- bespoke collectable designs (keyed by name, then first word, then id; generic fallback) ---------- */
  const DESIGN_BY_NAME = { "nova spark": "nova", "volt whisker": "volt", "pixel purr": "pixel", "chrome tail": "chrome", "glitch mittens": "glitch", "astra paw": "astra" };
  const DESIGN_BY_WORD = { nova: "nova", volt: "volt", pixel: "pixel", chrome: "chrome", glitch: "glitch", astra: "astra" };
  const DESIGN_BY_ID = { c1: "nova", c2: "volt", c3: "pixel", c4: "chrome", c5: "glitch", c6: "astra" };
  function designOf(p) {
    const n = p.name.trim().toLowerCase();
    return DESIGN_BY_NAME[n] || DESIGN_BY_WORD[n.split(/\s+/)[0]] || (p.src && DESIGN_BY_ID[String(p.src.id || "").toLowerCase()]) || null;
  }
  // shared unit geometries (one GPU buffer each, reused by every cat and both sides); freed in destroy()
  function SG(key, make) { if (!S.geo) S.geo = new Map(); let g = S.geo.get(key); if (!g) { g = make(); g.userData.shared = true; S.geo.set(key, g); } return g; }
  const gBox = () => SG("box", () => new T.BoxGeometry(1, 1, 1)), gTaper = () => SG("taper8", () => new T.CylinderGeometry(.35, .5, 1, 8)), gCyl = () => SG("cyl6", () => new T.CylinderGeometry(.5, .5, 1, 6));
  const gCone = () => SG("cone4", () => new T.ConeGeometry(.5, 1, 4)), gCone6 = () => SG("cone6", () => new T.ConeGeometry(.5, 1, 6)), gIco0 = () => SG("ico0", () => new T.IcosahedronGeometry(.5, 0));
  const gIco1 = () => SG("ico1", () => new T.IcosahedronGeometry(.5, 1)), gSph = () => SG("sph", () => new T.SphereGeometry(.5, 8, 6)), gOct = () => SG("oct", () => new T.OctahedronGeometry(.5, 0));
  const gRingLo = () => SG("torusLo", () => new T.TorusGeometry(.5, .05, 3, 10)), gRing = () => SG("torusThin", () => new T.TorusGeometry(.5, .035, 4, 24)), gRingFat = () => SG("torusFat", () => new T.TorusGeometry(.5, .13, 5, 14)), gDisc = () => SG("circle", () => new T.CircleGeometry(.5, 16));
  // merge static parts into one geometry (one draw call): parts = [[geo, [x,y,z], [rx,ry,rz], [sx,sy,sz]] | [geo, Matrix4]]
  function mergeParts(parts) {
    const pos = [], nor = [], m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), s = new T.Vector3();
    for (const pt of parts) {
      const g = pt[0].index ? pt[0].toNonIndexed() : pt[0].clone();
      if (pt[1] && pt[1].isMatrix4) m.copy(pt[1]); else m.compose(v.set(...(pt[1] || [0, 0, 0])), q.setFromEuler(e.set(...(pt[2] || [0, 0, 0]))), s.set(...(pt[3] || [1, 1, 1])));
      g.applyMatrix4(m); pos.push(g.attributes.position.array); nor.push(g.attributes.normal.array); g.dispose();
    }
    const cat = arrs => { let n = 0; for (const a of arrs) n += a.length; const o = new Float32Array(n); let k = 0; for (const a of arrs) { o.set(a, k); k += a.length; } return o; };
    const out = new T.BufferGeometry(); out.setAttribute("position", new T.BufferAttribute(cat(pos), 3)); out.setAttribute("normal", new T.BufferAttribute(cat(nor), 3)); return out;
  }
  const SM = (key, parts) => SG(key, () => mergeParts(parts()));
  // a curling chain (tails, cables): returns per-segment matrices
  function chain(n, step, bend, scaleK, twist) { const out = [], M = new T.Matrix4(), tmp = new T.Matrix4(); let sc = 1;
    for (let i = 0; i < n; i++) { const seg = M.clone().multiply(tmp.makeScale(sc, sc, sc)); out.push(seg); M.multiply(tmp.makeTranslation(0, step * sc, 0)).multiply(tmp.makeRotationX(bend)); if (twist) M.multiply(tmp.makeRotationZ(twist)); sc *= scaleK; } return out; }
  function patternTex(p, kind) {
    const L = p.look, main = hsl(p.hue, 88, 58), acc = hsl(L.acc, 100, 62), R2 = mulberry(hash(p.name + kind));
    const t = tex(128, 128, (c, w, h) => {
      c.fillStyle = hsl(p.hue, 50, 15); c.fillRect(0, 0, w, h);
      if (kind === "rays") { c.strokeStyle = main; c.lineWidth = 5; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; c.beginPath(); c.moveTo(w / 2, h * .35); c.lineTo(w / 2 + Math.cos(a) * w, h * .35 + Math.sin(a) * w); c.stroke(); } }
      if (kind === "bolts") { c.strokeStyle = main; c.lineWidth = 6; for (let i = 0; i < 4; i++) { let x = i * 34 + 6; c.beginPath(); c.moveTo(x, 0); for (let y = 0; y < h; y += 18) { x += (y / 18) % 2 ? 10 : -10; c.lineTo(x, y + 18); } c.stroke(); } }
      if (kind === "pixel") { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const r = R2(); c.fillStyle = r < .45 ? hsl(p.hue, 70, 40) : r < .8 ? main : r < .93 ? hsl(p.hue, 80, 75) : acc; c.fillRect(x * 16, y * 16, 16, 16); } }
      if (kind === "plates") { c.fillStyle = hsl(p.hue, 60, 35); for (let y = 0; y < h; y += 32) c.fillRect(0, y, w, 26); c.fillStyle = main; for (let x = -h; x < w; x += 24) { c.beginPath(); c.moveTo(x, h - 16); c.lineTo(x + 10, h - 16); c.lineTo(x + 20, h); c.lineTo(x + 10, h); c.fill(); } }
      if (kind === "glitch") { for (let y = 0; y < h; y += 8) { const off = (R2() - .5) * 40; c.fillStyle = R2() < .3 ? acc : R2() < .6 ? main : hsl(p.hue + 180, 90, 60, .7); c.fillRect(off + R2() * 40, y, 30 + R2() * 70, 5); } }
      if (kind === "stars") { c.fillStyle = main; for (let i = 0; i < 9; i++) { const x = R2() * w, y = R2() * h, r = 5 + R2() * 7; c.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283 - Math.PI / 2, rr2 = k % 2 ? r * .45 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } c.fill(); } }
      c.fillStyle = acc; c.fillRect(0, h - 7, w, 4);
    });
    if (kind === "pixel") { t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; }
    return t;
  }
  function buildDesign(p, kind, res) {
    const L = p.look, acc = hslC(L.acc, 100, 62), g = new T.Group(), P = { kind }, body = new T.Group(); g.add(body); P.body = body;
    const fur = std({ color: hslC(p.hue, 70, 60), roughness: .7 }), dark = std({ color: hslC(p.hue, 50, 24), roughness: .6 }), light = std({ color: hslC(p.hue, 30, 90), roughness: .8 });
    const accA = add(acc), glowA = add(hslC(p.hue + 15, 100, 66), .95), nose = std({ color: 0xff7aa8 }), chrome = S.chrome;
    const robeMat = pat => { const t = patternTex(p, pat); return std({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .35, roughness: .5, metalness: .15 }); };
    const M = (geo, mat, par, x, y, z, rot, sc) => mesh(geo, mat, par || body, x, y, z, rot, sc);
    const head = y => { const H = new T.Group(); H.position.y = y; body.add(H); P.head = H; return H; };
    const arm = (x, y, mat, handMat, hs, handGeo) => { const A = new T.Group(); A.position.set(x, y, 0); body.add(A); M(gCyl(), mat, A, 0, -.15, 0, null, [.18, .34, .18]); M(handGeo || gSph(), handMat, A, 0, -.34, 0, null, [hs, hs, hs]); P.arm = A; return A; };
    const tailG = (y, z) => { const t = new T.Group(); t.position.set(0, y, z); body.add(t); P.tail = t; return t; };
    let shadowR = .42, scale = 1;

    if (kind === "nova") {                       // NOVA SPARK — sleek, solar-flare mane, plasma tail, visor
      const robe = robeMat("rays"); M(gTaper(), robe, body, 0, .39, 0, null, [.64, .78, .64]); M(gRing(), accA, body, 0, .54, 0, [Math.PI / 2, 0, 0], [.5, .5, .5]);
      const H = head(1.0); M(gIco1(), fur, H, 0, 0, 0, null, [.52, .47, .5]); M(gIco1(), light, H, 0, -.08, .17, null, [.33, .21, .18]);
      for (const s of [-1, 1]) M(gCone(), fur, H, s * .14, .28, 0, [0, 0, -s * .22], [.15, .34, .15]);
      M(gBox(), accA, H, 0, .03, .21, null, [.5, .08, .12]); M(gCone(), nose, H, 0, -.06, .28, [Math.PI / 2, 0, 0], [.07, .05, .07]);
      const mane = new T.Group(); mane.position.set(0, .02, -.1); H.add(mane); P.mane = mane;
      M(SM("novaManeA", () => { const o = []; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283, L2 = i % 2 ? .3 : .46; o.push([gCone(), [Math.cos(a) * (.2 + L2 / 2), Math.sin(a) * (.2 + L2 / 2), 0], [0, 0, a - Math.PI / 2], [.12, L2, .07]]); } return o; }), glowA, mane);
      M(SM("novaManeB", () => { const o = []; for (let i = 0; i < 10; i++) { const a = (i + .5) / 10 * 6.283; o.push([gCone(), [Math.cos(a) * .3, Math.sin(a) * .3, -.03], [0, 0, a - Math.PI / 2], [.1, .22, .06]]); } return o; }), fur, mane);
      glow(hslC(p.hue + 15, 100, 66), 1.4, mane, 0, 0, -.05, .45);
      const tl = tailG(.25, -.3); tl.rotation.x = -1.0;
      M(SM("novaFlame", () => [[gCone6(), [0, .18, 0], null, [.16, .36, .16]], [gCone6(), [0, .42, .02], [.3, 0, 0], [.11, .3, .11]], [gCone6(), [0, .62, .07], [.5, 0, 0], [.07, .24, .07]]]), glowA, tl);
      M(gCyl(), fur, tl, 0, .05, 0, null, [.1, .14, .1]);
      arm(.28, .64, robe, light, .14);
      P.anim = (dt, t) => { mane.rotation.z += dt * .7; const k = 1 + Math.sin(t * 5) * .06; mane.scale.set(k, k, 1); };
      shadowR = .36;
    }
    else if (kind === "volt") {                  // VOLT WHISKER — lanky on long legs, antenna whiskers with live arcs, lightning tail
      const robe = robeMat("bolts"); M(gTaper(), robe, body, 0, .67, 0, null, [.56, .9, .56]);
      M(SM("voltLegs", () => [[gCyl(), [-.11, .12, 0], null, [.09, .3, .09]], [gCyl(), [.11, .12, 0], null, [.09, .3, .09]], [gBox(), [-.11, -.02, .04], null, [.12, .05, .18]], [gBox(), [.11, -.02, .04], null, [.12, .05, .18]]]), dark);
      M(gRing(), accA, body, 0, .82, 0, [Math.PI / 2, 0, 0], [.48, .48, .48]);
      const H = head(1.32); M(gIco1(), fur, H, 0, 0, 0, null, [.48, .44, .47]); M(gIco1(), light, H, 0, -.08, .16, null, [.3, .2, .17]);
      M(SM("voltEars", () => [[gCone(), [-.13, .31, 0], [0, 0, .32], [.13, .44, .13]], [gCone(), [.13, .31, 0], [0, 0, -.32], [.13, .44, .13]]]), fur, H);
      M(SM("voltEarTips", () => [[gOct(), [-.21, .53, 0], null, [.07, .1, .07]], [gOct(), [.21, .53, 0], null, [.07, .1, .07]]]), accA, H);
      const eyeM = std({ color: acc, emissive: acc, emissiveIntensity: .9 }); M(SM("twinEyes", () => [[gSph(), [-.1, .03, .21], null, [.1, .1, .1]], [gSph(), [.1, .03, .21], null, [.1, .1, .1]]]), eyeM, H);
      M(gCone(), nose, H, 0, -.05, .27, [Math.PI / 2, 0, 0], [.07, .05, .07]);
      const tips = []; const whisk = [];
      for (const s of [-1, 1]) for (const a of [-.22, 0, .22]) { const len = .62; const x0 = s * .1, y0 = -.06, dx = Math.cos(a) * len * s, dy = Math.sin(a) * len; whisk.push([gBox(), [x0 + dx / 2, y0 + dy / 2, .2], [0, 0, a * s], [len, .016, .016]]); tips.push([x0 + dx, y0 + dy, .2]); }
      M(SM("voltWhisk", () => whisk), chrome, H); M(SM("voltTips", () => tips.map(t => [gOct(), t, null, [.07, .07, .07]])), accA, H);
      const AN = 2 * 6 * 2, ap = new Float32Array(AN * 3), ag = new T.BufferGeometry(); ag.setAttribute("position", new T.BufferAttribute(ap, 3));
      const am = new T.LineBasicMaterial({ color: hslC(L.acc, 100, 80), transparent: true, blending: T.AdditiveBlending, depthWrite: false }); res.mats.push(am);
      const arcs = new T.LineSegments(ag, am); arcs.frustumCulled = false; H.add(arcs); let at = 0;
      const tl = tailG(.55, -.26); M(SM("voltBolt", () => [[gBox(), [0, .1, 0], [.5, 0, 0], [.07, .24, .07]], [gBox(), [0, .2, -.14], [-.9, 0, 0], [.07, .22, .07]], [gBox(), [0, .33, -.2], [.5, 0, 0], [.07, .26, .07]], [gCone(), [0, .5, -.28], [-.5, 0, 0], [.12, .18, .08]]]), accA, tl);
      arm(.26, .92, robe, light, .13);
      P.anim = (dt, t, f) => { at -= dt; if (at > 0) return; at = .06 + Math.random() * .05; let k = 0;
        for (let b = 0; b < 2; b++) { const s = tips[(Math.random() * tips.length) | 0]; let x = s[0], y = s[1], z = s[2]; const dx = Math.sign(x) * .06; for (let j = 0; j < 6; j++) { const nx = x + dx + rr(-.04, .04), ny = y + rr(-.07, .05), nz = z + rr(-.05, .05); ap.set([x, y, z, nx, ny, nz], k); k += 6; x = nx; y = ny; z = nz; } }
        ag.attributes.position.needsUpdate = true; arcs.visible = Math.random() < (f && f.atk ? .95 : .7); };
      shadowR = .34;
    }
    else if (kind === "pixel") {                 // PIXEL PURR — small, all voxels: cube body/head, stepped ears, stair tail, orbiting pixels
      scale = .86; const pxT = patternTex(p, "pixel"), robe = std({ map: pxT, roughness: .6, emissive: 0xffffff, emissiveMap: pxT, emissiveIntensity: .25 });
      M(gBox(), robe, body, 0, .3, 0, null, [.58, .5, .48]); M(SM("pixFeet", () => [[gBox(), [-.17, .03, .12], null, [.14, .08, .14]], [gBox(), [.17, .03, .12], null, [.14, .08, .14]]]), dark);
      const H = head(.83); M(gBox(), fur, H, 0, 0, 0, null, [.52, .44, .44]); M(gBox(), light, H, 0, -.1, .2, null, [.24, .14, .08]);
      M(SM("pixEars", () => [[gBox(), [-.17, .28, 0], null, [.15, .13, .12]], [gBox(), [-.2, .39, 0], null, [.08, .09, .1]], [gBox(), [.17, .28, 0], null, [.15, .13, .12]], [gBox(), [.2, .39, 0], null, [.08, .09, .1]]]), fur, H);
      M(SM("pixEyes", () => [[gBox(), [-.12, .04, .225], null, [.1, .1, .02]], [gBox(), [.12, .04, .225], null, [.1, .1, .02]]]), accA, H);
      M(gBox(), nose, H, 0, -.07, .245, null, [.06, .04, .03]);
      const tl = tailG(.4, -.26); M(SM("pixTail", () => [0, 1, 2, 3].map(i => [gBox(), [0, i * .11, -i * .1], null, [.12, .12, .12]])), fur, tl);
      M(gBox(), accA, tl, 0, .44, -.4, null, [.1, .1, .1]);
      const A = new T.Group(); A.position.set(.33, .5, 0); body.add(A); M(gBox(), fur, A, 0, -.13, 0, null, [.12, .26, .12]); M(gBox(), light, A, 0, -.3, 0, null, [.14, .12, .14]); P.arm = A;
      const orb = new T.Group(); orb.position.y = .8; body.add(orb); M(SM("pixOrbit", () => [0, 1, 2, 3].map(i => [gBox(), [Math.cos(i * 1.571) * .55, (i % 2) * .15, Math.sin(i * 1.571) * .55], [i, i, 0], [.07, .07, .07]])), accA, orb);
      P.anim = (dt, t) => { orb.rotation.y += dt * 1.6; orb.position.y = .8 + Math.sin(t * 2) * .05; };
      shadowR = .4;
    }
    else if (kind === "chrome") {                // CHROME TAIL — chunky, chrome pauldrons + helmet, long segmented chrome tail arching overhead
      scale = 1.05; const robe = robeMat("plates"); M(gTaper(), robe, body, 0, .37, 0, null, [.9, .74, .9]);
      M(SM("ctArmor", () => [[gIco0(), [-.4, .74, 0], [0, 0, .45], [.4, .24, .42]], [gIco0(), [.4, .74, 0], [0, 0, -.45], [.4, .24, .42]], [gBox(), [0, .44, .42], [-.2, 0, 0], [.42, .3, .08]], [gRingFat(), [0, .54, 0], [Math.PI / 2, 0, 0], [.66, .66, .66]]]), chrome);
      const H = head(.97); M(gIco1(), fur, H, 0, 0, 0, null, [.58, .5, .55]); M(gIco1(), light, H, 0, -.09, .18, null, [.32, .2, .18]);
      M(gIco0(), chrome, H, 0, .12, -.02, null, [.62, .36, .62]); M(gBox(), accA, H, 0, .03, .25, null, [.44, .05, .08]); M(gBox(), chrome, H, 0, -.15, .17, null, [.28, .08, .16]);
      M(SM("ctEars", () => [[gSph(), [-.19, .24, 0], null, [.16, .16, .09]], [gSph(), [.19, .24, 0], null, [.16, .16, .09]]]), chrome, H);
      const tl = tailG(.25, -.4); tl.rotation.x = -.75; const segs = chain(11, .17, .25, .95);
      const tchrome = std({ color: 0xeef2fa, metalness: .85, roughness: .2, envMap: S.env, envMapIntensity: 1.4, emissive: hslC(p.hue, 70, 22) });
      M(SM("ctTail", () => segs.map(m => [gIco0(), m.clone().multiply(new T.Matrix4().makeScale(.21, .21, .21))])), tchrome, tl);
      M(SM("ctTailRings", () => segs.filter((m, i) => i % 2).map(m => [gRingLo(), m.clone().multiply(new T.Matrix4().makeTranslation(0, .06, 0)).multiply(new T.Matrix4().makeRotationX(Math.PI / 2)).multiply(new T.Matrix4().makeScale(.19, .19, .19))])), accA, tl);
      const end = segs[segs.length - 1].clone().multiply(new T.Matrix4().makeTranslation(0, .16, 0)); const blade = M(gCone(), accA, tl); blade.applyMatrix4(end); blade.scale.multiply(new T.Vector3(.12, .26, .08));
      const A = new T.Group(); A.position.set(.42, .66, 0); body.add(A); M(gCyl(), chrome, A, 0, -.15, 0, null, [.2, .34, .2]); M(gRing(), accA, A, 0, -.1, 0, [Math.PI / 2, 0, 0], [.22, .22, .22]); M(gIco0(), chrome, A, 0, -.36, 0, null, [.18, .18, .18]); P.arm = A;
      shadowR = .5;
    }
    else if (kind === "glitch") {                // GLITCH MITTENS — heavy & squat, huge mitten paws, goggles, drooping cable tail, RGB-split ghosts
      scale = 1.08; const robe = robeMat("glitch"); M(gTaper(), robe, body, 0, .33, 0, null, [1.0, .66, 1.0]);
      const H = head(.9); M(gIco1(), fur, H, 0, 0, 0, null, [.6, .52, .57]); M(gIco1(), light, H, 0, -.1, .19, null, [.34, .22, .18]);
      M(gCone(), fur, H, -.17, .27, 0, [0, 0, .2], [.18, .28, .18]); M(gCone(), fur, H, .24, .18, 0, [0, 0, -1.25], [.18, .28, .18]);
      M(SM("glGog", () => [[gCyl(), [-.12, .05, .25], [Math.PI / 2, 0, 0], [.19, .1, .19]], [gCyl(), [.12, .05, .25], [Math.PI / 2, 0, 0], [.19, .1, .19]], [gBox(), [0, .05, .27], null, [.06, .04, .04]], [gRing(), [0, .05, 0], [0, 0, 0], [.62, .62, .62]]]), dark, H);
      M(SM("glLens", () => [[gDisc(), [-.12, .05, .305], null, [.15, .15, .15]], [gDisc(), [.12, .05, .305], null, [.15, .15, .15]]]), accA, H);
      M(gCone(), nose, H, 0, -.08, .3, [Math.PI / 2, 0, 0], [.07, .05, .07]);
      const mitt = std({ color: hslC(p.hue, 60, 42), roughness: .75 });
      arm(.44, .6, robe, mitt, .3); M(gRingFat(), accA, P.arm, 0, -.22, 0, [Math.PI / 2, 0, 0], [.26, .26, .26]);
      const LA = new T.Group(); LA.position.set(-.44, .6, 0); LA.rotation.set(-.3, 0, .15); body.add(LA); M(gCyl(), robe, LA, 0, -.15, 0, null, [.18, .34, .18]); M(gSph(), mitt, LA, 0, -.36, 0, null, [.3, .3, .3]); M(gRingFat(), accA, LA, 0, -.22, 0, [Math.PI / 2, 0, 0], [.26, .26, .26]);
      const tl = tailG(.18, -.46); tl.rotation.x = -1.2; const cs = chain(12, .09, .16, 1, .05);
      M(SM("glCable", () => { const o = cs.map(m => [gCyl(), m.clone().multiply(new T.Matrix4().makeTranslation(0, .045, 0)).multiply(new T.Matrix4().makeScale(.05, .1, .05))]); const e = cs[cs.length - 1].clone().multiply(new T.Matrix4().makeTranslation(0, .12, 0));
        o.push([gBox(), e.clone().multiply(new T.Matrix4().makeScale(.1, .1, .08))], [gBox(), e.clone().multiply(new T.Matrix4().makeTranslation(-.025, .08, 0)).multiply(new T.Matrix4().makeScale(.015, .07, .015))], [gBox(), e.clone().multiply(new T.Matrix4().makeTranslation(.025, .08, 0)).multiply(new T.Matrix4().makeScale(.015, .07, .015))]); return o; }), dark, tl);
      const ghosts = []; for (const [i, c] of [[0, 0xff2bd6], [1, 0x35f4ff]].slice(0, S.low ? 1 : 2)) { const gg = new T.Group(); body.add(gg); const gm = add(c, .28); M(gTaper(), gm, gg, 0, .33, 0, null, [1.0, .66, 1.0]); M(gIco1(), gm, gg, 0, .9, 0, null, [.6, .52, .57]); ghosts.push(gg); }
      const vox = M(SM("glVox", () => [0, 1, 2, 3, 4].map(i => [gBox(), [Math.cos(i * 2.4) * .5, .2 + i * .22, Math.sin(i * 2.4) * .5], [i, i * .5, 0], [.08, .08, .08]])), accA, body);
      let gt = 0; P.anim = (dt, t, f) => { gt -= dt; if (gt > 0) return; gt = .05 + Math.random() * .12; const hot = f && (f.flash > 0 || f.atk) ? 2 : 1;
        ghosts.forEach((gg, i) => { gg.visible = Math.random() < .75; gg.position.set((i ? -1 : 1) * rr(.02, .07) * hot, rr(-.02, .02), rr(-.03, .03)); });
        vox.rotation.y = rr(0, 6.28); vox.position.y = rr(-.05, .05); H.position.x = Math.random() < .12 ? rr(-.05, .05) * hot : 0; };
      shadowR = .55;
    }
    else if (kind === "astra") {                 // ASTRA PAW — hovers on jets, big starred halo, star-tipped ears, fluffy comet tail
      scale = .98; const robe = robeMat("stars"); P.hover = .3; body.position.y = .3;
      M(gTaper(), robe, body, 0, .34, 0, null, [.62, .68, .62]); M(gRing(), accA, body, 0, .5, 0, [Math.PI / 2, 0, 0], [.47, .47, .47]);
      M(SM("asJets", () => [[gCone6(), [-.13, -.04, 0], [Math.PI, 0, 0], [.14, .16, .14]], [gCone6(), [.13, -.04, 0], [Math.PI, 0, 0], [.14, .16, .14]]]), chrome);
      const flame = M(SM("asFlame", () => [[gCone6(), [-.13, -.2, 0], [Math.PI, 0, 0], [.1, .22, .1]], [gCone6(), [.13, -.2, 0], [Math.PI, 0, 0], [.1, .22, .1]]]), add(hslC(L.acc, 100, 70), .85));
      glow(hslC(L.acc, 100, 66), .9, body, 0, -.28, 0, .6);
      const H = head(.92); M(gIco1(), fur, H, 0, 0, 0, null, [.5, .46, .48]); M(gIco1(), light, H, 0, -.08, .16, null, [.3, .2, .17]);
      M(SM("asEars", () => [[gCone(), [-.14, .3, 0], [0, 0, .25], [.14, .36, .14]], [gCone(), [.14, .3, 0], [0, 0, -.25], [.14, .36, .14]]]), fur, H);
      M(SM("asStarsHead", () => [[gOct(), [-.23, .5, 0], null, [.09, .12, .05]], [gOct(), [.23, .5, 0], null, [.09, .12, .05]], [gOct(), [-.1, .03, .23], null, [.08, .1, .04]], [gOct(), [.1, .03, .23], null, [.08, .1, .04]]]), accA, H);
      M(gCone(), nose, H, 0, -.06, .26, [Math.PI / 2, 0, 0], [.07, .05, .07]);
      const halo = new T.Group(); halo.position.set(0, .5, -.05); halo.rotation.x = 1.25; H.add(halo);
      M(gRing(), accA, halo, 0, 0, 0, null, [.95, .95, .95]); M(SM("asHaloStars", () => [0, 1, 2, 3, 4].map(i => { const a = i / 5 * 6.283; return [gOct(), [Math.cos(a) * .475, Math.sin(a) * .475, 0], null, [.08, .08, .08]]; })), glowA, halo);
      const tl = tailG(.3, -.3); tl.rotation.x = -.7;
      M(SM("asFluff", () => [[gIco0(), [0, .08, 0], null, [.16, .18, .16]], [gIco0(), [0, .22, -.05], null, [.2, .2, .2]], [gIco0(), [0, .38, -.06], null, [.22, .22, .22]], [gIco0(), [0, .53, -.02], null, [.18, .18, .18]], [gIco0(), [0, .64, .05], null, [.12, .12, .12]]]), fur, tl);
      M(gOct(), accA, tl, 0, .74, .1, null, [.09, .09, .09]);
      arm(.28, .6, robe, light, .14);
      P.anim = (dt, t, f) => { body.position.y = .3 + Math.sin(t * 2.4) * .06; halo.rotation.z += dt * .9; flame.scale.set(1, .8 + Math.random() * .5, 1); };
      shadowR = .3;
    }
    const shM = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .45, depthWrite: false }); res.mats.push(shM);
    P.shadow = new T.Group(); P.shadow.position.y = .005; g.add(P.shadow); mesh(gDisc(), shM, P.shadow, 0, 0, 0, [-Math.PI / 2, 0, 0], [shadowR * 2, shadowR * 2, 1]);
    P.scale = 1.55 * scale; g.userData = P; g.scale.setScalar(P.scale); S.board.add(g);
    return g;
  }

  /* ---------- per-character 3D cat (built from the Tora / Mochi base) ---------- */
  function buildCat(p) {
    const res = { mats: [], texs: [] }; S.sink = res;
    try {
      const dk = designOf(p); if (dk) return { g: buildDesign(p, dk, res), res };
      const L = p.look, b = L.bulk, g = new T.Group(), P = {}, body = new T.Group(); g.add(body); P.body = body;
      const acc = hslC(L.acc, 100, 62), accCss = hsl(L.acc, 100, 62);
      const fur = std({ color: hslC(p.hue, 70, 62), roughness: .7 }), furD = std({ color: hslC(p.hue, 55, 30), roughness: .7 }), muz = std({ color: hslC(p.hue, 35, 90) });
      const robeT = tex(256, 256, (c, w, h) => {
        c.fillStyle = hsl(p.hue, 50, 16); c.fillRect(0, 0, w, h); const main = hsl(p.hue, 88, 58), R2 = mulberry(hash(p.name));
        if (L.pat === 0) { c.fillStyle = main; for (let x = -h; x < w; x += 38) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 16, 0); c.lineTo(x + 16 + h, h); c.lineTo(x + h, h); c.fill(); } }
        else if (L.pat === 1) { for (let i = 0; i < 22; i++) { c.fillStyle = i % 3 ? main : accCss; c.beginPath(); c.arc(R2() * w, R2() * h, 7 + R2() * 12, 0, 7); c.fill(); } }
        else if (L.pat === 2) { c.strokeStyle = main; c.lineWidth = 5; for (let i = 0; i < 10; i++) { let x = (i * 53) % w, y = 0; c.beginPath(); c.moveTo(x, y); while (y < h) { y += 20 + (i * 7 % 20); c.lineTo(x, y); x += (i % 2 ? 1 : -1) * 18; c.lineTo(x, y + 12); } c.stroke(); } }
        else { for (let i = 0; i < 14; i++) { const x = (i * 73) % w, y = (i * 131) % h; c.fillStyle = hsl(p.hue + 25, 90, 62); for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283; c.beginPath(); c.arc(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 7, 0, 7); c.fill(); } c.fillStyle = accCss; c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); } }
        c.fillStyle = accCss; c.fillRect(0, h - 10, w, 5);
      });
      const emT = tex(256, 256, (c, w, h) => { c.fillStyle = "#000"; c.fillRect(0, 0, w, h); c.strokeStyle = accCss; c.lineWidth = L.pat === 2 ? 4 : 2; for (let i = 0; i < (L.pat === 2 ? 10 : 4); i++) { let x = (i * 61 + 20) % w, y = 0; c.beginPath(); c.moveTo(x, y); while (y < h) { y += 26; c.lineTo(x, y); x += (i % 2 ? 1 : -1) * 16; c.lineTo(x, y + 10); } c.stroke(); } c.fillStyle = accCss; c.fillRect(0, h - 10, w, 5); });
      const robe = std({ map: robeT, emissive: 0xffffff, emissiveMap: emT, emissiveIntensity: 1.1, roughness: .5, metalness: .15 });
      P.robe = mesh(new T.CylinderGeometry(.26 * b, .4 * b, .72, 8), robe, body, 0, .36, 0);
      mesh(new T.CylinderGeometry(.285 * b, .3 * b, .13, 8), std({ color: hslC(L.acc, 80, 55), metalness: .7, roughness: .25, emissive: hslC(L.acc, 80, 12) }), body, 0, .52, 0);
      // chest card emblem: the character's initial
      const emb = tex(96, 128, (c, w, h) => { c.fillStyle = "#0b0d14"; c.fillRect(0, 0, w, h); c.strokeStyle = accCss; c.lineWidth = 6; c.strokeRect(4, 4, w - 8, h - 8); c.fillStyle = hsl(p.hue, 95, 65); c.font = "900 72px Georgia,serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(p.name[0].toUpperCase(), w / 2, h / 2 + 4); });
      const embM = new T.MeshBasicMaterial({ map: emb }); res.mats.push(embM); mesh(new T.PlaneGeometry(.17, .23), embM, body, 0, .3, .345 * b + .012, [-.19, 0, 0]);
      const H = new T.Group(); H.position.y = .95; body.add(H); P.head = H;
      mesh(new T.IcosahedronGeometry(.27, 1), fur, H, 0, 0, 0, null, [1, .9, .95]); mesh(new T.IcosahedronGeometry(.15, 1), muz, H, 0, -.08, .17, null, [1.1, .7, .6]);
      for (const s of [-1, 1]) {
        if (L.ear === 0) mesh(new T.ConeGeometry(.09, .2, 4), fur, H, s * .15, .24, 0, [0, 0, -s * .25]);
        else if (L.ear === 1) mesh(new T.SphereGeometry(.1, 7, 5), fur, H, s * .16, .21, 0, null, [1, 1, .5]);
        else mesh(new T.ConeGeometry(.075, .32, 4), fur, H, s * .14, .3, 0, [0, 0, -s * .18]);
        if (L.pat === 0) for (let k = 0; k < 3; k++) mesh(new T.BoxGeometry(.03, .1, .02), furD, H, s * .22, .09 - k * .07, .12, [0, 0, s * 1.2]);
      }
      if (L.eyes === 0) { mesh(new T.BoxGeometry(.5, .08, .12), add(acc, .85), H, 0, .03, .21); glow(acc, .9, H, 0, .03, .3, .5); }
      else { const eyeM = std({ color: acc, emissive: acc, emissiveIntensity: .8, roughness: .3 });
        for (const s of [-1, 1]) { mesh(new T.SphereGeometry(.055, 8, 6), eyeM, H, s * .1, .02, .23); mesh(new T.BoxGeometry(.14, .05, .05), fur, H, s * .1, .07, .245, [0, 0, s * -.08]); }
        if (L.eyes === 2) { mesh(new T.TorusGeometry(.085, .013, 6, 20), add(acc), H, .1, .02, .27); glow(acc, .5, H, .1, .02, .3, .6);
          const hudT = tex(128, 96, (c, w, h) => { c.strokeStyle = accCss; c.fillStyle = hsl(L.acc, 100, 62, .18); c.fillRect(2, 2, w - 4, h - 4); c.lineWidth = 3; c.strokeRect(2, 2, w - 4, h - 4); c.fillStyle = accCss; for (let i = 0; i < 5; i++) c.fillRect(10, 14 + i * 14, 20 + ((i * 37) % 70), 6); c.beginPath(); c.arc(w - 26, h / 2, 16, 0, 7); c.stroke(); });
          const hm = new T.MeshBasicMaterial({ map: hudT, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }); res.mats.push(hm); P.hud = mesh(new T.PlaneGeometry(.34, .25), hm, H, .36, .08, .28, [0, -.5, 0]); } }
      mesh(new T.ConeGeometry(.035, .05, 3), std({ color: 0xff7aa8 }), H, 0, -.06, .28, [Math.PI / 2, 0, 0]);
      const tail = new T.Group(); tail.position.set(0, .2, -.33 * b); body.add(tail); P.tail = tail; let prev = tail;
      for (let i = 0; i < 5; i++) { const seg = new T.Group(); seg.position.y = i ? .14 : 0; prev.add(seg); seg.rotation.x = L.tail ? -.55 : -.33;
        mesh(new T.CylinderGeometry(.05, .06, .15, 6), (L.pat <= 1 && i % 2) ? furD : fur, seg, 0, .07, 0); if (i % 2) mesh(new T.TorusGeometry(.065, .012, 4, 10), add(acc), seg, 0, .07, 0, [Math.PI / 2, 0, 0]); prev = seg; }
      P.arm = new T.Group(); P.arm.position.set(.3 * b, .62, 0); body.add(P.arm); mesh(new T.CylinderGeometry(.08, .12, .34, 6), robe, P.arm, 0, -.15, 0); mesh(new T.SphereGeometry(.07, 6, 5), muz, P.arm, 0, -.34, 0);
      // signature accessory from the top stat
      if (L.top === "speed") { const kat = new T.Group(); kat.position.set(0, .6, -.3); kat.rotation.z = .8; body.add(kat); P.katana = kat; mesh(new T.BoxGeometry(.05, .22, .05), std({ color: 0x2a1a14 }), kat, 0, -.12, 0); P.blade = mesh(new T.BoxGeometry(.03, .75, .012), add(hslC(L.acc, 100, 80)), kat, 0, .37, 0); P.bladeCol = new T.Color(hslC(L.acc, 100, 80)); }
      else if (L.top === "weight") { const plate = std({ color: 0xcfd6e6, metalness: 1, roughness: .2, envMap: S.env }); for (const s of [-1, 1]) mesh(new T.BoxGeometry(.2, .1, .26), plate, body, s * .3 * b, .7, 0, [0, 0, s * -.35]); mesh(new T.TorusGeometry(.26 * b, .05, 5, 14), plate, body, 0, .76, 0, [Math.PI / 2, 0, 0]); }
      else { P.halo = mesh(new T.TorusGeometry(.22, .018, 5, 28), add(acc), H, 0, .42, 0, [Math.PI / 2, 0, 0]); glow(acc, .7, H, 0, .42, 0, .35); }
      const shM = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .45, depthWrite: false }); res.mats.push(shM); P.shadow = mesh(new T.CircleGeometry(.42 * b, 20), shM, g, 0, .005, 0, [-Math.PI / 2, 0, 0]);
      g.userData = P; g.scale.setScalar(1.55); S.board.add(g);
      return { g, res };
    } finally { S.sink = null; }
  }
  function rebuildModel(side) {
    if (S.models[side]) freeObj(S.models[side], S.modelRes[side]);
    const m = buildCat(list[sel[side]]); S.models[side] = m.g; S.modelRes[side] = m.res;
  }

  /* ---------- effects ---------- */
  function fxMake(e) {
    const g = new T.Group(); S.board.add(g); e.obj = g; e.res = { mats: [], texs: [] }; S.sink = e.res;
    try {
      const A = e.from ? w3(e.from) : null, Tp = e.to ? w3(e.to) : null, col = e.col; e.A = A; e.T = Tp;
      if (e.kind === "slash") { e.m = mesh(new T.TorusGeometry(.7, .06, 4, 24, Math.PI * 1.2), add(col), g); g.position.copy(A.clone().lerp(Tp, .6)).setY(.8); g.lookAt(Tp.x, .8, Tp.z); e.m.rotation.set(0, Math.PI / 2, 0); glow(col, 1.8, g, 0, 0, 0, .6); }
      if (e.kind === "petal") { e.ps = []; const geo = new T.PlaneGeometry(.14, .08); for (const tp of e.tiles) { const d = w3(tp); for (let i = 0; i < 5; i++) e.ps.push({ m: mesh(geo, add(i % 2 ? col : 0xffffff), g), d, i }); } }
      if (e.kind === "dash") { e.L = A.distanceTo(Tp) || .01; e.m = mesh(new T.BoxGeometry(.14, .14, 1), add(col), g); g.position.copy(A).setY(.7); g.lookAt(Tp.x, .7, Tp.z); e.m2 = mesh(new T.BoxGeometry(.05, .05, 1), add(0xffffff), g); }
      if (e.kind === "beam") { const src = S.models[e.side].position.clone().setY(1.25); const L = src.distanceTo(Tp.clone().setY(.4)) + .3; g.position.copy(src); g.lookAt(Tp.x, .4, Tp.z);
        const geo = new T.CylinderGeometry(1, 1, L, 10, 1, true); geo.rotateX(Math.PI / 2); geo.translate(0, 0, L / 2); e.m = mesh(geo, add(col, .6), g); e.m.scale.set(.12, .12, 1); e.m2 = mesh(geo, add(0xffffff), g); e.m2.scale.set(.04, .04, 1); glow(col, 1.2, g, 0, 0, 0, .9); }
      if (e.kind === "wall") { e.m = mesh(new T.CylinderGeometry(1, 1, 1.2, 28, 1, true), add(col, .7), g, 0, .6, 0); g.position.copy(A); e.m2 = mesh(new T.CylinderGeometry(1, 1, .05, 28, 1, true), add(0xffffff), g, 0, .05, 0); }
      if (e.kind === "bomb") { const who = e.who, cs = hsl(who.hue, 95, 62);
        const card = tex(128, 180, (c, w, h) => { c.fillStyle = "#0b0d14"; c.fillRect(0, 0, w, h); c.strokeStyle = cs; c.lineWidth = 6; c.strokeRect(5, 5, w - 10, h - 10); c.fillStyle = cs; c.font = "900 88px Georgia,serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(who.name[0].toUpperCase(), w / 2, h / 2 + 4); });
        const cm = new T.MeshBasicMaterial({ map: card, side: T.DoubleSide }); e.res.mats.push(cm); e.card = mesh(new T.PlaneGeometry(.9, 1.26), cm, g); e.cg = glow(col, 2.5, g, 0, 0, 0, .6); g.position.copy(Tp);
        e.sph = mesh(new T.IcosahedronGeometry(1, 1), add(col, .8), g, 0, .3, 0); e.sph.visible = false; e.ring = mesh(new T.RingGeometry(.8, 1, 32), add(0xff6a3d, .8), g, 0, .05, 0, [-Math.PI / 2, 0, 0]); e.ring.visible = false; }
      if (e.kind === "hit") { g.position.copy(w3(e)).setY(.8); e.gs = glow(col, 2, g, 0, 0, 0, 1); e.sp = []; const geo = new T.BoxGeometry(.05, .05, .3);
        for (let i = 0; i < 12; i++) { const m = mesh(geo, add(i % 2 ? col : 0xffffff), g); const dir = V3(rr(-1, 1), rr(-.2, 1), rr(-1, 1)).normalize(); m.lookAt(dir); e.sp.push({ m, dir }); } }
    } finally { S.sink = null; }
  }
  function fxStep(e) {
    const k = e.t / e.life, g = e.obj;
    if (e.kind === "slash") { e.m.rotation.z = -1 + k * 2.2; e.m.material.opacity = 1 - k; g.scale.setScalar(.8 + k * .5); }
    if (e.kind === "petal") for (const p of e.ps) { const u = clamp(k * 1.4 - p.i * .06, 0, 1); p.m.position.set(lerp(e.A.x, p.d.x, u) + Math.sin(p.i * 2 + u * 6) * .2, .9 + Math.sin(u * Math.PI) * 1.8 - u * .8, lerp(e.A.z, p.d.z, u) + Math.cos(p.i * 3 + u * 5) * .2); p.m.rotation.set(u * 9, u * 7 + p.i, 0); p.m.material.opacity = u < 1 ? 1 : Math.max(0, 1 - (k * 1.4 - 1) * 3); }
    if (e.kind === "dash") { const u = Math.min(1, k * 3); e.m.scale.set(1 - k, 1 - k, Math.max(.01, e.L * u)); e.m.position.z = e.L * u / 2; e.m2.scale.set(1, 1, Math.max(.01, e.L * u)); e.m2.position.z = e.L * u / 2; e.m.material.opacity = 1 - k; e.m2.material.opacity = 1 - k; }
    if (e.kind === "beam") { const w = (1 - k) * (k < .12 ? k / .12 : 1); e.m.scale.set(.12 * w + .02, .12 * w + .02, 1); e.m2.scale.set(.04 * w, .04 * w, 1); e.m.material.opacity = .6 * w; }
    if (e.kind === "wall") { const r = .4 + easeOut(Math.min(1, k * 1.4)) * 2.6; e.m.scale.set(r, 1 - k * .5, r); e.m2.scale.set(r, 1, r); e.m.material.opacity = .7 * (1 - k); e.m2.material.opacity = 1 - k; }
    if (e.kind === "bomb") { if (k < .47) { const u = k / .47; e.card.position.set(0, lerp(9, .8, u * u), 0); e.card.rotation.set(0, u * 14, 0); e.cg.position.copy(e.card.position); }
      else { e.card.visible = false; e.cg.visible = false; const u = (k - .47) / .53; e.sph.visible = true; e.ring.visible = true; e.sph.scale.setScalar(.3 + u * 2); e.sph.material.opacity = .8 * (1 - u); e.ring.scale.setScalar(.3 + u * 2.6); e.ring.material.opacity = 1 - u; } }
    if (e.kind === "hit") { e.gs.scale.setScalar(2.5 * (1 - k) + .2); e.gs.material.opacity = 1 - k; for (const s of e.sp) { s.m.position.copy(s.dir).multiplyScalar(easeOut(k) * 1.3); s.m.material.opacity = 1 - k; } }
  }
  function fxFree(e) { if (e.obj) { freeObj(e.obj, e.res); e.obj = null; } }
  function freeAllFx() { for (const e of S.fxLive) fxFree(e); for (const e of TB.fx) fxFree(e); S.fxLive = []; }

  /* ---------- per-frame scene update ---------- */
  const tmpC = { pat: null };
  function sceneUpdate(dt) {
    S.clock2 = (S.clock2 || 0) + dt; const ct = S.clock2;
    if (S.arena && S.arena.upd) S.arena.upd(dt, ct);
    // tiles
    const pat = new Set(TB.pat || []), reach = new Set(TB.reach || []), path = new Set(TB.path || []), dec = new Map();
    for (const dc of TB.decals) for (const k of dc.tiles) dec.set(k, dc);
    if (tmpC.pat !== TB.patCol) { tmpC.pat = TB.patCol; tmpC.col = new T.Color(TB.patCol); }
    const pc = tmpC.col, pul = .45 + .3 * Math.sin(ct * 14); let pi = 0;
    for (const k in S.tiles) { const Tl = S.tiles[k]; Tl.g.position.y = -.11 + Math.sin(ct * 1.3 + Tl.ph) * .04; const ov = Tl.ov, om = ov.material; let op = 0;
      if (pat.has(k)) { om.color.copy(pc); op = pul * .7; if (pi < S.pill.length) { const pl = S.pill[pi++]; pl.visible = true; pl.position.set(Tl.g.position.x, 1.2 + Tl.g.position.y, Tl.g.position.z); pl.material.color.copy(pc); pl.material.opacity = .05 * Math.min(1, TB.patT * 3); pl.scale.y = Math.max(.01, Math.min(1, TB.patT * 3)); } }
      else if (path.has(k)) { om.color.set(0x35f4ff); op = .5; } else if (reach.has(k)) { om.color.set(0x35f4ff); op = .18; }
      else if (dec.has(k)) { const dc = dec.get(k); om.color.set(dc.col); op = .3 * Math.min(1, dc.life / dc.max * 2); }
      om.opacity = op; ov.visible = op > .001; }
    for (; pi < S.pill.length; pi++) S.pill[pi].visible = false;
    // fighters
    R.fighters.forEach((f, i) => {
      const g = S.models[i]; if (!g) return; const P = g.userData, p = f.p3, Q = fpos(f), w = w3(Q), tb = S.tiles[p.cell];
      g.position.set(w.x, (tb ? tb.g.position.y + .11 : 0) + Q.z * 1.3, w.z);
      const ow = w3(fpos(foe(f))); let yaw = Math.atan2(ow.x - w.x, ow.z - w.z);
      if (p.anim) { const A = w3(TB.board.pos(p.anim.from)), Bb = w3(TB.board.pos(p.anim.to)); if (A.distanceTo(Bb) > .01) yaw = Math.atan2(Bb.x - A.x, Bb.z - A.z); }
      g.rotation.y += (((yaw - g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 10);
      const sq = clamp(p.sq, -.3, .4); P.body.scale.set(1 + sq * .25, 1 - sq * .3, 1 + sq * .25); P.shadow.position.y = -Q.z * 1.3 / (P.scale || 1.55) + .01; P.shadow.scale.setScalar(1 - Q.z * .3);
      P.head.rotation.z = Math.sin(p.t * 2) * .05; P.tail.rotation.z = Math.sin(p.t * 2.3) * .4;
      let arm = 0; if (p.pose === "swing") arm = -Math.sin(Math.min(1, p.poseT / p.poseD) * Math.PI) * 2.4; else if (p.pose === "cast") arm = -1.7; else if (p.pose === "dash") arm = -1.2;
      P.arm.rotation.x += (arm - P.arm.rotation.x) * Math.min(1, dt * 18);
      if (P.katana) { const dsh = p.pose === "dash" || p.pose === "swing"; P.katana.rotation.z += ((dsh ? -1.6 : .8) - P.katana.rotation.z) * Math.min(1, dt * 12); P.katana.position.set(dsh ? .3 : 0, dsh ? .7 : .6, dsh ? .2 : -.3); P.blade.material.color.copy(dsh ? WHITE : P.bladeCol); }
      if (P.hud) P.hud.material.opacity = .6 + .4 * Math.sin(p.t * 9) * Math.sin(p.t * 3.3) + (p.pose === "cast" ? .4 : 0);
      if (P.halo) P.halo.rotation.z += dt * 1.5;
      if (P.anim) P.anim(dt, ct, f);
      const deadF = R.loser === f && R.overT > .2; g.rotation.z = deadF ? Math.min(1.4, (R.overT - .2) * 4) * (i ? 1 : -1) : 0;
    });
    // fx lifecycle
    for (const e of TB.fx) { if (!e.obj) fxMake(e); fxStep(e); }
    for (const e of S.fxLive) if (!TB.fx.includes(e)) fxFree(e);
    S.fxLive = TB.fx.slice();
    // camera: slow auto-orbit unless the user dragged recently
    const cam = S.cam; if (ct - cam.last > 3 && !cam.drag && !cam.hold) cam.th += dt * .08;
    const asp = S.W / S.H, rad = cam.rad || clamp(camBase() * (cam.zoom || 1), CAM_MIN, CAM_MAX), tg = cam.target;
    // zoomed out past the default view: the near plane moves up to CAM_CUT[arena] short of the stage centre, so scenery between the camera and the
    // board (canopy crystals, shrine torii/trees, data-core racks, megacity towers) is cut away and the whole board + both fighters stay visible
    { const nk = cam.rad ? 0 : clamp((rad - camBase()) / 4, 0, 1), nn = .1 + (Math.max(.1, rad - CAM_CUT[arenaI]) - .1) * nk; if (Math.abs(S.camera.near - nn) > 1e-3) { S.camera.near = nn; S.camera.updateProjectionMatrix(); } }
    let sh = S.shake > 0 ? (S.shake -= dt, S.shake * .3) : TB.shake * .12; if (reduce) sh = 0;
    if (tg) { S.camera.position.set(tg.x + Math.sin(cam.th) * Math.cos(cam.ph) * rad, tg.y + Math.sin(cam.ph) * rad, tg.z + Math.cos(cam.th) * Math.cos(cam.ph) * rad); S.camera.lookAt(tg.x, tg.y, tg.z); }
    else { S.camera.position.set(Math.sin(cam.th) * Math.cos(cam.ph) * rad + rr(-sh, sh), Math.sin(cam.ph) * rad + 1 + rr(-sh, sh), Math.cos(cam.th) * Math.cos(cam.ph) * rad); S.camera.lookAt(0, asp < 1.25 ? 1.05 : .95, 0); }
  }
  let WHITE = null;

  /* ---------- loop ---------- */
  let raf = 0, last = 0, skip = 0, visible = true, fpsA = { t0: 0, n: 0, fps: 0 };
  const busy = () => R.phase === "intro" || R.phase === "battle" || R.phase === "ko";
  function frame(now) {
    raf = 0; if (dead || !ready) return;
    if (!busy() && (skip++ & 1)) { schedule(); return; }          // idle / result screen: ~30 fps
    let dt = last ? Math.min(.1, (now - last) / 1000) : 1 / 60; last = now; dt = Math.min(dt, busy() ? .05 : .1);
    if (busy()) dt *= speedMul;
    if (R.hitstop > 0) { R.hitstop -= dt; dt *= .08; }
    DT = dt;
    try { tbUpdate(dt); flow(dt); sceneUpdate(dt); S.renderer.render(S.scene, S.camera); hudFrame(); } catch (err) { console.error(err); }
    // adaptive pixel ratio while fighting: hold ~40 fps or step down (min .75)
    if (!fpsA.t0) fpsA.t0 = now; fpsA.n++;
    if (now - fpsA.t0 > 2000) { fpsA.fps = fpsA.n * 1000 / (now - fpsA.t0); if (busy() && fpsA.fps < 38 && S.pr > .76 && opts.adaptive !== false) { S.pr = Math.max(.75, S.pr * .8); S.renderer.setPixelRatio(S.pr); S.renderer.setSize(S.W, S.H, false); } fpsA.t0 = now; fpsA.n = 0; }
    schedule();
  }
  function schedule() { if (!raf && !dead && ready && visible && !doc.hidden) raf = win.requestAnimationFrame(frame); }
  function kick() { last = 0; schedule(); }
  function stopLoop() { if (raf) win.cancelAnimationFrame(raf); raf = 0; }
  function resize() {
    if (dead) return; const w = Math.round(stage.clientWidth || container.clientWidth || 360);
    const h = Math.round(opts.height ? +opts.height : clamp(w < 560 ? w * .95 : w * .56, 300, 480));
    el.classList.toggle("npfo--narrow", w < 560);
    if (w === S.W && h === S.H) return; S.W = w; S.H = h; stage.style.height = h + "px";
    if (S.renderer) { S.renderer.setSize(w, h, false); S.camera.aspect = w / h; S.camera.updateProjectionMatrix(); if (ready) { sceneUpdate(0); S.renderer.render(S.scene, S.camera); } }
    kick();
  }

  /* ---------- input ---------- */
  // camera zoom: absolute distance limits from the orbit centre, same for all four arenas.
  // min 6: close-up that never enters a fighter (even on a corner tile); max 20: board, pedestal and both fighters fit the stage on a 390x844 portrait phone.
  const CAM_MIN = 6, CAM_MAX = 20, CAM_CUT = [9, 9, 6, 9];   // CAM_CUT per arena (canopy, megacity, shrine, datacore)
  const camBase = () => 10 * Math.max(1, Math.pow(1.55 / ((S.W || 1) / (S.H || 1)), .62));   // default distance for the stage aspect (unchanged)
  function setZoom(z) { const c = S.cam; if (!c) return false; const b = camBase(), z0 = c.zoom || 1; c.zoom = clamp(z, CAM_MIN / b, CAM_MAX / b); c.last = S.clock2 || 0; if (!busy()) kick(); return c.zoom !== z0; }
  // one pointer = orbit (tap = fight), two pointers = pinch zoom; 2->1 hands the orbit to the remaining finger (fresh anchor, never counts as a tap)
  const pts = new Map(); let pinch = null;
  const span = () => { const a = [...pts.values()]; return Math.max(1, Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)); };
  function onDown(e) { const c = S.cam; if (!c) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size >= 2) { c.drag = null; pinch = { d0: span(), z0: c.zoom || 1 }; c.last = S.clock2 || 0; return; }
    c.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), touch: e.pointerType === "touch", moved: 0 }; if (!c.drag.touch) { try { e.target.setPointerCapture(e.pointerId); } catch (_) {} } c.last = S.clock2 || 0; }
  function onMove(e) { const c = S.cam, p = pts.get(e.pointerId); if (p) { p.x = e.clientX; p.y = e.clientY; } if (!c) return;
    if (pinch && pts.size >= 2) { if (p) setZoom(pinch.z0 * pinch.d0 / span()); return; }
    const d = c.drag; if (!d || d.id !== e.pointerId) return; const dx = e.clientX - d.x, dy = e.clientY - d.y;
    c.th -= dx * .006; c.ph = clamp(c.ph + dy * .004, .12, 1.3); d.x = e.clientX; d.y = e.clientY; d.moved += Math.abs(dx) + Math.abs(dy); c.last = S.clock2 || 0; if (!busy()) kick(); }
  function endPointer(e) { const c = S.cam; if (!pts.delete(e.pointerId)) return false; if (!pinch) return false;
    if (pts.size < 2) pinch = null;
    if (c && pts.size === 1) { const [id, q] = [...pts][0]; c.drag = { id, x: q.x, y: q.y, sx: q.x, sy: q.y, t: 0, touch: e.pointerType === "touch", moved: 1e9 }; }
    else if (c && !pts.size) c.drag = null;
    return true; }
  function onUp(e) { if (endPointer(e)) return; const c = S.cam, d = c && c.drag; if (!d || d.id !== e.pointerId) return; c.drag = null;
    if (e.type === "pointerup" && d.moved < 10 && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 10 && performance.now() - d.t < 500 && (R.phase === "idle" || R.phase === "done")) fight(); }
  function onCancel(e) { if (endPointer(e)) return; const c = S.cam; if (c && c.drag && c.drag.id === e.pointerId) c.drag = null; }
  // mouse wheel / trackpad (ctrl+wheel = trackpad pinch); at a zoom limit the wheel scrolls the page as before
  function onWheel(e) { if (!S.cam) return; const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    if (setZoom((S.cam.zoom || 1) * Math.exp(clamp(dy, -240, 240) * (e.ctrlKey ? .01 : .0012))) || e.ctrlKey) e.preventDefault(); }
  // no double-tap page zoom on the 3D canvas (single taps still start a fight)
  let lastTouchEnd = 0;
  function onTouchEnd(e) { const n = Date.now(); if (n - lastTouchEnd < 320) e.preventDefault(); lastTouchEnd = n; }
  function onGo() { if (!goBtn.disabled) fight(); }
  let arenaTimer = 0;
  function setArena(v) {
    const i = arenaIndex(v); if (i < 0) return false;
    el.querySelectorAll(".npfo-ach").forEach(b => b.setAttribute("aria-pressed", +b.dataset.a === i ? "true" : "false"));
    if (i === arenaI && (!ready || (S.arena && S.arena.i === i))) return true;
    arenaI = i; if (loadEl.isConnected) loadEl.textContent = "LOADING " + ARENAS[i].title.toUpperCase() + "…";
    if (music && music.on) music.track(i);
    if (!ready || !S.scene) return true;
    flashEl.classList.add("is-on"); if (arenaTimer) win.clearTimeout(arenaTimer);
    arenaTimer = win.setTimeout(() => {            // let the flash paint, then swap the environment (fight state untouched)
      arenaTimer = 0; if (dead || !S.scene) return;
      try { buildArena(arenaI); } catch (err) { console.error(err); }
      S.renderer.domElement.setAttribute("aria-label", ARENAS[arenaI].title + " 3D arena");
      if (R.phase === "idle" || R.phase === "done") log("Arena: <b>" + ARENAS[arenaI].title + "</b> — tap the arena to fight.");
      sceneUpdate(0); win.requestAnimationFrame(() => flashEl.classList.remove("is-on")); kick();
    }, 40);
    return true;
  }
  function onArena(e) { const b = e.target.closest && e.target.closest(".npfo-ach"); if (b && el.contains(b)) setArena(+b.dataset.a); }
  function onPick(e) { const b = e.target.closest && e.target.closest(".npfo-chip"); if (!b || !el.contains(b)) return; setFighter(+b.closest(".npfo-pick").dataset.side, +b.dataset.i); }
  function onMu() {
    if (!music) { try { music = createMusic(); } catch (err) { console.warn("music unavailable", err); music = null; } if (!music) return; }
    music.set(!music.on, arenaI); muBtn.setAttribute("aria-pressed", music.on ? "true" : "false");
  }
  function onVis() { if (doc.hidden) { stopLoop(); if (music) music.pause(); } else { kick(); if (music && visible) music.resume(); } }
  goBtn.addEventListener("click", onGo); el.addEventListener("click", onPick); el.addEventListener("click", onArena); if (muBtn) muBtn.addEventListener("click", onMu);
  doc.addEventListener("visibilitychange", onVis);
  const ro = win.ResizeObserver ? new win.ResizeObserver(resize) : null; if (ro) ro.observe(container); else win.addEventListener("resize", resize);
  const io = win.IntersectionObserver ? new win.IntersectionObserver(en => { visible = en[en.length - 1].isIntersecting; if (visible) { kick(); if (music) music.resume(); } else { stopLoop(); if (music) music.pause(); } }) : null;
  if (io) io.observe(stage);
  hudStatic(0); hudStatic(1); log("Loading the " + ARENAS[arenaI].title + " arena…"); resize();

  /* ---------- async init ---------- */
  const handle = {};
  handle.ready = getThree(opts).then(mod => {
    if (dead) return handle; T = mod; WHITE = new T.Color(0xffffff);
    try { buildScene(); } catch (err) { console.warn("NEON PAW arena: WebGL unavailable —", String(err && err.message || err)); if (loadEl.isConnected) loadEl.textContent = "3D NOT AVAILABLE ON THIS DEVICE"; return handle; }
    const cv = S.renderer.domElement; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", ARENAS[arenaI].title + " 3D arena");
    cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointermove", onMove); cv.addEventListener("pointerup", onUp); cv.addEventListener("pointercancel", onCancel);
    cv.addEventListener("wheel", onWheel, { passive: false }); cv.addEventListener("touchend", onTouchEnd, { passive: false });
    S.W = 0; ready = true; resize(); toIdle(); if (pendingFight) { pendingFight = false; fight(); }
    return handle;
  }, err => { console.warn("NEON PAW arena: could not load Three.js —", String(err && err.message || err)); if (loadEl.isConnected) loadEl.textContent = "3D NOT AVAILABLE"; return handle; });

  handle.fight = fight;
  handle.setArena = setArena;
  handle.setFighters = (l, r) => { if (l != null) setFighter(0, l); if (r != null) setFighter(1, r); };
  handle.getState = () => ({
    ready, phase: ready ? R.phase : "loading", left: list[sel[0]].src, right: list[sel[1]].src,
    hp: R.fighters.map(f => Math.max(0, Math.ceil(f.hp))), maxHp: [list[sel[0]].maxHp, list[sel[1]].maxHp],
    active: TB.active, turn: TB.turn, turns: R.turns, winnerSide: R.winner ? R.winner.side : -1,
    attack: R.fighters.map(f => (f.atk ? { name: f.p.moves[f.atk.i].name, kind: f.p.moves[f.atk.i].kind, t: +f.atk.t.toFixed(2) } : null)).find(Boolean) || null,
    fx: TB.fx.map(e => e.kind), moves: [list[sel[0]].moves.map(m => m.name + " (" + m.kind + ")"), list[sel[1]].moves.map(m => m.name + " (" + m.kind + ")")],
    fps: +fpsA.fps.toFixed(1), pixelRatio: S.pr || 0, lowQuality: !!S.low, music: !!(music && music.on), arena: ARENAS[arenaI].key
  });
  handle._debug = () => { const r = S.renderer; const sg = new Set(); if (S.scene) S.scene.traverse(o => { if (o.geometry && !o.isSprite) sg.add(o.geometry.uuid); }); return r ? { sceneGeometries: sg.size, geometries: r.info.memory.geometries, textures: r.info.memory.textures, programs: r.info.programs.length, calls: r.info.render.calls, triangles: r.info.render.triangles } : null; };
  const modelCost = g => { let meshes = 0, tris = 0; if (g) g.traverse(o => { if ((o.isMesh || o.isLine || o.isPoints || o.isSprite) && o.visible) { meshes++; const gg = o.geometry; if (o.isMesh) tris += gg.index ? gg.index.count / 3 : gg.attributes.position.count / 3; if (o.isSprite) tris += 2; } }); return { draws: meshes, tris: Math.round(tris) }; };
  handle._debug2 = () => (S.models ? S.models.map(modelCost) : null);
  handle._cam = o => { if (!S.cam) return; Object.assign(S.cam, o || {}); if (o && o.focus != null && S.models[o.focus]) { const p = new T.Vector3(); S.models[o.focus].getWorldPosition(p); S.cam.target = { x: p.x, y: p.y + (o.dy != null ? o.dy : 1.3), z: p.z }; } kick(); };
  handle.destroy = () => {
    if (dead) return; dead = true; stopLoop();
    goBtn.removeEventListener("click", onGo); el.removeEventListener("click", onPick); el.removeEventListener("click", onArena); if (arenaTimer) win.clearTimeout(arenaTimer); if (muBtn) muBtn.removeEventListener("click", onMu);
    doc.removeEventListener("visibilitychange", onVis); if (ro) ro.disconnect(); else win.removeEventListener("resize", resize); if (io) io.disconnect();
    if (music) { const m = music; music = null; m.close().catch(() => {}); }
    if (S.renderer) {
      const r = S.renderer, cv = r.domElement;
      cv.removeEventListener("pointerdown", onDown); cv.removeEventListener("pointermove", onMove); cv.removeEventListener("pointerup", onUp); cv.removeEventListener("pointercancel", onCancel);
      cv.removeEventListener("wheel", onWheel, { passive: false }); cv.removeEventListener("touchend", onTouchEnd, { passive: false });
      freeAllFx(); for (let i = 0; i < 2; i++) if (S.models[i]) freeObj(S.models[i], S.modelRes[i]);
      if (S.arena) { freeObj(S.arena.G, S.arena.res); S.arena = null; }
      const geos = new Set(), mats = new Set(S.mats);
      S.scene.traverse(o => { if (o.geometry && !o.isSprite) geos.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => mats.add(m)); });
      geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); S.texs.forEach(t => t.dispose()); if (S.envRT) S.envRT.dispose(); if (S.geo) { S.geo.forEach(g => g.dispose()); S.geo.clear(); }
      S.scene.clear(); r.renderLists.dispose(); r.dispose(); r.forceContextLoss(); cv.remove();
    }
    for (const e of dmEls.values()) e.remove(); dmEls.clear();
    for (const k in S) delete S[k]; R.fighters = []; TB.fx = [];
    el.remove(); dropStyle(doc); dropZoomGuard(doc);
  };
  return handle;
}

const api = { mountForest, arenas: ARENAS.map(a => a.key), version: "1.1.0" };
if (typeof window !== "undefined" && !(window.NeonPawForest && window.NeonPawForest.__loader)) window.NeonPawForest = api;
export default api;
