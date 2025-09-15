'use strict';

var chunk4IBVXDKH_cjs = require('./chunk-4IBVXDKH.cjs');

var require_puppeteer_errors = chunk4IBVXDKH_cjs.__commonJS({
  "src/puppeteer-errors.cjs"(exports, module) {
    class ElementNotFoundError extends Error {
      constructor(message) {
        super(message);
        this.name = "ElementNotFoundError";
      }
    }
    class UnauthorizedError extends Error {
      constructor(message = "Unauthorized access - login required") {
        super(message);
        this.name = "UnauthorizedError";
      }
    }
    module.exports = {
      ElementNotFoundError,
      UnauthorizedError
    };
  }
});
var puppeteerErrors = require_puppeteer_errors();

module.exports = puppeteerErrors;
//# sourceMappingURL=puppeteer-errors.cjs.map
//# sourceMappingURL=puppeteer-errors.cjs.map