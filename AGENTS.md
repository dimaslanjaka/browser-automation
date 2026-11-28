# AI Agents Guide: Browser Automation

This guide provides essential context for AI agents to be productive in the `browser-automation` codebase.

## 🛠 Project Overview
A specialized browser automation library for scraping and form filling, specifically targeting the "skrining" web application. It emphasizes stealth, fingerprinting, and stability.

## 🚀 Quick Start (Build & Test)
- **Build**: `npm run build` (runs `build.exports.cjs`, `tsc`, and `rollup`).
- **Test**: `npm run test` (Jest with `--runInBand` and `--detectOpenHandles`).
- **Lint**: `npm run lint` or `npm run lint:fix`.
- **Verify**: `npm run verify` (type check via `tsc`).
- **Clean**: `npm run clean` (removes `dist`, `tmp`, and browser profile folders).

## 🏗 Architecture & Key Files
The project is structured around Puppeteer wrappers and business-logic "recipes".

| Key File | Role |
| :--- | :--- |
| `src/puppeteer_utils.js` | Central hub for browser instances, fingerprints, and profile management. |
| `src/skrin_puppeteer.js` | High-level business logic for the target "skrining" application. |
| `src/index.ts` | Public API entry point. |
| `bin/pp.mjs` | Primary CLI tool for running parallel automation tasks. |
| `package.json` | Build pipeline and binary exports. |

## 🧩 Coding Conventions
- **Stealth**: Uses `puppeteer-extra` with `StealthPlugin` to avoid bot detection.
- **Fingerprinting**: Implement custom browser identities via `src/fingerprint_utils.js`.
- **Profile Isolation**: Uses separate user data directories to prevent session clashes.
- **Robustness**: Prefer `waitForDomStable` and `goWithRetry` over standard `page.goto` for reliability.
- **Environment**: Credentials are read from `process.env` (e.g., `skrin_username`, `skrin_password`).

## ⚠️ Common Pitfalls
- **Profile Locks**: If a process crashes, browser profiles may remain locked. Run `npm run clean` to resolve.
- **CAPTCHAs**: Automatic submission halts upon detecting `#gambar-captcha`; manual intervention is required.
- **Node.js Flags**: Some scripts require `--experimental-vm-modules` and specific JS hooks.
- **Bin Resolution**: Note that `bin/` scripts resolve between `src/` (dev) and `lib/` (bundled) folders.

## 📚 Reference Documentation
- [General Overview](readme.md)
- [XLSX Server Utility](xlsx-web-server.md)
- [Google Sheets Integration](download-google-sheet.md)
- [Safelink Package](packages/safelink/readme.md)
