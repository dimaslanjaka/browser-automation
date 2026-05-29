@echo off


python "%CD%\bin\parallel.py" %*
exit /b 1

@rem cmd /k to keep the window open after execution
@rem cmd /c to execute the command and then close the window

if /I "%~1"=="launch" goto :launch
if /I "%~1"=="skrin" goto :skrin

:launch
shift
set "BUNDLE_INPUT=%CD%\src\puppeteer\parallel\launcher.ts"
set "BUNDLE_OUTPUT=%CD%\dist\parallel\launcher.cjs"
call npx rollup -c rollup.config.js
start "" cmd /c "node --no-warnings=ExperimentalWarning -r ./.vscode/js-hook.cjs %CD%\dist\parallel\launcher.cjs %*"
exit /b %ERRORLEVEL%

:skrin
shift
set "BUNDLE_INPUT=%CD%\src\puppeteer\parallel\skrin.ts"
set "BUNDLE_OUTPUT=%CD%\dist\parallel\skrin.cjs"
call npx rollup -c rollup.config.js
start "" cmd /k "node --no-warnings=ExperimentalWarning -r ./.vscode/js-hook.cjs %CD%\dist\parallel\skrin.cjs %*"
exit /b %ERRORLEVEL%
