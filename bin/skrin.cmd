@echo off

if /I "%~1"=="build" goto :build_all
if /I "%~1"=="process" goto :build_process
if /I "%~1"=="database" goto :build_database
if /I "%~1"=="direct" goto :run_direct
if /I "%~1"=="2" goto :run_skrin2
if /I "%~1"=="skrin2" goto :run_skrin2
if /I "%~1"=="cluster" goto :run_cluster
if /I "%~1"=="clusterdist" goto :run_cluster_dist

set "SKRIN_INPUT=%CD%\src\runner\skrin.direct.js"
set "SKRIN_OUTPUT=%CD%\dist\skrin.bundle.cjs"

set "BUILD_TARGET=skrin"
call rollup -c rollup.skrin.js

echo Running %SKRIN_OUTPUT%
call node --no-warnings=ExperimentalWarning -r ./.vscode/js-hook.cjs "%SKRIN_OUTPUT%" %*
exit /b %ERRORLEVEL%

:build_all
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

:build_process
echo building process...
set "BUILD_TARGET=process"
call rollup -c rollup.skrin.js
exit /b %ERRORLEVEL%

:build_database
echo building database...
set "BUILD_TARGET=database"
call rollup -c rollup.skrin.js
exit /b %ERRORLEVEL%

:run_cluster
shift
call node --no-warnings=ExperimentalWarning --loader ts-node/esm -r ./.vscode/js-hook.cjs "%CD%\src\runner\skrin-cluster.ts" %*
exit /b %ERRORLEVEL%

:run_cluster_dist
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
shift
call node --no-warnings=ExperimentalWarning -r ./.vscode/js-hook.cjs "%CD%\src\runner\skrin.direct.js" %*
exit /b %ERRORLEVEL%

:run_skrin2
echo building skrin2 runner...
set "SKRIN_INPUT=%CD%\src\runner\skrin2.js"
set "SKRIN_OUTPUT=%CD%\dist\skrin2.bundle.cjs"
set "BUILD_TARGET=skrin"
call rollup -c rollup.skrin.js
echo running skrin2 runner...
shift
call node --no-warnings=ExperimentalWarning -r ./.vscode/js-hook.cjs "%SKRIN_OUTPUT%" %*
exit /b %ERRORLEVEL%
