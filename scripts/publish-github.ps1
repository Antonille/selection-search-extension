[CmdletBinding()]
param(
  [string]$RepoOwner = 'Antonille',
  [string]$RepoName = 'selection-search-extension',
  [string]$DefaultBranch = 'main'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host $Message
}

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function Convert-ToCommandLineArgument([string]$Value) {
  if ($null -eq $Value) { return '""' }
  if ($Value -match '[\s"]') {
    return '"' + ($Value -replace '"', '\"') + '"'
  }
  return $Value
}

function Invoke-ExternalCapture([string]$FilePath, [string[]]$ArgumentList) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FilePath
  $psi.Arguments = (($ArgumentList | ForEach-Object { Convert-ToCommandLineArgument $_ }) -join ' ')
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $psi
  [void]$process.Start()
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()

  [pscustomobject]@{
    ExitCode = $process.ExitCode
    StdOut   = $stdout
    StdErr   = $stderr
  }
}

function Invoke-External([string]$FilePath, [string[]]$ArgumentList) {
  $result = Invoke-ExternalCapture $FilePath $ArgumentList
  if ($result.StdOut) { Write-Host $result.StdOut.TrimEnd() }
  if ($result.ExitCode -ne 0) {
    $renderedArgs = ($ArgumentList | ForEach-Object { Convert-ToCommandLineArgument $_ }) -join ' '
    $details = (($result.StdErr + "`n" + $result.StdOut).Trim())
    if ($details) { Write-Host $details }
    throw ("Command failed with exit code ${($result.ExitCode)}: {0} {1}" -f $FilePath, $renderedArgs)
  }
  return $result
}

function Get-ProjectRoot {
  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  $candidate = [System.IO.Path]::GetFullPath((Join-Path $scriptDir '..'))
  if (Test-Path (Join-Path $candidate 'manifest.json')) {
    return $candidate
  }
  $candidate2 = [System.IO.Path]::GetFullPath((Join-Path $scriptDir '..\..'))
  if (Test-Path (Join-Path $candidate2 'manifest.json')) {
    return $candidate2
  }
  throw ('Could not locate project root containing manifest.json. Checked: {0} and {1}' -f $candidate, $candidate2)
}

function Ensure-GitIdentity {
  $name = (git config user.name 2>$null)
  $email = (git config user.email 2>$null)
  if (-not $name -or -not $email) {
    throw 'Git identity is not configured for this repository. Run: git config user.name "Antonille" and git config user.email "you@example.com"'
  }
}

function Test-GitRepoExists {
  return (Test-Path (Join-Path (Get-Location) '.git'))
}

function Test-NodeAvailable {
  return [bool](Get-Command node -ErrorAction SilentlyContinue)
}

function Invoke-SecretScan {
  if (Test-NodeAvailable -and (Test-Path '.\scripts\scan-secrets.mjs')) {
    Write-Step 'Running secret scan with Node helper...'
    Invoke-External 'node' @('.\scripts\scan-secrets.mjs') | Out-Null
    return
  }

  Write-Step 'Node not found. Running built-in PowerShell secret scan instead...'
  $patterns = @(
    'ghp_[A-Za-z0-9]{36,}',
    'github_pat_[A-Za-z0-9_]{20,}',
    'AIza[0-9A-Za-z\-_]{35}',
    'sk-[A-Za-z0-9]{20,}',
    '-----BEGIN (RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY-----'
  )
  $skipDirs = @('.git', 'node_modules', '.venv', 'venv')
  $hits = @()
  Get-ChildItem -Recurse -File | Where-Object {
    $full = $_.FullName
    foreach ($dir in $skipDirs) {
      if ($full -like "*\\$dir\\*") { return $false }
    }
    return $true
  } | ForEach-Object {
    try {
      $content = Get-Content -Path $_.FullName -Raw -ErrorAction Stop
      foreach ($pattern in $patterns) {
        if ($content -match $pattern) {
          $hits += $_.FullName
          break
        }
      }
    } catch {}
  }
  if ($hits.Count -gt 0) {
    throw ('Potential secrets found in working tree: ' + ($hits -join ', '))
  }
  Write-Host 'No likely secrets found in working tree.'
}

function Invoke-ExtensionValidation {
  if (Test-NodeAvailable -and (Test-Path '.\scripts\validate-extension.mjs')) {
    Write-Step 'Running extension validation with Node helper...'
    Invoke-External 'node' @('.\scripts\validate-extension.mjs') | Out-Null
    return
  }

  Write-Step 'Node not found. Running built-in PowerShell validation instead...'
  if (-not (Test-Path '.\manifest.json')) { throw 'manifest.json not found.' }
  if (-not (Test-Path '.\providers.default.json')) { throw 'providers.default.json not found.' }
  $manifest = Get-Content '.\manifest.json' -Raw | ConvertFrom-Json
  if (-not $manifest.manifest_version) { throw 'manifest.json is missing manifest_version.' }
  $providers = Get-Content '.\providers.default.json' -Raw | ConvertFrom-Json
  if (-not $providers.schema_version -or -not $providers.resources) { throw 'providers.default.json must be v2 schema with schema_version and resources.' }
  Write-Host 'Extension validation passed.'
}

function Ensure-GitInitialized([string]$BranchName) {
  if (-not (Test-GitRepoExists)) {
    Write-Step 'Initializing git repository...'
    Invoke-External 'git' @('init') | Out-Null
  }

  $head = Invoke-ExternalCapture 'git' @('rev-parse', '--abbrev-ref', 'HEAD')
  if ($head.ExitCode -ne 0 -or -not $head.StdOut.Trim()) {
    Invoke-External 'git' @('checkout', '-B', $BranchName) | Out-Null
  } else {
    $current = $head.StdOut.Trim()
    if ($current -ne $BranchName) {
      $branches = Invoke-ExternalCapture 'git' @('branch', '--list', $BranchName)
      if ($branches.StdOut.Trim()) {
        Invoke-External 'git' @('checkout', $BranchName) | Out-Null
      } else {
        Invoke-External 'git' @('checkout', '-B', $BranchName) | Out-Null
      }
    } else {
      Write-Step "Already on branch '$BranchName'."
    }
  }
}

function Commit-IfNeeded {
  Write-Step 'Staging files...'
  Invoke-External 'git' @('add', '.') | Out-Null

  $status = Invoke-ExternalCapture 'git' @('status', '--porcelain')
  if ($status.ExitCode -ne 0) {
    throw 'Unable to determine git status.'
  }
  if (-not $status.StdOut.Trim()) {
    Write-Step 'No changes to commit.'
    return
  }

  Ensure-GitIdentity
  Invoke-External 'git' @('commit', '-m', 'Update extension, docs, and automation') | Out-Null
}

function Ensure-GitHubRepo([string]$RepoFull) {
  Write-Step "Checking whether repository $RepoFull already exists..."
  $view = Invoke-ExternalCapture 'gh' @('repo', 'view', $RepoFull, '--json', 'name')
  if ($view.ExitCode -eq 0) {
    Write-Step 'Repository already exists.'
    return
  }

  $combined = (($view.StdErr + "`n" + $view.StdOut).Trim())
  if ($combined -match 'Could not resolve to a Repository' -or $combined -match 'not found' -or $combined -match 'HTTP 404') {
    Write-Step 'Repository does not exist yet. Creating public repository...'
    Invoke-External 'gh' @('repo', 'create', $RepoFull, '--public', '--source', '.', '--remote', 'origin', '--push') | Out-Null
    return
  }

  throw "Unable to determine whether repository $RepoFull exists. GitHub CLI said: $combined"
}

function Ensure-OriginRemote([string]$RepoUrl) {
  $remoteList = Invoke-ExternalCapture 'git' @('remote')
  if ($remoteList.ExitCode -ne 0) {
    throw 'Unable to inspect git remotes.'
  }
  $remotes = @($remoteList.StdOut -split "`r?`n" | Where-Object { $_.Trim() })
  if ($remotes -contains 'origin') {
    $originUrl = (Invoke-ExternalCapture 'git' @('remote', 'get-url', 'origin')).StdOut.Trim()
    if ($originUrl -ne $RepoUrl) {
      Write-Step 'Updating origin remote URL...'
      Invoke-External 'git' @('remote', 'set-url', 'origin', $RepoUrl) | Out-Null
    }
  } else {
    Write-Step 'Adding origin remote...'
    Invoke-External 'git' @('remote', 'add', 'origin', $RepoUrl) | Out-Null
  }
}

function Ensure-Push([string]$BranchName) {
  Write-Step "Pushing branch '$BranchName' to origin..."
  Invoke-External 'git' @('push', '-u', 'origin', $BranchName) | Out-Null
}

function Set-BranchProtection([string]$RepoFull, [string]$BranchName) {
  Write-Step "Applying branch protection to $BranchName ..."
  $bodyObject = @{
    required_status_checks = @{
      strict   = $true
      contexts = @('CI / validate')
    }
    enforce_admins = $true
    required_pull_request_reviews = @{
      dismiss_stale_reviews           = $true
      require_code_owner_reviews      = $false
      required_approving_review_count = 1
      require_last_push_approval      = $false
    }
    restrictions = $null
    required_linear_history = $false
    allow_force_pushes = $false
    allow_deletions = $false
    block_creations = $false
    required_conversation_resolution = $true
    lock_branch = $false
    allow_fork_syncing = $false
  }

  $tempJson = Join-Path $env:TEMP 'selection-search-extension-branch-protection.json'
  [System.IO.File]::WriteAllText($tempJson, ($bodyObject | ConvertTo-Json -Depth 10), (New-Object System.Text.UTF8Encoding($false)))
  try {
    Invoke-External 'gh' @(
      'api',
      '--method', 'PUT',
      '-H', 'Accept: application/vnd.github+json',
      '-H', 'X-GitHub-Api-Version: 2022-11-28',
      "/repos/$RepoFull/branches/$BranchName/protection",
      '--input', $tempJson
    ) | Out-Null
  } finally {
    if (Test-Path $tempJson) { Remove-Item $tempJson -Force }
  }
}

$projectRoot = Get-ProjectRoot
Set-Location $projectRoot

Require-Command 'git'
Require-Command 'gh'

$repoFull = "$RepoOwner/$RepoName"
$repoUrl = "https://github.com/$RepoOwner/$RepoName.git"

Write-Step 'Checking GitHub authentication...'
Invoke-External 'gh' @('auth', 'status') | Out-Null

Invoke-SecretScan
Invoke-ExtensionValidation
Ensure-GitInitialized -BranchName $DefaultBranch
Commit-IfNeeded
Ensure-GitHubRepo -RepoFull $repoFull
Ensure-OriginRemote -RepoUrl $repoUrl
Ensure-Push -BranchName $DefaultBranch
Set-BranchProtection -RepoFull $repoFull -BranchName $DefaultBranch

Write-Host ''
Write-Host 'Done.'
Write-Host ("Repo URL: https://github.com/{0}/{1}" -f $RepoOwner, $RepoName)
