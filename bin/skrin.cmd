@echo off

@REM set "SKRIN_INPUT=%CD%\src\runner\skrin2.js"
@REM set "SKRIN_INPUT=%CD%\src\runner\skrin.direct.js"
set "SKRIN_INPUT=%CD%\src\runner\skrin-cluster.ts"
set "SKRIN_OUTPUT=%CD%\dist\skrin.bundle.cjs"
call rollup -c rollup.skrin.js

echo Running %SKRIN_OUTPUT%
call node --no-warnings=ExperimentalWarning -r ./.vscode/js-hook.cjs "%SKRIN_OUTPUT%" %*

@REM run script with ts-node
@REM call node --no-warnings=ExperimentalWarning --loader ts-node/esm -r ./.vscode/js-hook.cjs "%CD%\src\runner\skrin-cluster.ts" %*
