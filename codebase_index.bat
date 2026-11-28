@echo off
setlocal

REM Get the directory containing this batch script
set "REPO_PATH=%~dp0"

REM Remove trailing backslash
if "%REPO_PATH:~-1%"=="\" set "REPO_PATH=%REPO_PATH:~0,-1%"

REM Default name: folder name containing this script
for %%I in ("%REPO_PATH%") do set "PACKAGE_NAME=%%~nxI"

REM Override with package.json name if available
if exist "%REPO_PATH%\package.json" (
    for /f "usebackq delims=" %%N in (`node -p "require(process.argv[1]).name || ''" "%REPO_PATH%\package.json" 2^>nul`) do set "PACKAGE_NAME=%%N"
)

echo ==========================================
echo  Codebase Memory - Repository Indexer
echo ==========================================
echo Repository: "%REPO_PATH%"
echo Name:       "%PACKAGE_NAME%"
echo.

REM Run full repository indexing with persistence enabled
codebase-memory-mcp cli index_repository --repo-path "%REPO_PATH%" --name "%PACKAGE_NAME%" --mode full --persistence true

if errorlevel 1 (
    echo.
    echo [ERROR] Repository indexing failed.
    exit /b 1
)

echo.
echo [SUCCESS] Repository indexing completed.
exit /b 0
