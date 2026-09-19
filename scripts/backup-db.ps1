$ErrorActionPreference = "Stop"

$root = Join-Path $env:LOCALAPPDATA "EduHealth-Local-TW"
$dataDir = Join-Path $root "data"
$db = Join-Path $dataDir "eduhealth-local-tw.db"

if (-not (Test-Path $db)) {
    throw "找不到 EduHealth Local TW 資料庫：$db"
}

$wal = "$db-wal"
$shm = "$db-shm"
if ((Test-Path $wal) -or (Test-Path $shm)) {
    throw "偵測到 SQLite WAL/SHM。請先完全關閉 EduHealth Local TW，再執行備份。"
}

$backupDir = Join-Path $root "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dest = Join-Path $backupDir "eduhealth-local-tw-$timestamp.db"
Copy-Item $db $dest -Force

if ((Get-Item $db).Length -ne (Get-Item $dest).Length) {
    Remove-Item $dest -Force -ErrorAction SilentlyContinue
    throw "備份檔大小驗證失敗，已移除不完整備份。"
}

Write-Host "備份完成：$dest"
