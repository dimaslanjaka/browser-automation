@echo off

if /I "%~1"=="build" (
  echo building database...
	set "BUILD_TARGET=database"
	call rollup -c rollup.skrin.js
  echo building process...
  set "BUILD_TARGET=process"
	call rollup -c rollup.skrin.js
  echo building types...
  set "BUILD_TARGET=dts"
	call rollup -c rollup.skrin.js
	exit /b %ERRORLEVEL%
)

if /I "%~1"=="process" (
  echo building process...
  set "BUILD_TARGET=process"
  call rollup -c rollup.skrin.js
  exit /b %ERRORLEVEL%
)

if /I "%~1"=="database" (
  echo building database...
  set "BUILD_TARGET=database"
  call rollup -c rollup.skrin.js
  exit /b %ERRORLEVEL%
)

if /I "%~1"=="direct" goto :run_direct
if /I "%~1"=="2" goto :run_skrin2
if /I "%~1"=="cluster" goto :run_cluster

@REM set "SKRIN_INPUT=%CD%\src\runner\skrin2.js"
set "SKRIN_INPUT=%CD%\src\runner\skrin.direct.js"
@REM set "SKRIN_INPUT=%CD%\src\runner\skrin-cluster.ts"
set "SKRIN_OUTPUT=%CD%\dist\skrin.bundle.cjs"

set "BUILD_TARGET=skrin"
call rollup -c rollup.skrin.js

echo Running %SKRIN_OUTPUT%
call node --no-warnings=ExperimentalWarning -r ./.vscode/js-hook.cjs "%SKRIN_OUTPUT%" %*
exit /b %ERRORLEVEL%

@REM run script with ts-node
@REM call node --no-warnings=ExperimentalWarning --loader ts-node/esm -r ./.vscode/js-hook.cjs "%CD%\src\runner\skrin-cluster.ts" %*

:run_cluster
echo building cluster runner...
set "SKRIN_INPUT=%CD%\src\runner\skrin-cluster.ts"
set "SKRIN_OUTPUT=%CD%\dist\skrin.bundle.cjs"
set "BUILD_TARGET=skrin"
call rollup -c rollup.skrin.js
echo running cluster runner...
shift
call node --no-warnings=ExperimentalWarning -r ./.vscode/js-hook.cjs "%SKRIN_OUTPUT%" %*
exit /b %ERRORLEVEL%

:run_direct
echo building direct runner...
set "SKRIN_INPUT=%CD%\src\runner\skrin.direct.js"
set "SKRIN_OUTPUT=%CD%\dist\skrin.bundle.cjs"
set "BUILD_TARGET=skrin"
call rollup -c rollup.skrin.js
echo running direct runner...
shift
call node --no-warnings=ExperimentalWarning -r ./.vscode/js-hook.cjs "%SKRIN_OUTPUT%" %*
exit /b %ERRORLEVEL%

:run_skrin2
echo building skrin2 runner...
set "SKRIN_INPUT=%CD%\src\runner\skrin2.js"
set "SKRIN_OUTPUT=%CD%\dist\skrin.bundle.cjs"
set "BUILD_TARGET=skrin"
call rollup -c rollup.skrin.js
echo running skrin2 runner...
shift
call node --no-warnings=ExperimentalWarning -r ./.vscode/js-hook.cjs "%SKRIN_OUTPUT%" %*
exit /b %ERRORLEVEL%
