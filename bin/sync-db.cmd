@echo off

setlocal
set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%.."

set "SYNC_DIRECTION=mysql-to-sqlite"

echo Select sync direction:
echo   [1] mysql-to-sqlite
echo   [2] sqlite-to-mysql
choice /C 12 /N /M "Enter choice (1 or 2): "
if errorlevel 2 (
	set "SYNC_DIRECTION=sqlite-to-mysql"
) else (
	set "SYNC_DIRECTION=mysql-to-sqlite"
)

node --no-warnings=ExperimentalWarning --loader ts-node/esm -r "%REPO_ROOT%\.vscode\js-hook.cjs" "%REPO_ROOT%\src\database\sync-%SYNC_DIRECTION%.ts" %*

endlocal
