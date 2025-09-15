import './chunk-BUSYA2B4.js';

function getViteUrl(...segments) {
  let base = "/";
  if (typeof window !== "undefined" && import.meta.env.BASE_URL) {
    base = import.meta.env.BASE_URL;
  }
  const joined = segments.filter(Boolean).map((s) => s.replace(/^\/+|\/+$/g, "")).join("/");
  const baseClean = base.replace(/\/+$/, "");
  return baseClean + (joined ? "/" + joined : "");
}

export { getViteUrl };
//# sourceMappingURL=utils-browser-esm.js.map
//# sourceMappingURL=utils-browser-esm.js.map