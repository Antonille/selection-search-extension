[CmdletBinding()]
param(
  [string]$Owner = "Antonille",
  [string]$Repo = "selection-search-extension",
  [string]$DefaultBranch = "main"
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$targetScript = Join-Path $projectRoot 'scripts\publish-github.ps1'

if (-not (Test-Path $targetScript)) {
  throw "Could not find root publish script at: $targetScript"
}

Push-Location $projectRoot
try {
  & $targetScript -Owner $Owner -Repo $Repo -DefaultBranch $DefaultBranch
} finally {
  Pop-Location
}
