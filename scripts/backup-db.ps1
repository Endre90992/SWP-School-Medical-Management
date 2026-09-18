$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

$candidates = @(
    (Join-Path $repoRoot "Backend\SchoolMedicalManagement\School-Medical-Management.API\bin\Debug\net8.0\data"),
    (Join-Path $repoRoot "Backend\SchoolMedicalManagement\School-Medical-Management.API\bin\Release\net8.0\data"),
    (Join-Path $repoRoot "Backend\SchoolMedicalManagement\School-Medical-Management.API\data"),
    (Join-Path $repoRoot "data")
)

$dataDir = $candidates | Where-Object {
    Test-Path (Join-Path $_ "eduhealth-local-tw.db")
} | Select-Object -First 1

if (-not $dataDir) {
    throw "找不到 EduHealth Local TW 資料庫。請確認程式至少已啟動過一次。"
}

$db = Join-Path $dataDir "eduhealth-local-tw.db"
$wal = "$db-wal"
$shm = "$db-shm"

# EduHealth 使用 SQLite WAL。程式執行中直接只複製 .db 可能漏掉尚在 WAL 的交易。
# 為避免產生表面可開啟、實際缺資料的備份，偵測到 WAL 時直接停止。
if ((Test-Path $wal) -or (Test-Path $shm)) {
    throw "偵測到 SQLite WAL/SHM 檔案。請先完全關閉 EduHealth Local TW，再執行備份。"
}

$backupDir = Join-Path $repoRoot "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dest = Join-Path $backupDir "eduhealth-local-tw-$timestamp.db"
Copy-Item $db $dest -Force

$sourceLength = (Get-Item $db).Length
$backupLength = (Get-Item $dest).Length
if ($sourceLength -ne $backupLength) {
    Remove-Item $dest -Force -ErrorAction SilentlyContinue
    throw "備份檔大小驗證失敗，已移除不完整備份。"
}

Write-Host "備份完成：$dest"
Write-Host "檔案大小：$backupLength bytes"
