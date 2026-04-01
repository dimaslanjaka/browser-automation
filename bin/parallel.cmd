@echo off

if /I "%~1"=="launch" goto :launch

:launch
shift
start "" cmd /k call node --no-warnings=ExperimentalWarning --loader ts-node/esm -r ./.vscode/js-hook.cjs "%CD%\src\puppeteer\parallel\launcher.ts" %*
exit /b %ERRORLEVEL%
