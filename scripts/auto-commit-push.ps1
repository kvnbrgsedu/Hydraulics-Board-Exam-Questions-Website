param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$CommitMessagePrefix = "Auto-commit"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location $RepoRoot

if (-not (Test-Path ".git")) {
    Write-Host "Not a git repository: $RepoRoot"
    exit 1
}

if (Test-Path ".git/index.lock") {
    Write-Host "Git index is locked; skipping."
    exit 0
}

$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    exit 0
}

git add -A

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMessage = "${CommitMessagePrefix}: $timestamp"
git commit -m $commitMessage
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

git push
exit $LASTEXITCODE
