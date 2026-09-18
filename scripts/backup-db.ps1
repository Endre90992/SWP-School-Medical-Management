$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $repoRoot "Backend\SchoolMedicalManagement\School-Medical-Management.API\bin\Debug\net8.0\data"
if (-not (Test-Path $dataDir)) {
    $dataDir = Join-Path $repoRoot "Backend\SchoolMedicalManagement\School-Medical-Management.API\data"
}

$db = Join-Path $dataDir "eduhealth-local-tw.db"
if (-not (Test-Path $db)) {
    throw "找不到資料庫：$db。請先啟動 EduHealth Local TW。"
}

$backupDir = Join-Path $repoRoot "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dest = Join-Path $backupDir "eduhealth-local-tw-$timestamp.db"
Copy-Item $db $dest -Force

Write-Host "備份完成：$dest"
