@echo off

set SCRIPT_DIR=%~dp0
set CWD=%CD%
set BUILD_SCRIPT=%SCRIPT_DIR%build.mjs

echo Running build script in %CWD%
echo Build script path: %BUILD_SCRIPT%

node %BUILD_SCRIPT%

node %CWD%\dist\runner\sehatindonesiaku-kemkes.js %*