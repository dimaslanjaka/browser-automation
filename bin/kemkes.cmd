@echo off
REM kemkes.cmd now runs kemkes.mjs using Node.js
node --no-warnings=ExperimentalWarning -r ./.vscode/js-hook.cjs "%~dp0kemkes.mjs" %*