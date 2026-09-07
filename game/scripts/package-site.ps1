$ErrorActionPreference = 'Stop'
# Native Windows fallback: official Bash and Node staging fail on this host.
# Mirror the worker archive contract; use a fresh staging directory without deleting files.
$taskProject = (Get-Location).Path
$taskOutput = [IO.Path]::GetFullPath((Join-Path $taskProject 'outputs'))
$taskStage = [IO.Path]::GetFullPath((Join-Path $taskOutput ('site-stage-' + [guid]::NewGuid().ToString('N'))))
$taskDist = [IO.Path]::GetFullPath((Join-Path $taskStage 'dist'))
if (-not $taskDist.StartsWith($taskOutput + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe packaging destination' }
foreach ($taskCheck in @($taskOutput,$taskStage,$taskDist)) {
  if ((Test-Path -LiteralPath $taskCheck) -and ((Get-Item -LiteralPath $taskCheck).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Packaging path cannot be a link' }
}
New-Item -ItemType Directory -Path $taskStage -Force | Out-Null
$taskSource = Join-Path $taskProject 'dist'
if (-not (Test-Path -LiteralPath (Join-Path $taskSource 'server/index.js'))) { throw 'Missing worker entrypoint' }
if (Get-ChildItem -LiteralPath $taskSource -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Build cannot contain links' }
Copy-Item -LiteralPath $taskSource -Destination $taskDist -Recurse
New-Item -ItemType Directory -Path (Join-Path $taskDist '.openai') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $taskProject '.openai/hosting.json') -Destination (Join-Path $taskDist '.openai/hosting.json')
$taskArchive = Join-Path $taskOutput 'gemtd-site.tar.gz'
tar -C $taskStage -czf $taskArchive dist
if ($LASTEXITCODE -ne 0) { throw 'Archive creation failed' }
$taskEntries = @(tar -tzf $taskArchive)
if ($LASTEXITCODE -ne 0 -or -not ($taskEntries -contains 'dist/.openai/hosting.json') -or -not ($taskEntries -contains 'dist/server/index.js')) { throw 'Archive validation failed' }
Get-Item -LiteralPath $taskArchive | Select-Object FullName,Length
