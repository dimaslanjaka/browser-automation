@echo off

if /I "%~1"=="launch" goto :launch
if /I "%~1"=="skrin" goto :skrin

:launch
shift
start "" cmd /c node --no-warnings=ExperimentalWarning --loader ts-node/esm -r ./.vscode/js-hook.cjs "%CD%\src\puppeteer\parallel\launcher.ts" %*
exit /b %ERRORLEVEL%

:skrin
shift
start "" cmd /c node --no-warnings=ExperimentalWarning --loader ts-node/esm -r ./.vscode/js-hook.cjs "%CD%\src\puppeteer\parallel\skrin.ts" %*
exit /b %ERRORLEVEL%
