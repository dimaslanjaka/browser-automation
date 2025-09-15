'use strict';

require('./chunk-4IBVXDKH.cjs');

function getViteUrl(...segments) {
  let base = "/";
  if (typeof window !== "undefined" && undefined.BASE_URL) {
    base = undefined.BASE_URL;
  }
  const joined = segments.filter(Boolean).map((s) => s.replace(/^\/+|\/+$/g, "")).join("/");
  const baseClean = base.replace(/\/+$/, "");
  return baseClean + (joined ? "/" + joined : "");
}

exports.getViteUrl = getViteUrl;
//# sourceMappingURL=utils-browser-esm.cjs.map
//# sourceMappingURL=utils-browser-esm.cjs.map