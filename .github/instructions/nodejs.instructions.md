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
tsc --noEmit -p tsconfig.json
ts-node --transpile-only src/path/to/file.ts
```

### Node.js Syntax Check

To verify JavaScript/Node.js syntax without executing:

```bash
# Check syntax of a JS file (parses but does not run)
node --check src/path/to/file.js
# or shorthand:
node -c src/path/to/file.js
# Check syntax of an ESM module
node --check --input-type=module src/path/to/file.mjs
```

> **Tip:** `node --check` validates syntax and reports errors like `SyntaxError: Unexpected token` without executing the code. It does NOT catch runtime errors or logical bugs.