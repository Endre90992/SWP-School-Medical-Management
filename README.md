# EduHealth Local TW

臺灣學校健康中心單機離線版，改造自原始專案 `30Sativa/SWP-School-Medical-Management`。

> 本專案設計目標是「單一健康中心 Windows 電腦、本機使用、不對外連線」。
> 原始專案目前未標示明確開源 LICENSE；本 fork 保留原始來源與作者資訊，正式散布或商用前請另行確認授權。

## 主要改進

- 介面與主要操作訊息改為繁體中文。
- 健康中心護理師導向的側邊欄與工作流程。
- 前後端固定綁定 `127.0.0.1`，拒絕非本機來源。
- 移除 Render、Vercel、Redis Cloud、Gmail SMTP 等外部服務依賴。
- 資料庫改為 SQLite：`data/eduhealth-local-tw.db`。
- 密碼由舊 SHA-256 升級為 BCrypt（舊資料登入成功後自動升級）。
- API 採全域「預設需要登入」策略，只有登入與健康檢查端點可匿名使用。
- 停用離線版 Email/OTP 密碼重設。
- 第一次啟動自動產生一次性護理師密碼，寫入 `data/初始登入資訊.txt`；首次改密碼後自動刪除。
- 移除公開 Blog HTML 注入路徑與外部網路依賴。
- 清理重複路由與大量越南文介面文字。

## 執行需求

- Windows 10/11
- .NET 8 SDK
- Node.js 18 以上

## 啟動後端

```powershell
cd Backend/SchoolMedicalManagement/School-Medical-Management.API
dotnet restore
dotnet run
```

後端僅監聽：

```text
http://127.0.0.1:5080
```

第一次啟動會在程式執行目錄的 `data` 資料夾建立：

```text
eduhealth-local-tw.db
初始登入資訊.txt
```

使用該檔案內的一次性帳密登入，系統會要求立即設定新密碼。

## 啟動前端

```powershell
cd Frontend
npm install
npm run dev
```

瀏覽器開啟：

```text
http://127.0.0.1:5173
```

## 備份

執行：

```powershell
.\scripts\backup-db.ps1
```

備份會存到 `backups`，檔名包含日期時間。建議每週再把備份複製到使用 BitLocker To Go 加密的 USB。

## 本機資安建議

1. Windows 健康中心帳號請設定強密碼。
2. 開啟 BitLocker 全碟加密。
3. 5 分鐘無操作自動鎖定 Windows。
4. 不要把 `data` 或 `backups` 放入 OneDrive、Google Drive、Dropbox 等同步資料夾。
5. 定期執行備份，並測試還原。
6. 學生真實健康資料僅應存放在受控的健康中心電腦。

## 開發分支

主要改造分支：

```text
feature/tw-local-health-center
```
