param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$TaskName = "HydraulicsAutoCommit",
    [int]$Minutes = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $RepoRoot "scripts\\auto-commit-push.ps1"
if (-not (Test-Path $scriptPath)) {
    Write-Host "Missing script: $scriptPath"
    exit 1
}

$action = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

Write-Host "Creating scheduled task '$TaskName' to run every $Minutes minutes..."
schtasks /Create /TN $TaskName /TR $action /SC MINUTE /MO $Minutes /F | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create task."
    exit $LASTEXITCODE
}

Write-Host "Task created."
