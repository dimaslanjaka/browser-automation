@echo off

set "SCRIPT=%CD%\src\runner\skrin2.js"
echo Running %SCRIPT%
node --no-warnings=ExperimentalWarning -r ./.vscode/js-hook.cjs "%SCRIPT%" %*