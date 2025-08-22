@echo off

set SCRIPT_DIR=%~dp0
set CWD=%CD%
set BUILD_SCRIPT=%SCRIPT_DIR%build.mjs

echo Running build script in %CWD%
echo Build script path: %BUILD_SCRIPT%

@REM if arguments --dev or --development are passed, run the development build
if "%1"=="--dev" goto devbuild
if "%1"=="--development" goto devbuild
goto prod

:devbuild
echo Running development build (TypeScript source)...
shift
start cmd.exe /k "node --no-warnings --loader ts-node/esm %CWD%\src\runner\sehatindonesiaku-kemkes.ts %*"
goto end

:prod
echo Running production build...
node %BUILD_SCRIPT%
node %CWD%\dist\runner\sehatindonesiaku-kemkes.js %*

:end