import { getDefaultExportFromCjs } from './_commonjsHelpers.mjs';
import { __require as requireRemoveDuplicateKeys } from '../src/utils/removeDuplicateKeys.mjs';

var removeDuplicateKeysExports = requireRemoveDuplicateKeys();
var removeDuplicateKeys = /*@__PURE__*/getDefaultExportFromCjs(removeDuplicateKeysExports);

export { removeDuplicateKeys as default };
