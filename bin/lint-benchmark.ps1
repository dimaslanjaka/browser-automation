
$ErrorActionPreference = 'Stop'

# ==========================================
# Capture forwarded arguments
# ==========================================

$EslintArgs = @($args)

# ==========================================
# Configuration
# ==========================================

$fixedArgs = @(
    'yarn'
    'eslint'
    '--max-warnings=0'
    '--no-error-on-unmatched-pattern'
)

$allArgs = $fixedArgs + $EslintArgs

# ==========================================
# Windows argument escaping
# ==========================================

function Quote-Argument {
    param(
        [AllowEmptyString()]
        [string] $Value
    )

    if ($Value -notmatch '[\s"]') {
        return $Value
    }

    $escaped = $Value -replace '(\\*)"', '$1$1\"'
    $escaped = $escaped -replace '(\\+)$', '$1$1'

    return '"' + $escaped + '"'
}

$argumentString = (
    $allArgs | ForEach-Object {
        Quote-Argument $_
    }
) -join ' '

# ==========================================
# Process tree helper
# ==========================================

function Get-ProcessTree {
    param(
        [int] $RootProcessId
    )

    $allProcesses = @(
        Get-CimInstance Win32_Process -ErrorAction SilentlyContinue
    )

    $result = [System.Collections.Generic.HashSet[int]]::new()
    [void]$result.Add($RootProcessId)

    $changed = $true

    while ($changed) {
        $changed = $false

        foreach ($process in $allProcesses) {
            $parentId = [int]$process.ParentProcessId
            $processId = [int]$process.ProcessId

            if (
                $result.Contains($parentId) -and
                -not $result.Contains($processId)
            ) {
                [void]$result.Add($processId)
                $changed = $true
            }
        }
    }

    return $result
}

# ==========================================
# Start benchmark
# ==========================================

$start = [DateTime]::UtcNow

$peakWorking = 0L
$peakPrivate = 0L
$samples = 0

Write-Host ''
Write-Host '=========================================='
Write-Host 'ESLint Performance Measurement'
Write-Host '=========================================='

Write-Host "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff')"
Write-Host "Arguments: $($allArgs -join ' ')"

Write-Host ''
Write-Host 'Forwarded ESLint arguments:'

foreach ($arg in $EslintArgs) {
    Write-Host "  [$arg]"
}

Write-Host ''

# ==========================================
# Launch ESLint
# ==========================================

$process = Start-Process `
    -FilePath 'corepack.cmd' `
    -ArgumentList $argumentString `
    -PassThru `
    -NoNewWindow

$rootProcessId = $process.Id

Write-Host "Launcher PID: $rootProcessId"
Write-Host 'Monitoring ESLint process tree...'
Write-Host ''

# ==========================================
# Monitor memory
# ==========================================

while ($true) {
    $process.Refresh()

    if ($process.HasExited) {
        break
    }

    $processIds = @(
        Get-ProcessTree -RootProcessId $rootProcessId
    )

    $working = 0L
    $private = 0L

    foreach ($processId in $processIds) {
        try {
            $child = Get-Process -Id $processId -ErrorAction Stop

            $working += $child.WorkingSet64
            $private += $child.PrivateMemorySize64
        }
        catch {
            # Process may have exited between samples.
        }
    }

    if ($working -gt $peakWorking) {
        $peakWorking = $working
    }

    if ($private -gt $peakPrivate) {
        $peakPrivate = $private
    }

    $samples++

    Write-Host (
        "`rRAM: {0,8:N2} MB | Private: {1,8:N2} MB | Peak: {2,8:N2} MB | Processes: {3}" -f
        ($working / 1MB),
        ($private / 1MB),
        ($peakWorking / 1MB),
        $processIds.Count
    ) -NoNewline

    Start-Sleep -Milliseconds 500
}

$process.WaitForExit()
$process.Refresh()

# ==========================================
# Results
# ==========================================

$exitCode = $process.ExitCode
$elapsed = [DateTime]::UtcNow - $start

Write-Host ''
Write-Host ''
Write-Host '=========================================='
Write-Host 'ESLint Benchmark Results'
Write-Host '=========================================='

[PSCustomObject]@{
    ElapsedSeconds = [Math]::Round($elapsed.TotalSeconds, 3)
    PeakWorkingMB  = [Math]::Round($peakWorking / 1MB, 2)
    PeakPrivateMB  = [Math]::Round($peakPrivate / 1MB, 2)
    Samples        = $samples
    ExitCode       = $exitCode
} | Format-List

exit $exitCode
