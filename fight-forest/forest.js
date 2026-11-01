/**
 * NEON PAW — 3D arena duel, classic-script loader (setArena included).
 *   <script src="fight-forest/forest.js"></script>
 *   var duel = NeonPawForest.mountForest(el, cats, opts);   // same API as forest.mjs; methods queue until the module has loaded
 *   duel.ready.then(function(){ ... });  duel.destroy();
 */
(function () {
  "use strict";
  var cur = document.currentScript, base = cur && cur.src ? cur.src : location.href, modP = null;
  function load() { return modP || (modP = import(new URL("forest.mjs", base).href)); }
  function mountForest(el, cats, opts) {
    var real = null, dead = false, queue = [];
    var h = {
      ready: load().then(function (m) { if (dead) return h; real = m.mountForest(el, cats, opts); queue.forEach(function (f) { f(); }); queue = []; return real.ready.then(function () { return h; }); }),
      fight: function () { real ? real.fight() : queue.push(function () { real.fight(); }); },
      setFighters: function (l, r) { real ? real.setFighters(l, r) : queue.push(function () { real.setFighters(l, r); }); },
      setArena: function (a) { if (real) return real.setArena(a); queue.push(function () { real.setArena(a); }); return true; },
      getState: function () { return real ? real.getState() : { ready: false, phase: "loading" }; },
      destroy: function () { dead = true; queue = []; if (real) real.destroy(); }
    };
    return h;
  }
  window.NeonPawForest = { mountForest: mountForest, load: load, __loader: true };
})();
