@echo off
setlocal enabledelayedexpansion

:: Output path
set "CACHE_DIR=.cache\git"
set "OUTPUT=%CACHE_DIR%\diff.txt"

:: Ensure output directory exists
if not exist "%CACHE_DIR%" (
    mkdir "%CACHE_DIR%"
)

:: Validate input
if "%~1"=="" (
    echo [X] Error: No argument provided
    echo Usage: git-diff filename ^| --staged-only
    exit /b 1
)

:: Handle --staged-only
if "%~1"=="--staged-only" (
    git --no-pager diff --staged > "%OUTPUT%"
    if exist "%OUTPUT%" (
        echo [✓] Full staged diff saved to "%OUTPUT%"
    ) else (
        echo [X] Failed to save staged diff
    )
    exit /b
)

:: Handle specific file diff
set "FILE=%~1"
git --no-pager diff --cached -- "%FILE%" > "%OUTPUT%"

if exist "%OUTPUT%" (
    echo [✓] Staged diff of "%FILE%" saved to "%OUTPUT%"
) else (
    echo [X] Failed to generate diff for "%FILE%"
)

endlocal
