#!/usr/bin/env pwsh
try {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
} catch {
    $scriptDir = Get-Location
}

# Prefer running the Python wrapper if Python is available
$py = Get-Command python -ErrorAction SilentlyContinue
if ($py) {
    & python "$PWD\bin\parallel.py" @args
    exit $LASTEXITCODE
}

if ($args.Count -eq 0) {
    Write-Host "Usage: pp.ps1 <launch|skrin|check|skrin-check> [options] [-- args]"
    exit 0
}

$command = $args[0].ToLower()
$remaining = @()
if ($args.Count -gt 1) { $remaining = $args[1..($args.Count-1)] }

function QuoteArg([string]$s) {
    if ($s -match '\s') { return '"' + $s + '"' }
    return $s
}

switch ($command) {
    'launch' {
        $env:BUNDLE_INPUT = Join-Path $PWD 'src\puppeteer\parallel\launcher.runner.ts'
        $env:BUNDLE_OUTPUT = Join-Path $PWD 'dist\parallel\launcher.cjs'

        # Run rollup (will print output to this terminal)
        & npx rollup -c rollup.config.js
        $nodeArgs = @("--no-warnings=ExperimentalWarning", "-r", "./.vscode/js-hook.cjs", $env:BUNDLE_OUTPUT) + $remaining
        $nodeCmd = "node " + ($nodeArgs | ForEach-Object { QuoteArg $_ } ) -join ' '

        # Start in a new cmd process and close after execution
        Start-Process -FilePath cmd -ArgumentList '/c', $nodeCmd
        exit 0
    }
    'skrin' {
        $env:BUNDLE_INPUT = Join-Path $PWD 'src\puppeteer\parallel\skrin.ts'
        $env:BUNDLE_OUTPUT = Join-Path $PWD 'dist\parallel\skrin.cjs'

        & npx rollup -c rollup.config.js
        $nodeArgs = @("--no-warnings=ExperimentalWarning", "-r", "./.vscode/js-hook.cjs", $env:BUNDLE_OUTPUT) + $remaining
        $nodeCmd = "node " + ($nodeArgs | ForEach-Object { QuoteArg $_ } ) -join ' '

        # Start in a new cmd process and keep the window open after execution
        Start-Process -FilePath cmd -ArgumentList '/k', $nodeCmd
        exit 0
    }
    default {
        Write-Host "Unknown command: $command"
        exit 1
    }
}
