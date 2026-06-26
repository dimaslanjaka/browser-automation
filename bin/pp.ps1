#!/usr/bin/env pwsh
try {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
} catch {
    $scriptDir = Get-Location
}

& node (Join-Path $scriptDir 'pp.mjs') @args
exit $LASTEXITCODE
