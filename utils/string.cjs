'use strict';

require('../chunk-4IBVXDKH.cjs');

function ucwords(str) {
  return str.replace(/([A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿ]+)?)/g, (word) => {
    if (/^[A-ZÀ-ÖØ-Þ]+$/.test(word)) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

exports.ucwords = ucwords;
//# sourceMappingURL=string.cjs.map
//# sourceMappingURL=string.cjs.map