param(
    [string]$TaskName = "HydraulicsAutoCommit"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Removing scheduled task '$TaskName'..."
schtasks /Delete /TN $TaskName /F | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to remove task."
    exit $LASTEXITCODE
}

Write-Host "Task removed."
