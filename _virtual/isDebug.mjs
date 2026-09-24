import { getDefaultExportFromCjs } from './_commonjsHelpers.mjs';
import { __require as requireIsDebug } from '../src/utils/isDebug.mjs';

var isDebugExports = requireIsDebug();
var isDebug = /*@__PURE__*/getDefaultExportFromCjs(isDebugExports);

export { isDebug as default };
