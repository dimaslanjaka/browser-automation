'use strict';

var skrin_js = require('./skrin.js');
var utils_js = require('../utils.js');

skrin_js.runEntrySkrining().catch((e) => {
  utils_js.multiBeep();
  console.error(e);
});
//# sourceMappingURL=skrin.direct.cjs.map
//# sourceMappingURL=skrin.direct.cjs.map