/* NEON PAW fight module — ES module entry. Loads fight.js (which also sets window.NeonPawFight) and re-exports the API. */
import "./fight.js?v=185"; // cache-busted with the site version
export const mountFight = globalThis.NeonPawFight.mountFight;
export default globalThis.NeonPawFight;
