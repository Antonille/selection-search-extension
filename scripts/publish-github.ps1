[CmdletBinding()]
param(
  [string]$Owner = "Antonille",
  [string]$Repo = "selection-search-extension",
  [string]$DefaultBranch = "main"
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function Test-Command([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-External {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [Parameter()]
    [string[]]$ArgumentList = @(),
    [switch]$IgnoreExitCode
  )

  & $FilePath @ArgumentList
  $exitCode = $LASTEXITCODE
  if (-not $IgnoreExitCode -and $exitCode -ne 0) {
    $renderedArgs = ($ArgumentList | ForEach-Object {
      if ($_ -match '\s') { '"' + $_ + '"' } else { $_ }
    }) -join ' '
    throw ("Command failed with exit code ${exitCode}: {0} {1}" -f $FilePath, $renderedArgs)
  }
  return $exitCode
}

function Validate-ExtensionBasic {
  $requiredFiles = @(
    'manifest.json',
    'background.js',
    'options.html',
    'options.js',
    'options.css',
    'providers.default.json'
  )

  foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
      throw "Missing required file: $file"
    }
  }

  try {
    $manifest = Get-Content 'manifest.json' -Raw | ConvertFrom-Json
  } catch {
    throw 'manifest.json is not valid JSON.'
  }

  if ($manifest.manifest_version -ne 3) {
    throw 'manifest.json must use Manifest V3.'
  }

  if (-not $manifest.permissions) {
    throw 'manifest.json should contain a permissions array.'
  }

  if (-not $manifest.background -or $manifest.background.service_worker -ne 'background.js') {
    throw 'manifest.json should point background.service_worker to background.js.'
  }

  if (-not $manifest.options_ui -or $manifest.options_ui.page -ne 'options.html') {
    throw 'manifest.json should point options_ui.page to options.html.'
  }

  try {
    $defaults = Get-Content 'providers.default.json' -Raw | ConvertFrom-Json
  } catch {
    throw 'providers.default.json is not valid JSON.'
  }

  $hasProviders = $false
  if ($defaults -is [System.Collections.IEnumerable] -and -not ($defaults -is [pscustomobject]) -and -not ($defaults -is [string])) {
    $hasProviders = $true
  }
  if ($defaults.PSObject.Properties.Name -contains 'providers' -and $defaults.providers) {
    $hasProviders = $true
  }
  if ($defaults.PSObject.Properties.Name -contains 'finalists' -and $defaults.finalists) {
    $hasProviders = $true
  }

  if (-not $hasProviders) {
    throw 'providers.default.json must be an array, an object with providers, or an object with finalists.'
  }

  $backgroundJs = Get-Content 'background.js' -Raw
  if ($backgroundJs -notmatch 'chrome\.contextMenus') {
    throw 'background.js does not appear to use chrome.contextMenus.'
  }
  if ($backgroundJs -notmatch 'chrome\.storage') {
    throw 'background.js does not appear to use chrome.storage.'
  }
}

function Get-SecretFindings {
  $findings = New-Object System.Collections.Generic.List[object]
  $ignoredDirNames = @('.git', 'node_modules', 'dist', 'build', 'coverage', 'release')
  $sensitiveFilenames = @('.env', '.env.local', '.env.production', '.env.development', 'credentials.json', 'secrets.json', 'id_rsa', 'id_dsa', '.npmrc')
  $patterns = @(
    @{ Name = 'GitHub fine-grained token'; Pattern = 'github_pat_[A-Za-z0-9_]{20,}' },
    @{ Name = 'GitHub token'; Pattern = '\bgh[pousr]_[A-Za-z0-9]{20,}\b' },
    @{ Name = 'OpenAI-style key'; Pattern = '\bsk-[A-Za-z0-9]{20,}\b' },
    @{ Name = 'AWS access key'; Pattern = '\bAKIA[0-9A-Z]{16}\b' },
    @{ Name = 'Slack token'; Pattern = 'xox[baprs]-[A-Za-z0-9-]{10,}' },
    @{ Name = 'Private key block'; Pattern = '-----BEGIN (?:RSA|DSA|EC|OPENSSH|PGP|PRIVATE) KEY-----' },
    @{ Name = 'Bearer token'; Pattern = 'Bearer\s+[A-Za-z0-9._=-]{20,}' }
  )

  function Add-Finding([string]$Source, [string]$Path, [int]$Line, [string]$Rule, [string]$Sample) {
    $findings.Add([pscustomobject]@{
      Source = $Source
      Path   = $Path
      Line   = $Line
      Rule   = $Rule
      Sample = $Sample
    }) | Out-Null
  }

  function Scan-Text([string]$Source, [string]$Path, [string]$Text) {
    foreach ($entry in $patterns) {
      $matches = [regex]::Matches($Text, $entry.Pattern)
      foreach ($m in $matches) {
        $prefix = $Text.Substring(0, $m.Index)
        $line = ([regex]::Matches($prefix, "`n")).Count + 1
        $sample = $m.Value
        if ($sample.Length -gt 120) {
          $sample = $sample.Substring(0, 120)
        }
        Add-Finding $Source $Path $line $entry.Name $sample
      }
    }
  }

  function Test-BinaryFile([string]$FilePath) {
    try {
      $bytes = [System.IO.File]::ReadAllBytes($FilePath)
      return $bytes -contains 0
    } catch {
      return $true
    }
  }

  $root = (Get-Location).Path
  $files = Get-ChildItem -Recurse -File | Where-Object {
    $full = $_.FullName
    foreach ($dir in $ignoredDirNames) {
      $segment = [IO.Path]::DirectorySeparatorChar + $dir + [IO.Path]::DirectorySeparatorChar
      if ($full.Contains($segment)) { return $false }
    }
    return $true
  }

  foreach ($file in $files) {
    $rel = Resolve-Path -LiteralPath $file.FullName -Relative
    if ($rel.StartsWith('.\')) { $rel = $rel.Substring(2) }

    if ($sensitiveFilenames -contains $file.Name) {
      Add-Finding 'working-tree' $rel 1 'Sensitive filename' $file.Name
    }

    if (Test-BinaryFile $file.FullName) { continue }

    try {
      $text = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction Stop
      Scan-Text 'working-tree' $rel $text
    } catch {
      continue
    }
  }

  $insideRepo = $false
  & git rev-parse --is-inside-work-tree *> $null
  if ($LASTEXITCODE -eq 0) { $insideRepo = $true }

  if ($insideRepo) {
    $revList = (& git rev-list --all) 2>$null
    if ($revList) {
      $objects = (& git rev-list --objects --all) 2>$null
      foreach ($line in $objects) {
        if (-not $line) { continue }
        $parts = $line -split ' ', 2
        if ($parts.Count -eq 2) {
          $path = $parts[1]
          $name = [IO.Path]::GetFileName($path)
          if ($sensitiveFilenames -contains $name) {
            Add-Finding 'git-history' $path 1 'Sensitive filename in history' $name
          }
        }
      }

      foreach ($entry in $patterns) {
        $args = @('grep', '-nI', '-E', $entry.Pattern)
        $args += $revList
        & git @args 2>$null | ForEach-Object {
          $output = $_.ToString()
          if (-not $output) { return }
          $firstColon = $output.IndexOf(':')
          if ($firstColon -lt 0) { return }
          $secondColon = $output.IndexOf(':', $firstColon + 1)
          if ($secondColon -lt 0) { return }
          $pathPart = $output.Substring(0, $firstColon)
          $linePart = $output.Substring($firstColon + 1, $secondColon - $firstColon - 1)
          $sample = $output.Substring($secondColon + 1)
          if ($sample.Length -gt 120) { $sample = $sample.Substring(0, 120) }
          $lineNum = 1
          [void][int]::TryParse($linePart, [ref]$lineNum)
          Add-Finding 'git-history' $pathPart $lineNum $entry.Name $sample
        }
      }
    }
  }

  return $findings
}

Require-Command git
Require-Command gh

Write-Host "Checking GitHub authentication..."
Invoke-External gh @('auth', 'status')

if (Test-Command node) {
  Write-Host "Running secret scan with Node helper..."
  Invoke-External node @('.\\scripts\\scan-secrets.mjs')
} else {
  Write-Host "Node not found. Running built-in PowerShell secret scan instead..."
  $findings = Get-SecretFindings
  if ($findings.Count -gt 0) {
    Write-Host 'Potential secrets found:' -ForegroundColor Red
    foreach ($f in $findings) {
      Write-Host ("- [{0}] {1}:{2} :: {3} :: {4}" -f $f.Source, $f.Path, $f.Line, $f.Rule, $f.Sample)
    }
    throw 'Secret scan failed. Fix findings before publishing.'
  }
  Write-Host 'No likely secrets found in working tree or reachable git history.'
}

if (Test-Command node) {
  Write-Host "Running extension validation with Node helper..."
  Invoke-External node @('.\\scripts\\validate-extension.mjs')
} else {
  Write-Host "Node not found. Running built-in PowerShell validation instead..."
  Validate-ExtensionBasic
  Write-Host 'Extension validation passed.'
}

if (-not (Test-Path .git)) {
  Write-Host "Initializing git repository..."
  Invoke-External git @('init')
}

Invoke-External git @('checkout', '-B', $DefaultBranch)

Write-Host "Staging files..."
Invoke-External git @('add', '.')

$hasChanges = $true
& git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  $hasChanges = $false
}

if ($hasChanges) {
  try {
    Invoke-External git @('commit', '-m', 'Initialize public repository with docs, CI, and safety checks')
  } catch {
    $nameConfigured = $true
    $emailConfigured = $true

    & git config user.name *> $null
    if ($LASTEXITCODE -ne 0) { $nameConfigured = $false }

    & git config user.email *> $null
    if ($LASTEXITCODE -ne 0) { $emailConfigured = $false }

    if (-not $nameConfigured -or -not $emailConfigured) {
      throw 'Git commit failed because user.name and/or user.email are not configured. Run: git config --global user.name "Your Name" and git config --global user.email "you@example.com"'
    }

    throw
  }
}

$repoFull = "$Owner/$Repo"

Write-Host "Checking whether repository $repoFull already exists..."
$repoExists = $true
& gh repo view $repoFull *> $null
if ($LASTEXITCODE -ne 0) {
  $repoExists = $false
}

if (-not $repoExists) {
  Write-Host "Creating public repository $repoFull ..."
  Invoke-External gh @('repo', 'create', $repoFull, '--public', '--source', '.', '--remote', 'origin', '--push')
} else {
  Write-Host "Repository already exists. Ensuring origin and pushing..."
  $remoteExists = $true
  & git remote get-url origin *> $null
  if ($LASTEXITCODE -ne 0) {
    $remoteExists = $false
  }

  if (-not $remoteExists) {
    Invoke-External git @('remote', 'add', 'origin', "https://github.com/$repoFull.git")
  }

  Invoke-External git @('push', '-u', 'origin', $DefaultBranch)
}

Write-Host "Applying branch protection to $DefaultBranch ..."
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
  required_conversation_resolution = $false
  lock_branch = $false
  allow_fork_syncing = $false
}

$tempJson = Join-Path $env:TEMP "selection-search-extension-branch-protection.json"
$bodyObject | ConvertTo-Json -Depth 10 | Set-Content -Path $tempJson -Encoding UTF8

try {
  Invoke-External gh @(
    'api',
    '--method', 'PUT',
    '-H', 'Accept: application/vnd.github+json',
    '-H', 'X-GitHub-Api-Version: 2022-11-28',
    "/repos/$repoFull/branches/$DefaultBranch/protection",
    '--input', $tempJson
  )
} finally {
  if (Test-Path $tempJson) {
    Remove-Item $tempJson -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Done. Repository URL: https://github.com/$repoFull"
