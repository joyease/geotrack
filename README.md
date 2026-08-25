# GeoTrack Pro - Android & Web 打卡定位系統

本專案已支援 **GitHub Actions 自動雲端編譯 Android APK** 以及 **Web 端** 與 **Android APK** 雙端同步寫入/讀取同一 Cloud Firestore 資料庫 (`geotrack-8e9b4`)。

---

## 📱 如何透過 GitHub 直接自動生成 APK 檔案？

您**不需要**在自己電腦安裝 Android Studio，直接將專案 Push 到 GitHub，GitHub 就會自動在雲端為您編譯並生成 APK 下載檔：

### 步驟 1：將專案推送到 GitHub
```bash
git add .
git commit -m "Add GitHub Actions APK Build Workflow and Android source"
git push origin main
```

### 步驟 2：到 GitHub 下載生成的 APK 檔案
1. 打開您的 GitHub Repository 頁面。
2. 點擊頂部的 **「Actions」** 分頁。
3. 您會看到正在執行或已完成的 **「🔨 Build GeoTrack Android APK」** 工作流程。
4. 點進該次執行紀錄，在最下方的 **「Artifacts」** 區塊即可點擊下載 **`GeoTrack-Debug-APK`** (內含可直接安裝於 Android 手機的 `app-debug.apk`)！

> 💡 **手動觸發編譯**：您也可以在 GitHub 的 **Actions** ➜ 點選左側 **Build Android APK** ➜ 點擊右側 **「Run workflow」** 隨時一鍵手動編譯最新 APK。

---

## 🚀 Firebase 專案連線資訊

- **Firebase 專案 ID**: `geotrack-8e9b4`
- **Android Package Name**: `com.hh.geotrack`
- **Firestore 集合名稱**: `checkins`
- **Web App 連線設定**: 已配置於 `src/services/firebase.ts`
- **Android 連線設定**: 已配置於 `android/app/google-services.json` 與 `google-services.json`

---

## 🔒 Cloud Firestore Collection Schema (`checkins`)

| 欄位名稱 (`Field`) | 類型 (`Type`) | 說明 (`Description`) |
|---|---|---|
| `userId` | string | 使用者 ID (如 `hermanntalk`) |
| `userEmail` | string | 使用者 Email |
| `tripCode` | string | 行程/巡檢代碼 (如 `TAIPEI`) |
| `location` | GeoPoint | `GeoPoint(latitude, longitude)` 經緯度座標 |
| `timestamp` | ServerTimestamp | 伺服器時間戳記 |
| `accuracy` | number | GPS 精度 (公尺) |
| `addressHint`| string | 地點或備註文字 |
| `deviceModel`| string | 裝置型號 (如 `Pixel 8 Pro (Android 15)`) |

---

## 🌐 Web 端本機開發與測試

```bash
# 1. 安裝相依套件
npm install

# 2. 啟動本機開發伺服器
npm run dev

# 3. 編譯靜態網頁檔案 (dist/)
npm run build
```
