@echo off

@REM set "SKRIN_INPUT=%CD%\src\runner\skrin2.js"
set "SKRIN_INPUT=%CD%\src\runner\skrin.js"
call rollup -c rollup.skrin.js

set "SCRIPT=%CD%\dist\skrin2.bundle.cjs"
echo Running %SCRIPT%
node --no-warnings=ExperimentalWarning -r ./.vscode/js-hook.cjs "%SCRIPT%" %*
