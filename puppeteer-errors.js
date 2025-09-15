import { __commonJS } from './chunk-BUSYA2B4.js';

var require_puppeteer_errors = __commonJS({
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

export { puppeteerErrors as default };
//# sourceMappingURL=puppeteer-errors.js.map
//# sourceMappingURL=puppeteer-errors.js.map