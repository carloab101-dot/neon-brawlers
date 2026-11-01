/**
 * NEON PAW — 1v1 Fight module (self-contained, no dependencies).
 *
 * Classic script:  <script src="fight/fight.js"></script>  ->  window.NeonPawFight.mountFight(el, cats)
 * ES module:       import { mountFight } from "./fight/fight.mjs";
 *
 * mountFight(containerEl, characters, options?) -> { destroy, fight, setFighters, getState }
 * Character fields used: name (required), hue, speed, weight, aesthetics (0-100), location, id (optional).
 * Styles are injected once as <style id="npf-style"> and removed when the last instance is destroyed.
 */
(function (root) {
  "use strict";

  /* ---------------- styles (scoped under .npf) ---------------- */
  var CSS = [
    ".npf{--c:#7df9ff;--m:#ff2bd6;--bg:#070b12;--glass:rgba(13,20,32,.62);--line:rgba(125,249,255,.22);--txt:#e8f0ff;--mut:#8aa0c0;",
    "position:relative;width:100%;color:var(--txt);font-family:inherit;font-family:\"Segoe UI\",system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}",
    ".npf *,.npf *::before,.npf *::after{box-sizing:border-box}",
    ".npf-stage{position:relative;width:100%;border-radius:16px;overflow:hidden;background:var(--bg);border:1px solid var(--line);box-shadow:0 0 0 1px rgba(255,43,214,.08),0 10px 40px rgba(0,0,0,.45),0 0 28px rgba(125,249,255,.08)}",
    ".npf-cv{display:block;width:100%;height:100%;touch-action:manipulation}",
    ".npf-hud{position:absolute;left:0;right:0;top:0;display:flex;align-items:flex-start;gap:8px;padding:10px;pointer-events:none}",
    ".npf-card{flex:1;min-width:0;display:flex;gap:9px;align-items:center;padding:8px 10px;border-radius:12px;background:var(--glass);border:1px solid var(--line);",
    "backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:inset 0 0 18px rgba(125,249,255,.06)}",
    ".npf-card[data-side='0']{border-color:rgba(125,249,255,.45);box-shadow:0 0 14px rgba(125,249,255,.18),inset 0 0 18px rgba(125,249,255,.07)}",
    ".npf-card[data-side='1']{flex-direction:row-reverse;text-align:right;border-color:rgba(255,43,214,.45);box-shadow:0 0 14px rgba(255,43,214,.18),inset 0 0 18px rgba(255,43,214,.07)}",
    ".npf-face{flex:none;width:40px;height:40px;border-radius:9px;background:rgba(0,0,0,.35);display:grid;place-items:center}",
    ".npf-face svg{width:34px;height:34px}",
    ".npf-info{flex:1;min-width:0}",
    ".npf-name{font-weight:800;font-size:14px;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".npf-sub{font-size:10.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}",
    ".npf-sub b{color:var(--txt);font-weight:700}",
    ".npf-hp{position:relative;height:10px;margin-top:5px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden;border:1px solid rgba(255,255,255,.12)}",
    ".npf-hp i{position:absolute;top:0;bottom:0;left:0;width:100%;border-radius:6px}",
    ".npf-card[data-side='1'] .npf-hp i{left:auto;right:0}",
    ".npf-hp .npf-lag{background:rgba(255,255,255,.75)}",
    ".npf-hp .npf-fill{transition:background .3s}",
    ".npf-hp.is-low .npf-fill{background:linear-gradient(90deg,#ff4d6d,#ff2bd6)!important;animation:npfPulse .6s ease-in-out infinite alternate}",
    ".npf-num{display:block;font:700 10px/1 ui-monospace,Menlo,Consolas,monospace;color:var(--mut);margin-top:3px}",
    ".npf-ch{height:3px;margin-top:3px;border-radius:2px;background:rgba(255,255,255,.07);overflow:hidden}",
    ".npf-ch i{display:block;height:100%;width:0;background:var(--c)}",
    ".npf-card[data-side='1'] .npf-ch i{background:var(--m);margin-left:auto}",
    ".npf-vs{flex:none;align-self:center;font-weight:900;font-size:13px;letter-spacing:2px;color:#fff;text-shadow:0 0 8px var(--c),0 0 14px var(--m)}",
    ".npf-banner{position:absolute;left:50%;top:56%;transform:translate(-50%,-50%) scale(.6);opacity:0;pointer-events:none;text-align:center;white-space:nowrap;",
    "font-weight:900;letter-spacing:4px;font-size:clamp(28px,7vw,54px);color:#fff;text-shadow:0 0 10px var(--c),0 0 26px var(--m);transition:opacity .25s,transform .35s cubic-bezier(.2,1.6,.4,1)}",
    ".npf-banner.is-on{opacity:1;transform:translate(-50%,-50%) scale(1)}",
    ".npf-banner small{display:block;font-size:.34em;letter-spacing:3px;margin-top:6px;color:var(--txt)}",
    ".npf-bar{display:flex;align-items:center;gap:12px;margin:12px 0 10px}",
    ".npf-go{all:unset;box-sizing:border-box;flex:none;cursor:pointer;min-width:132px;min-height:46px;padding:0 22px;border-radius:999px;text-align:center;",
    "font-weight:900;letter-spacing:3px;font-size:15px;color:#070b12;background:linear-gradient(90deg,var(--c),var(--m));box-shadow:0 0 18px rgba(255,43,214,.35),0 0 18px rgba(125,249,255,.25);transition:transform .12s,filter .2s}",
    ".npf-go:hover{filter:brightness(1.1)}.npf-go:active{transform:scale(.96)}.npf-go:focus-visible{outline:2px solid #fff;outline-offset:3px}",
    ".npf-go[disabled]{opacity:.55;cursor:default;filter:saturate(.4)}",
    ".npf-log{flex:1;min-width:0;margin:0;font-size:13px;color:var(--mut);line-height:1.35;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}",
    ".npf-log b{color:var(--txt)}",
    ".npf-picks{display:grid;gap:8px}",
    ".npf-pick{display:flex;align-items:center;gap:8px;padding:8px;border-radius:14px;background:var(--glass);border:1px solid var(--line)}",
    ".npf-pick-lbl{flex:none;width:30px;text-align:center;font-weight:900;font-size:12px;letter-spacing:1px}",
    ".npf-pick[data-side='0'] .npf-pick-lbl{color:var(--c);text-shadow:0 0 8px var(--c)}",
    ".npf-pick[data-side='1'] .npf-pick-lbl{color:var(--m);text-shadow:0 0 8px var(--m)}",
    ".npf-chips{flex:1;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}",
    ".npf-chip{all:unset;box-sizing:border-box;cursor:pointer;min-height:48px;border-radius:10px;padding:5px 2px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;",
    "background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.1);transition:border-color .15s,background .15s,transform .1s}",
    ".npf-chip svg{width:26px;height:26px}",
    ".npf-chip span{font-size:10px;font-weight:700;color:var(--mut);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px}",
    ".npf-chip:hover{background:rgba(255,255,255,.06)}.npf-chip:active{transform:scale(.95)}.npf-chip:focus-visible{outline:2px solid #fff;outline-offset:1px}",
    ".npf-pick[data-side='0'] .npf-chip[aria-pressed='true']{border-color:var(--c);background:rgba(125,249,255,.12);box-shadow:0 0 12px rgba(125,249,255,.35)}",
    ".npf-pick[data-side='1'] .npf-chip[aria-pressed='true']{border-color:var(--m);background:rgba(255,43,214,.12);box-shadow:0 0 12px rgba(255,43,214,.35)}",
    ".npf-chip[aria-pressed='true'] span{color:var(--txt)}",
    ".npf--narrow .npf-hud{padding:7px;gap:5px}.npf--narrow .npf-card{padding:6px 7px;gap:6px}.npf--narrow .npf-face{width:30px;height:30px}.npf--narrow .npf-face svg{width:26px;height:26px}",
    ".npf--narrow .npf-name{font-size:12px}.npf--narrow .npf-sub{display:none}.npf--narrow .npf-vs{font-size:11px;letter-spacing:1px}",
    ".npf--narrow .npf-bar{gap:10px}.npf--narrow .npf-go{min-width:112px;padding:0 16px;font-size:14px}.npf--narrow .npf-log{font-size:12px}",
    ".npf--narrow .npf-chip span{font-size:9px}.npf--narrow .npf-pick{padding:6px;gap:5px}.npf--narrow .npf-pick-lbl{width:22px;font-size:11px}.npf--narrow .npf-chips{gap:4px}",
    "@keyframes npfPulse{from{opacity:.65}to{opacity:1}}",
    "@media (prefers-reduced-motion:reduce){.npf-banner{transition:opacity .2s}}"
  ].join("\n");
  var styleRefs = 0;
  function addStyle(doc) {
    styleRefs++;
    if (doc.getElementById("npf-style")) return;
    var s = doc.createElement("style"); s.id = "npf-style"; s.textContent = CSS; doc.head.appendChild(s);
  }
  function dropStyle(doc) {
    styleRefs = Math.max(0, styleRefs - 1);
    if (!styleRefs) { var s = doc.getElementById("npf-style"); if (s) s.remove(); }
  }

  /* ---------------- helpers ---------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function ease(k) { k = clamp(k, 0, 1); return k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function hsl(h, s, l, a) { return "hsla(" + (((h % 360) + 360) % 360).toFixed(0) + "," + s + "%," + l + "%," + (a == null ? 1 : a) + ")"; }

  var CLAW = ["Rake", "Swipe", "Flurry"], SLAM = ["Drop", "Pounce", "Crush"], BEAM = ["Beam", "Laser", "Ray"];

  /* Normalise one character record and derive its look + moves from its data. */
  function prep(c, i) {
    c = c || {};
    var stat = function (v) { v = +v; return isFinite(v) ? clamp(v, 1, 100) : 60; };
    var name = String(c.name || "Fighter " + (i + 1));
    var h = hash(name);
    var hue = isFinite(+c.hue) ? ((+c.hue % 360) + 360) % 360 : h % 360;
    var words = name.split(/\s+/).filter(Boolean), w1 = words[0] || name, w2 = words[1] || w1;
    var p = {
      src: c, idx: i, id: c.id != null ? String(c.id) : "c" + i, name: name, short: w1,
      location: c.location ? String(c.location) : "",
      speed: stat(c.speed), weight: stat(c.weight), aesthetics: stat(c.aesthetics), hue: hue
    };
    p.look = {
      ear: h % 3, pat: (h >>> 2) % 4, tail: (h >>> 4) % 3, visor: ((h >>> 6) & 1) === 1,
      acc: (hue + (((h >>> 7) & 1) ? 150 : 200)) % 360,
      bulk: .82 + p.weight / 100 * .42
    };
    p.maxHp = Math.round(100 + p.weight * .8);
    p.moves = [
      { kind: "claw", name: w1 + " " + CLAW[(h >>> 9) % 3], base: 13 + p.speed * .23, w: p.speed * p.speed, dur: 1.05 - p.speed * .003, impact: .45, dodge: 1 },
      { kind: "slam", name: w2 + " " + SLAM[(h >>> 11) % 3], base: 16 + p.weight * .29, w: p.weight * p.weight, dur: 1.3, impact: .6, dodge: .8 },
      { kind: "beam", name: w2 + " " + BEAM[(h >>> 13) % 3], base: 13 + p.aesthetics * .25, w: p.aesthetics * p.aesthetics, dur: 1.35, impact: .52, dodge: .5 }
    ];
    return p;
  }

  /* Blocky face icon in the site's collectable style, with per-character ears / eyes. */
  function faceSVG(p) {
    var L = p.look, c = hsl(p.hue, 90, 60), d = hsl(p.hue, 70, 26), a = hsl(L.acc, 100, 66);
    var ears = L.ear === 0 ? '<polygon points="18,28 28,8 34,28" fill="' + c + '"/><polygon points="62,28 52,8 46,28" fill="' + c + '"/>'
      : L.ear === 1 ? '<circle cx="24" cy="26" r="9" fill="' + c + '"/><circle cx="56" cy="26" r="9" fill="' + c + '"/>'
      : '<polygon points="16,30 22,2 34,28" fill="' + c + '"/><polygon points="64,30 58,2 46,28" fill="' + c + '"/>';
    var eyes = L.visor ? '<rect x="20" y="40" width="40" height="9" rx="3" fill="#0a0e17"/><rect x="22" y="42" width="36" height="3" fill="' + a + '"/>'
      : '<rect x="24" y="39" width="10" height="10" fill="#0a0e17"/><rect x="46" y="39" width="10" height="10" fill="#0a0e17"/><rect x="29" y="40" width="3" height="3" fill="' + a + '"/><rect x="51" y="40" width="3" height="3" fill="' + a + '"/>';
    return '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + ears +
      '<rect x="12" y="26" width="56" height="42" rx="7" fill="' + c + '" stroke="' + a + '" stroke-width="2"/>' + eyes +
      '<rect x="36" y="53" width="8" height="4" fill="' + d + '"/></svg>';
  }

  /* ---------------- canvas drawing ---------------- */
  function catPath(p, s) {
    var L = p.look, b = L.bulk, P = new Path2D();
    var bx0 = -.46 * s * b, bx1 = .3 * s * b, by0 = -.64 * s, by1 = -.2 * s, r = .12 * s;
    P.roundRect ? P.roundRect(bx0, by0, bx1 - bx0, by1 - by0, r) : P.rect(bx0, by0, bx1 - bx0, by1 - by0);
    var hx0 = .12 * s * b, hx1 = hx0 + .46 * s, hy0 = -1.0 * s, hy1 = -.52 * s;
    P.roundRect ? P.roundRect(hx0, hy0, hx1 - hx0, hy1 - hy0, .09 * s) : P.rect(hx0, hy0, hx1 - hx0, hy1 - hy0);
    var ex = [hx0 + .06 * s, hx1 - .06 * s], i;
    for (i = 0; i < 2; i++) {
      var cx = i ? ex[1] - .09 * s : ex[0] + .09 * s;
      if (L.ear === 1) { P.moveTo(cx + .1 * s, hy0 + .02 * s); P.arc(cx, hy0 + .02 * s, .1 * s, 0, Math.PI * 2); }
      else { var tall = L.ear === 2 ? .3 : .2; P.moveTo(cx - .1 * s, hy0 + .02 * s); P.lineTo(cx + (i ? .03 : -.03) * s, hy0 - tall * s); P.lineTo(cx + .1 * s, hy0 + .02 * s); P.closePath(); }
    }
    return { P: P, bx0: bx0, bx1: bx1, by0: by0, by1: by1, hx0: hx0, hx1: hx1, hy0: hy0, hy1: hy1 };
  }
  function drawCat(g, p, s, run, flash, t) {
    var L = p.look, main = hsl(p.hue, 90, 58), dark = hsl(p.hue, 70, 24), acc = hsl(L.acc, 100, 66), G = catPath(p, s), i;
    // legs
    g.fillStyle = dark;
    var legX = [G.bx0 + .08 * s, G.bx0 + .22 * s, G.bx1 - .2 * s, G.bx1 - .07 * s];
    for (i = 0; i < 4; i++) { var ph = Math.sin(run * 14 + i * 1.7) * (run ? .06 : 0) * s; g.fillRect(legX[i] - .045 * s + ph, G.by1 - .02 * s, .09 * s, .22 * s); }
    // tail
    g.lineCap = "round"; g.lineJoin = "round";
    var tx = G.bx0 + .04 * s, ty = G.by0 + .1 * s, wag = Math.sin(t * 3 + p.idx) * .08 * s;
    g.beginPath(); g.moveTo(tx, ty);
    if (L.tail === 0) g.quadraticCurveTo(tx - .42 * s, ty - .05 * s + wag, tx - .36 * s, ty - .48 * s + wag);
    else if (L.tail === 1) { g.quadraticCurveTo(tx - .38 * s, ty + wag, tx - .3 * s, ty - .3 * s); g.arc(tx - .2 * s, ty - .3 * s, .1 * s, Math.PI, Math.PI * 2.6); }
    else { g.lineTo(tx - .16 * s, ty - .14 * s + wag); g.lineTo(tx - .08 * s, ty - .24 * s); g.lineTo(tx - .3 * s, ty - .44 * s + wag); }
    g.strokeStyle = hsl(L.acc, 100, 66, .25); g.lineWidth = .16 * s; g.stroke();
    g.strokeStyle = main; g.lineWidth = .09 * s; g.stroke();
    // body + head silhouette
    g.fillStyle = main; g.fill(G.P);
    g.save(); g.clip(G.P);
    g.fillStyle = dark; g.strokeStyle = dark;
    if (L.pat === 0) { for (i = 0; i < 3; i++) g.fillRect(G.bx0 + (.16 + i * .18) * s, G.by0 - .05 * s, .06 * s, .3 * s); g.fillRect(G.hx0 + .16 * s, G.hy0, .05 * s, .14 * s); }
    else if (L.pat === 1) { for (i = 0; i < 4; i++) { g.beginPath(); g.arc(G.bx0 + (.14 + i * .15) * s, G.by0 + (.12 + (i % 2) * .16) * s, .05 * s, 0, 7); g.fill(); } }
    else if (L.pat === 2) { g.strokeStyle = acc; g.lineWidth = Math.max(1, .018 * s); g.beginPath(); g.moveTo(G.bx0, G.by0 + .3 * s); g.lineTo(G.bx0 + .2 * s, G.by0 + .3 * s); g.lineTo(G.bx0 + .28 * s, G.by0 + .18 * s); g.lineTo(G.bx1, G.by0 + .18 * s); g.moveTo(G.bx0 + .3 * s, G.by1); g.lineTo(G.bx0 + .4 * s, G.by0 + .3 * s); g.stroke(); }
    g.fillStyle = hsl(p.hue, 95, 80, .5); g.fillRect(G.bx0, G.by1 - .1 * s, G.bx1 - G.bx0, .1 * s); // belly glow
    g.restore();
    // eyes
    if (L.visor) { g.fillStyle = "#0a0e17"; g.fillRect(G.hx0 + .06 * s, G.hy0 + .17 * s, .38 * s, .1 * s); g.fillStyle = acc; g.fillRect(G.hx0 + .08 * s, G.hy0 + .19 * s, .34 * s, .035 * s); }
    else { g.fillStyle = "#0a0e17"; g.fillRect(G.hx0 + .1 * s, G.hy0 + .15 * s, .1 * s, .11 * s); g.fillRect(G.hx0 + .3 * s, G.hy0 + .15 * s, .1 * s, .11 * s); g.fillStyle = acc; g.fillRect(G.hx0 + .15 * s, G.hy0 + .16 * s, .035 * s, .035 * s); g.fillRect(G.hx0 + .35 * s, G.hy0 + .16 * s, .035 * s, .035 * s); }
    g.fillStyle = dark; g.fillRect(G.hx0 + .38 * s, G.hy0 + .33 * s, .06 * s, .04 * s);
    // neon outline (layered strokes instead of shadowBlur: cheap on phones)
    g.strokeStyle = hsl(L.acc, 100, 66, .18); g.lineWidth = Math.max(4, .09 * s); g.stroke(G.P);
    g.strokeStyle = acc; g.lineWidth = Math.max(1.2, .025 * s); g.stroke(G.P);
    if (flash > 0) { g.fillStyle = "rgba(255,255,255," + (flash * .85).toFixed(2) + ")"; g.fill(G.P); }
    return G;
  }

  function buildBg(W, H, dpr) {
    var cv = document.createElement("canvas"); cv.width = Math.max(1, W * dpr | 0); cv.height = Math.max(1, H * dpr | 0);
    var g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var hz = H * .6, i, R = rng(7);
    var sky = g.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, "#05070d"); sky.addColorStop(.7, "#0b0f22"); sky.addColorStop(1, "#1a0d2a");
    g.fillStyle = sky; g.fillRect(0, 0, W, hz);
    // skyline
    for (var layer = 0; layer < 2; layer++) {
      var x = -10;
      while (x < W + 10) {
        var bw = (18 + R() * 46) * (layer ? 1.2 : .8), bh = hz * (layer ? .22 + R() * .38 : .3 + R() * .45);
        g.fillStyle = layer ? "#0b1122" : "#080b17"; g.fillRect(x, hz - bh, bw, bh);
        if (layer) for (var wy = hz - bh + 6; wy < hz - 4; wy += 7) for (var wx = x + 4; wx < x + bw - 4; wx += 6) if (R() < .18) { g.fillStyle = R() < .5 ? "rgba(125,249,255,.35)" : "rgba(255,43,214,.3)"; g.fillRect(wx, wy, 2, 2); }
        x += bw + 2 + R() * 6;
      }
    }
    var glow = g.createLinearGradient(0, hz - 40, 0, hz + 4); glow.addColorStop(0, "rgba(255,43,214,0)"); glow.addColorStop(1, "rgba(255,43,214,.35)");
    g.fillStyle = glow; g.fillRect(0, hz - 40, W, 44);
    // glass floor
    var fl = g.createLinearGradient(0, hz, 0, H); fl.addColorStop(0, "#120a24"); fl.addColorStop(1, "#04060b");
    g.fillStyle = fl; g.fillRect(0, hz, W, H - hz);
    g.lineWidth = 1;
    for (i = -12; i <= 12; i++) { g.strokeStyle = i % 2 ? "rgba(125,249,255,.13)" : "rgba(255,43,214,.13)"; g.beginPath(); g.moveTo(W / 2 + i * W * .03, hz); g.lineTo(W / 2 + i * W * .2, H); g.stroke(); }
    for (i = 1; i < 9; i++) { var yy = hz + (H - hz) * Math.pow(i / 9, 1.8); g.strokeStyle = "rgba(125,249,255," + (.05 + i * .012).toFixed(3) + ")"; g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke(); }
    g.strokeStyle = "rgba(125,249,255,.6)"; g.beginPath(); g.moveTo(0, hz + .5); g.lineTo(W, hz + .5); g.stroke();
    return { cv: cv, hz: hz };
  }

  /* ---------------- main ---------------- */
  function mountFight(container, characters, options) {
    if (!container || !container.appendChild) throw new Error("mountFight: containerEl is required");
    var opts = options || {};
    var list = (Array.isArray(characters) ? characters : []).slice(0, 12).map(prep);
    if (!list.length) throw new Error("mountFight: characters array is empty");
    var doc = container.ownerDocument || document, win = doc.defaultView || window;
    addStyle(doc);
    var reduce = win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var el = doc.createElement("div"); el.className = "npf";
    var chips = function (side) { return list.map(function (p, i) { return '<button type="button" class="npf-chip" data-i="' + i + '" aria-pressed="false" title="' + esc(p.name) + '" aria-label="' + (side ? "Right" : "Left") + ' fighter: ' + esc(p.name) + '">' + faceSVG(p) + "<span>" + esc(p.short) + "</span></button>"; }).join(""); };
    var card = function (side) { return '<div class="npf-card" data-side="' + side + '"><div class="npf-face"></div><div class="npf-info"><div class="npf-name"></div><div class="npf-sub"></div>' +
      '<div class="npf-hp"><i class="npf-lag"></i><i class="npf-fill"></i></div><span class="npf-num"></span><div class="npf-ch"><i></i></div></div></div>'; };
    el.innerHTML = '<div class="npf-stage"><canvas class="npf-cv" role="img" aria-label="Fight arena"></canvas><div class="npf-hud">' + card(0) + '<div class="npf-vs">VS</div>' + card(1) + '</div><div class="npf-banner" aria-hidden="true"></div></div>' +
      '<div class="npf-bar"><button type="button" class="npf-go">FIGHT</button><p class="npf-log" aria-live="polite"></p></div>' +
      '<div class="npf-picks"><div class="npf-pick" data-side="0"><span class="npf-pick-lbl">P1</span><div class="npf-chips" role="group" aria-label="Choose left fighter">' + chips(0) + '</div></div>' +
      '<div class="npf-pick" data-side="1"><span class="npf-pick-lbl">P2</span><div class="npf-chips" role="group" aria-label="Choose right fighter">' + chips(1) + "</div></div></div>";
    container.appendChild(el);

    var q = function (s) { return el.querySelector(s); };
    var stage = q(".npf-stage"), cv = q(".npf-cv"), g = cv.getContext("2d"), banner = q(".npf-banner"), goBtn = q(".npf-go"), logEl = q(".npf-log");
    var cards = [0, 1].map(function (s) { var c = el.querySelector('.npf-card[data-side="' + s + '"]'); return { root: c, face: c.querySelector(".npf-face"), name: c.querySelector(".npf-name"), sub: c.querySelector(".npf-sub"), hp: c.querySelector(".npf-hp"), fill: c.querySelector(".npf-fill"), lag: c.querySelector(".npf-lag"), num: c.querySelector(".npf-num"), ch: c.querySelector(".npf-ch i"), cache: {} }; });

    var W = 0, H = 0, dpr = 1, bg = null, S = 60, groundY = 0;
    var speedMul = clamp(+opts.speed || 1, .25, 8);
    var st = { phase: "idle", t: 0, time: 0, atk: null, winner: -1, turns: 0, cool: 0, shake: 0, R: rng(1), bannerT: 0 };
    var F = [mkF(0, clamp(opts.left != null ? +opts.left : 0, 0, list.length - 1)), mkF(1, clamp(opts.right != null ? +opts.right : Math.min(1, list.length - 1), 0, list.length - 1))];
    var fx = { parts: [], rings: [], texts: [], slashes: [] };
    var raf = 0, last = 0, destroyed = false, visible = true, frameSkip = 0;

    function mkF(side, idx) { var p = list[idx]; return { side: side, dir: side ? -1 : 1, idx: idx, p: p, hp: p.maxHp, lagHp: p.maxHp, gauge: 0, flash: 0, knock: 0, ox: 0, oy: 0, sq: 1, run: 0, ko: 0, dodge: 0, win: 0, ghost: [] }; }
    function homeX(f) { return W * (f.side ? .74 : .26); }

    /* ---------- HUD ---------- */
    function setTxt(n, v) { if (n.textContent !== v) n.textContent = v; }
    function hudStatic(side) {
      var f = F[side], p = f.p, c = cards[side];
      c.face.innerHTML = faceSVG(p); setTxt(c.name, p.name);
      c.sub.innerHTML = (p.location ? esc(p.location) + " · " : "") + "SPD <b>" + p.speed + "</b> WGT <b>" + p.weight + "</b> AES <b>" + p.aesthetics + "</b>";
      c.fill.style.background = "linear-gradient(" + (side ? 270 : 90) + "deg," + hsl(p.hue, 95, 58) + "," + hsl(p.look.acc, 100, 66) + ")";
      c.cache = {};
      el.querySelectorAll('.npf-pick[data-side="' + side + '"] .npf-chip').forEach(function (b) { b.setAttribute("aria-pressed", +b.dataset.i === f.idx ? "true" : "false"); });
    }
    function hudFrame() {
      for (var s = 0; s < 2; s++) {
        var f = F[s], c = cards[s], k = clamp(f.hp / f.p.maxHp, 0, 1), kl = clamp(f.lagHp / f.p.maxHp, 0, 1), ch = st.phase === "battle" ? clamp(f.gauge, 0, 1) : 0;
        var w = (k * 100).toFixed(1) + "%", wl = (kl * 100).toFixed(1) + "%", wc = (ch * 100).toFixed(0) + "%", num = Math.max(0, Math.ceil(f.hp)) + " / " + f.p.maxHp + " HP";
        if (c.cache.w !== w) { c.fill.style.width = w; c.cache.w = w; c.hp.classList.toggle("is-low", k < .3 && k > 0); }
        if (c.cache.wl !== wl) { c.lag.style.width = wl; c.cache.wl = wl; }
        if (c.cache.wc !== wc) { c.ch.style.width = wc; c.cache.wc = wc; }
        if (c.cache.num !== num) { c.num.textContent = num; c.cache.num = num; }
      }
    }
    function log(html) { if (logEl.innerHTML !== html) logEl.innerHTML = html; }
    function showBanner(main, sub, col) {
      banner.innerHTML = esc(main) + (sub ? "<small>" + esc(sub) + "</small>" : "");
      banner.style.textShadow = col ? "0 0 10px " + col + ",0 0 26px " + col : "";
      banner.classList.remove("is-on"); void banner.offsetWidth; banner.classList.add("is-on");
    }
    function hideBanner() { banner.classList.remove("is-on"); }

    /* ---------- flow ---------- */
    function resetFighters() { F.forEach(function (f) { f.hp = f.lagHp = f.p.maxHp; f.gauge = 0; f.flash = f.knock = f.ox = f.oy = f.ko = f.dodge = f.win = 0; f.sq = 1; f.run = 0; f.ghost.length = 0; }); fx.parts.length = fx.rings.length = fx.texts.length = fx.slashes.length = 0; st.atk = null; st.winner = -1; st.turns = 0; st.shake = 0; }
    function setIdle(msg) {
      st.phase = "idle"; resetFighters(); hideBanner(); goBtn.textContent = "FIGHT"; goBtn.disabled = false;
      log(msg || "Pick a fighter for each side, then hit <b>FIGHT</b>.");
    }
    function fight() {
      if (destroyed) return;
      resetFighters();
      st.match = (st.match || 0) + 1;
      st.R = rng(opts.seed != null ? (+opts.seed + st.match * 7919) >>> 0 : (Math.random() * 4294967296) >>> 0);
      st.phase = "intro"; st.t = 0; goBtn.textContent = "REMATCH"; goBtn.disabled = true;
      showBanner("READY", F[0].p.name + "  vs  " + F[1].p.name);
      log("<b>" + esc(F[0].p.name) + "</b> vs <b>" + esc(F[1].p.name) + "</b> — stats decide the moves.");
      kick();
    }
    function setFighter(side, idx) {
      idx = clamp(idx | 0, 0, list.length - 1); if (F[side].idx === idx) return;
      F[side] = mkF(side, idx); hudStatic(side);
      if (st.phase !== "idle") { F[1 - side].hp = F[1 - side].lagHp = F[1 - side].p.maxHp; setIdle("Fighter switched — hit <b>FIGHT</b> to start a new match."); }
      else resetFighters();
      kick();
    }
    function startAttack(a) {
      var A = F[a], D = F[1 - a], R = st.R, tot = 0, i, m;
      for (i = 0; i < 3; i++) tot += A.p.moves[i].w;
      var r = R() * tot; for (i = 0; i < 3; i++) { m = A.p.moves[i]; if ((r -= m.w) <= 0) break; }
      var dodgeP = (.04 + Math.max(0, D.p.speed - A.p.speed) * .004) * m.dodge;
      var crit = R() < .04 + A.p.aesthetics * .0012;
      var dmg = Math.round(m.base * (.85 + R() * .3) * (1 - D.p.weight * .0022) * (crit ? 1.5 : 1));
      var hit = R() >= dodgeP;
      st.atk = { a: a, d: 1 - a, m: m, hit: hit, crit: crit, dmg: hit ? dmg : 0, t: 0, done: false };
      st.turns++;
    }
    function impact() {
      var k = st.atk, A = F[k.a], D = F[k.d], acc = hsl(A.p.look.acc, 100, 66), col = hsl(A.p.hue, 95, 62);
      var x = homeX(D) + D.ox, y = groundY - S * .55;
      if (!k.hit) {
        D.dodge = 1; addText(x, y - S * .6, "DODGE", "#e8f0ff", 1);
        log("<b>" + esc(D.p.name) + "</b> dodged <b>" + esc(A.p.name) + "</b>'s " + esc(k.m.name) + ".");
        return;
      }
      D.hp = Math.max(0, D.hp - k.dmg); D.flash = 1; D.knock = A.dir * S * (k.m.kind === "slam" ? .5 : .3);
      st.shake = reduce ? 0 : (k.crit || k.m.kind === "slam" ? 1 : .55);
      burst(x, y, 14 + (k.crit ? 12 : 0), [acc, col, "#ffffff"], S * .05);
      if (k.m.kind === "slam") fx.rings.push({ x: x, y: groundY, r: S * .2, life: .55, max: .55, col: acc });
      if (k.m.kind === "claw") for (var i = 0; i < 3; i++) fx.slashes.push({ x: x, y: y - S * .1 + (i - 1) * S * .16, dir: A.dir, life: .28 + i * .04, max: .28 + i * .04, col: i === 1 ? "#fff" : acc });
      addText(x, y - S * .55, (k.crit ? "CRIT " : "") + "-" + k.dmg, k.crit ? "#ffc14a" : "#ffffff", k.crit ? 1.35 : 1);
      log("<b>" + esc(A.p.name) + "</b> used <b>" + esc(k.m.name) + "</b> — " + k.dmg + " dmg" + (k.crit ? " · <b>style crit!</b>" : "") + ".");
    }
    function burst(x, y, n, cols, sp) {
      for (var i = 0; i < n && fx.parts.length < 220; i++) { var a = Math.random() * 6.283, v = (.4 + Math.random()) * sp * 9;
        fx.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 3, life: .5 + Math.random() * .4, max: .9, col: cols[i % cols.length], sz: 1.5 + Math.random() * 2.5 }); }
    }
    function addText(x, y, txt, col, sc) { fx.texts.push({ x: x, y: y, txt: txt, col: col, life: 1, max: 1, sc: sc || 1 }); }

    function step(dt) {
      st.time += dt; st.t += dt;
      var i, f;
      for (i = 0; i < 2; i++) {
        f = F[i];
        f.flash = Math.max(0, f.flash - dt * 4); f.knock *= Math.pow(.004, dt); f.dodge = Math.max(0, f.dodge - dt * 2.2);
        if (f.lagHp > f.hp) f.lagHp = Math.max(f.hp, f.lagHp - f.p.maxHp * dt * .45);
      }
      st.shake = Math.max(0, st.shake - dt * 3);
      if (st.phase === "intro") {
        if (st.t > .9 && st.bannerT !== 1) { st.bannerT = 1; showBanner("FIGHT!", "", "#ff2bd6"); }
        if (st.t > 1.5) { hideBanner(); st.bannerT = 0; st.phase = "battle"; st.t = 0; st.cool = .2; }
      } else if (st.phase === "battle") {
        if (st.atk) {
          var k = st.atk; k.t += dt / k.m.dur;
          if (!k.done && k.t >= k.m.impact) { k.done = true; impact(); }
          if (k.t >= 1) {
            st.atk = null; st.cool = .25;
            if (F[k.d].hp <= 0) { st.phase = "ko"; st.t = 0; st.winner = k.a; F[k.d].ko = .001; showBanner("K.O.", "", "#ff4d6d"); burst(homeX(F[k.d]), groundY - S * .5, 40, ["#ff2bd6", "#7df9ff", "#fff"], S * .07); }
          }
        } else if ((st.cool -= dt) <= 0) {
          for (i = 0; i < 2; i++) F[i].gauge += dt * (.9 + F[i].p.speed / 60);
          var ready = [0, 1].filter(function (s) { return F[s].gauge >= 1; });
          if (ready.length) {
            var a = ready.length === 2 ? (F[0].gauge !== F[1].gauge ? (F[0].gauge > F[1].gauge ? 0 : 1) : (st.R() < .5 ? 0 : 1)) : ready[0];
            F[a].gauge = 0; startAttack(a);
          }
        }
      } else if (st.phase === "ko") {
        var L = F[st.winner ^ 1]; L.ko = Math.min(1, L.ko + dt * 1.6); F[st.winner].win += dt;
        if (st.t > 1.1 && st.phase === "ko") {
          st.phase = "done"; var w = F[st.winner].p;
          showBanner(w.name.toUpperCase(), "WINS · " + st.turns + " moves", hsl(w.hue, 100, 62));
          goBtn.disabled = false; goBtn.textContent = "REMATCH";
          log("<b>" + esc(w.name) + "</b> wins with " + Math.ceil(F[st.winner].hp) + " HP left. Hit <b>REMATCH</b> or swap fighters.");
          if (typeof opts.onEnd === "function") { try { opts.onEnd({ winner: w.src, winnerSide: st.winner, turns: st.turns }); } catch (e) { console.error(e); } }
        }
      } else if (st.phase === "done") { F[st.winner].win += dt; }
      // poses
      for (i = 0; i < 2; i++) { f = F[i]; f.ox = 0; f.oy = 0; f.sq = 1; f.run = 0; }
      if (st.atk) pose(st.atk);
      for (i = 0; i < 2; i++) { f = F[i]; f.ox += f.knock; if (f.dodge > 0) { var u = Math.sin(f.dodge * Math.PI); f.ox -= f.dir * u * S * .55; f.oy -= u * S * .35; }
        if (st.phase === "done" && i === st.winner) f.oy -= Math.abs(Math.sin(f.win * 5)) * S * .18;
        if (f.p.speed > 78 && (st.atk && st.atk.a === i) && st.time % .05 < dt) { f.ghost.push({ x: homeX(f) + f.ox, y: groundY + f.oy, life: .25 }); if (f.ghost.length > 6) f.ghost.shift(); }
        for (var gi = f.ghost.length - 1; gi >= 0; gi--) if ((f.ghost[gi].life -= dt) <= 0) f.ghost.splice(gi, 1); }
      // fx
      for (i = fx.parts.length - 1; i >= 0; i--) { var P = fx.parts[i]; P.life -= dt; if (P.life <= 0) { fx.parts.splice(i, 1); continue; } P.x += P.vx * dt; P.y += P.vy * dt; P.vy += S * 6 * dt; P.vx *= .97; }
      for (i = fx.rings.length - 1; i >= 0; i--) if ((fx.rings[i].life -= dt) <= 0) fx.rings.splice(i, 1);
      for (i = fx.texts.length - 1; i >= 0; i--) { fx.texts[i].life -= dt * .9; fx.texts[i].y -= dt * S * .5; if (fx.texts[i].life <= 0) fx.texts.splice(i, 1); }
      for (i = fx.slashes.length - 1; i >= 0; i--) if ((fx.slashes[i].life -= dt) <= 0) fx.slashes.splice(i, 1);
    }
    function pose(k) {
      var A = F[k.a], D = F[k.d], p = k.t, gap = S * .95, dx = (homeX(D) - homeX(A)) - A.dir * gap, u;
      if (k.m.kind === "claw") {
        if (p < .35) { u = ease(p / .35); A.ox = dx * u; A.run = 1; }
        else if (p < .6) { A.ox = dx + A.dir * Math.sin((p - .35) / .25 * Math.PI) * S * .12; A.sq = 1.06; }
        else { u = ease((p - .6) / .4); A.ox = dx * (1 - u); A.run = 1; }
      } else if (k.m.kind === "slam") {
        var tx = dx + A.dir * S * .35;
        if (p < .2) A.sq = 1 + .25 * Math.sin(p / .2 * Math.PI / 2);
        else if (p < .6) { u = (p - .2) / .4; A.ox = tx * ease(u); A.oy = -Math.sin(u * Math.PI) * S * 1.3; A.sq = .88; }
        else { u = (p - .6) / .4; A.ox = tx * (1 - ease(u)); A.oy = -Math.sin(u * Math.PI) * S * .35; A.sq = u < .15 ? 1.25 : 1; }
      } else {
        if (p < .45) A.sq = 1 + Math.sin(p * 40) * .02;
        else if (p < .8) A.ox = -A.dir * S * .08 * Math.sin((p - .45) / .35 * Math.PI);
      }
    }

    /* ---------- render ---------- */
    function render() {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (bg) g.drawImage(bg.cv, 0, 0, W, H); else { g.fillStyle = "#070b12"; g.fillRect(0, 0, W, H); }
      var t = st.time, i;
      // moving scan line on the glass floor
      var sy = bg ? bg.hz + ((t * .25) % 1) * (H - bg.hz) : 0; g.fillStyle = "rgba(125,249,255,.07)"; g.fillRect(0, sy, W, 2);
      if (st.shake > 0) g.translate((Math.random() - .5) * st.shake * S * .12, (Math.random() - .5) * st.shake * S * .08);
      // lane glows under fighters
      for (i = 0; i < 2; i++) { var f = F[i], x = homeX(f) + f.ox; g.fillStyle = i ? "rgba(255,43,214,.22)" : "rgba(125,249,255,.22)";
        var sc = 1 - clamp(-f.oy / (S * 1.5), 0, .7); g.beginPath(); g.ellipse(x, groundY + 2, S * .55 * sc, S * .1 * sc, 0, 0, 7); g.fill(); }
      // beam (behind fighters' fronts but visible)
      var k = st.atk;
      if (k && k.m.kind === "beam") drawBeam(k, t);
      for (i = 0; i < 2; i++) drawFighter(F[i], t);
      // rings
      for (i = 0; i < fx.rings.length; i++) { var R = fx.rings[i], u = 1 - R.life / R.max; g.strokeStyle = R.col; g.globalAlpha = 1 - u; g.lineWidth = 3;
        g.beginPath(); g.ellipse(R.x, R.y, R.r + u * S * 1.4, (R.r + u * S * 1.4) * .22, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
      // slashes
      for (i = 0; i < fx.slashes.length; i++) { var s = fx.slashes[i], v = s.life / s.max; g.strokeStyle = s.col; g.globalAlpha = v; g.lineWidth = 2 + 4 * v; g.lineCap = "round";
        g.beginPath(); g.arc(s.x - s.dir * S * .2, s.y, S * .42, -.9 - (1 - v) * .5, .5 - (1 - v) * .5); g.stroke(); g.globalAlpha = 1; }
      // particles
      for (i = 0; i < fx.parts.length; i++) { var P = fx.parts[i]; g.globalAlpha = clamp(P.life / .5, 0, 1); g.fillStyle = P.col; g.fillRect(P.x - P.sz / 2, P.y - P.sz / 2, P.sz, P.sz); }
      g.globalAlpha = 1;
      // floating texts
      g.textAlign = "center"; g.textBaseline = "middle";
      for (i = 0; i < fx.texts.length; i++) { var T = fx.texts[i], fs = Math.round(clamp(S * .3, 14, 30) * T.sc); g.font = "900 " + fs + "px system-ui,Segoe UI,sans-serif";
        g.globalAlpha = clamp(T.life * 2, 0, 1); g.lineWidth = 4; g.strokeStyle = "rgba(7,11,18,.85)"; g.strokeText(T.txt, T.x, T.y); g.fillStyle = T.col; g.fillText(T.txt, T.x, T.y); }
      g.globalAlpha = 1;
      if (st.phase === "idle") { g.font = "700 " + Math.round(clamp(W * .024, 11, 15)) + "px system-ui,Segoe UI,sans-serif"; g.fillStyle = "rgba(232,240,255," + (.55 + Math.sin(t * 3) * .25).toFixed(2) + ")"; g.fillText("PICK FIGHTERS  ·  PRESS FIGHT", W / 2, groundY + (H - groundY) * .55); }
    }
    function drawFighter(f, t) {
      var x = homeX(f) + f.ox, y = groundY + f.oy, bob = f.ko ? 0 : Math.sin(t * (2 + f.p.speed / 30) + f.side * 2) * S * .025;
      for (var gi = 0; gi < f.ghost.length; gi++) { var G = f.ghost[gi]; g.save(); g.globalAlpha = G.life * 1.2; g.translate(G.x, G.y); g.scale(f.dir, 1);
        g.fillStyle = hsl(f.p.look.acc, 100, 66, .5); g.fill(catPath(f.p, S).P); g.restore(); }
      g.save(); g.translate(x, y + bob);
      if (f.ko) { var kk = ease(f.ko); g.globalAlpha = f.ko < 1 ? (f.ko > .5 && Math.random() < .35 ? .3 : .9) : .6; g.translate(0, -kk * S * .5); g.rotate(-f.dir * kk * Math.PI / 2); }
      g.scale(f.dir / Math.sqrt(f.sq), f.sq);
      drawCat(g, f.p, S, f.run, f.flash, t);
      g.restore(); g.globalAlpha = 1;
    }
    function drawBeam(k, t) {
      var A = F[k.a], D = F[k.d], p = k.t, acc = hsl(A.p.look.acc, 100, 66), col = hsl(A.p.hue, 95, 62);
      var mx = homeX(A) + A.ox + A.dir * S * .62 * A.p.look.bulk, my = groundY - S * .78;
      if (p < .5) { // charge orb + converging sparks
        var c = p / .5, r = S * (.04 + .14 * c);
        g.fillStyle = hsl(A.p.look.acc, 100, 66, .25); g.beginPath(); g.arc(mx, my, r * 2, 0, 7); g.fill();
        g.fillStyle = "#fff"; g.beginPath(); g.arc(mx, my, r * .6, 0, 7); g.fill();
        for (var i = 0; i < 6; i++) { var a = t * 6 + i * 1.047, d = S * .6 * (1 - c); g.fillStyle = i % 2 ? acc : col; g.fillRect(mx + Math.cos(a) * d - 1.5, my + Math.sin(a) * d - 1.5, 3, 3); }
      } else if (p < .82) {
        var v = Math.sin((p - .5) / .32 * Math.PI), tx = D.dodge > 0 ? W * (A.dir > 0 ? 1.05 : -.05) : homeX(D) + D.ox, ty = D.dodge > 0 ? my : groundY - S * .55, j = (Math.random() - .5) * S * .03;
        var lines = [[S * .34, hsl(A.p.hue, 95, 62, .18)], [S * .18, hsl(A.p.look.acc, 100, 66, .45)], [S * .06, "#ffffff"]];
        g.lineCap = "round";
        for (var li = 0; li < 3; li++) { g.strokeStyle = lines[li][1]; g.lineWidth = Math.max(1, lines[li][0] * v); g.beginPath(); g.moveTo(mx, my); g.lineTo(tx, ty + j); g.stroke(); }
        if (!D.dodge && Math.random() < .6) burst(tx, ty, 2, [acc, "#fff"], S * .04);
      }
    }

    /* ---------- loop / sizing ---------- */
    function frame(now) {
      raf = 0; if (destroyed) return;
      var dt = last ? Math.min(.05, (now - last) / 1000) : .016; last = now;
      var busy = st.phase !== "idle" && st.phase !== "done";
      if (!busy && (frameSkip++ & 1)) { schedule(); return; } // idle: ~30 fps
      if (!busy) dt *= 2;
      step(dt * (busy ? speedMul : 1)); render(); hudFrame();
      schedule();
    }
    function schedule() { if (!raf && !destroyed && visible && !doc.hidden) raf = win.requestAnimationFrame(frame); }
    function kick() { last = 0; schedule(); }
    function resize() {
      if (destroyed) return;
      var w = Math.round(stage.clientWidth || container.clientWidth || 320);
      var h = Math.round(clamp(w < 560 ? w * .92 : w * .5, 280, 480));
      el.classList.toggle("npf--narrow", w < 560);
      if (w === W && h === H) return;
      W = w; H = h; stage.style.height = h + "px";
      dpr = Math.min(win.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      bg = buildBg(W, H, dpr);
      groundY = H * .86; S = Math.min(W * (W < 560 ? .215 : .19), H * .3);
      render(); hudFrame(); kick();
    }

    /* ---------- events ---------- */
    function onGo() { if (!goBtn.disabled) fight(); }
    function onPick(e) {
      var b = e.target.closest && e.target.closest(".npf-chip"); if (!b || !el.contains(b)) return;
      var side = +b.closest(".npf-pick").dataset.side; setFighter(side, +b.dataset.i);
    }
    function onVis() { if (!doc.hidden) kick(); }
    goBtn.addEventListener("click", onGo);
    el.addEventListener("click", onPick);
    doc.addEventListener("visibilitychange", onVis);
    var ro = win.ResizeObserver ? new win.ResizeObserver(resize) : null;
    if (ro) ro.observe(container); else win.addEventListener("resize", resize);
    var io = win.IntersectionObserver ? new win.IntersectionObserver(function (en) { visible = en[en.length - 1].isIntersecting; if (visible) kick(); }) : null;
    if (io) io.observe(stage);

    hudStatic(0); hudStatic(1); setIdle(); resize();
    if (opts.autoStart) fight();

    return {
      fight: fight,
      setFighters: function (left, right) { if (left != null) setFighter(0, left); if (right != null) setFighter(1, right); },
      getState: function () { return { phase: st.phase, left: F[0].p.src, right: F[1].p.src, hp: [Math.max(0, Math.ceil(F[0].hp)), Math.max(0, Math.ceil(F[1].hp))], maxHp: [F[0].p.maxHp, F[1].p.maxHp], winnerSide: st.winner, turns: st.turns, attack: st.atk ? { side: st.atk.a, kind: st.atk.m.kind, name: st.atk.m.name, progress: +st.atk.t.toFixed(3) } : null, moves: [F[0].p.moves.map(function (m) { return m.name; }), F[1].p.moves.map(function (m) { return m.name; })] }; },
      destroy: function () {
        if (destroyed) return; destroyed = true;
        if (raf) win.cancelAnimationFrame(raf); raf = 0;
        goBtn.removeEventListener("click", onGo); el.removeEventListener("click", onPick); doc.removeEventListener("visibilitychange", onVis);
        if (ro) ro.disconnect(); else win.removeEventListener("resize", resize);
        if (io) io.disconnect();
        fx.parts.length = fx.rings.length = fx.texts.length = fx.slashes.length = 0;
        cv.width = cv.height = 0; bg = null;
        el.remove(); dropStyle(doc);
      }
    };
  }

  var api = { mountFight: mountFight, version: "1.0.0" };
  root.NeonPawFight = api;
})(typeof window !== "undefined" ? window : globalThis);
