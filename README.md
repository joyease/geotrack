# GeoTrack Pro - Field Check-in & Supervisor Map App

A modern cross-platform application designed for field agents and supervisors.
- **Android App**: Kotlin + Jetpack Compose (Material 3) + Google Location Fused API + Firebase Auth & Firestore + Leaflet WebView.
- **Web App**: React 19 + TypeScript + Tailwind CSS + Leaflet.js + Firebase SDK.

---

## 🚀 Firebase Configuration

- **Project ID**: `geotrack-8e9b4`
- **Android Package**: `com.hh.geotrack`
- **Android App ID**: `1:133122521568:android:51d7db5ef2979686995385`
- **Web App ID**: `1:133122521568:web:536e3fd092a052f3995385`

---

## 🛠️ Android Studio Project Setup

1. Clone this repository:
   ```bash
   git clone <YOUR_GITHUB_REPO_URL>
   cd <REPO_NAME>
   ```
2. For Android build:
   - Copy `google-services.json` into the `app/` folder.
   - Package name: `com.hh.geotrack`
   - Open the project in Android Studio (Ladybug / Iguana or newer).
   - Sync Gradle & Run on device or emulator.

---

## 🌐 Web App Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Build for production
npm run build
```

---

## 🔒 Cloud Firestore Collection Schema

### Collection: `checkins`
| Field | Type | Description |
|---|---|---|
| `userId` | string | Unique UID of the field agent |
| `userEmail` | string | Email address of the user |
| `tripCode` | string | Inspection / Trip Identifier |
| `location` | GeoPoint | GeoPoint(latitude, longitude) |
| `timestamp` | ServerTimestamp | Realtime server timestamp |
| `accuracy` | number | GPS accuracy in meters |
| `addressHint`| string | Readable location note |
| `deviceModel`| string | Device or platform identifier |
