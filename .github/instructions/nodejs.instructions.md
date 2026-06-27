---
applyTo: '**/*.{js,jsx,ts,tsx,mjs,cjs}'
---
# Node.js Configuration Loader Instructions

Coding standards, domain knowledge, and preferences that AI should follow.

- Using `yarn` as the package manager.
- Linter using `eslint` and formatter using `prettier`.
- Using `jest` for testing.
- When running shell commands that produce output files, direct these outputs to the `tmp` directory and review the complete results for thorough debugging, especially for long-running processes.
- Test files should be placed in the `test/` directory.
- `tsdoc` should not have type annotations in the comments.

## Syntax Verification

### TypeScript Syntax Check

To verify TypeScript syntax for a single file:

```bash
# Check the entire project (recommended - respects tsconfig.json)
tsc --noEmit -p tsconfig.json

# Check a single file while ignoring tsconfig.json
# Note: This loses compiler options from tsconfig (strictness, path mappings, lib options)
tsc --noEmit --ignoreConfig src/path/to/file.ts
```

> **Note:** If you run `tsc --noEmit src/path/to/file.ts` directly and a `tsconfig.json` exists, TypeScript will error with `TS5112: tsconfig.json is present but will not be loaded if files are specified on commandline. Use '--ignoreConfig' to skip this error.`

### Node.js Syntax Check

To verify JavaScript/Node.js syntax without executing:

```bash
# Check syntax of a JS file (parses but does not run)
node --check src/path/to/file.js
# or shorthand:
node -c src/path/to/file.js

# Check syntax of an ESM module
node --check --input-type=module src/path/to/file.mjs

# For TypeScript files, use ts-node for syntax/type checking
ts-node --transpile-only src/path/to/file.ts
```

> **Tip:** `node --check` validates syntax and reports errors like `SyntaxError: Unexpected token` without executing the code. It does NOT catch runtime errors or logical bugs.