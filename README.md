# JPCS HUB

**A Web-Based Portal and Cross-Platform Mobile Application (Android, iOS, and HarmonyOS) with Real-Time Messenger and Video Call for Membership Records and Operations Management of JPCS–PTC**

Capstone project · Institute of Information and Computing Technology · Pateros Technological College

| Part | Folder | Built with | Who uses it |
|---|---|---|---|
| Web portal | `web/` | React + Vite, Firebase | Admin/Faculty Adviser, Officers, Treasurer, Auditor |
| Mobile app | `mobile/` | React Native (Expo), Firebase, WebRTC | Students and Officers (Messenger + Video Call) |
| Database | `firestore.rules` | Cloud Firestore + Firebase Authentication | Shared by the portal and the app |

## Features

**Web portal**
- Role-based login: Admin (Faculty Adviser), Officer, Treasurer, Auditor
- Dashboard with totals, recent announcements and upcoming events
- Membership Records: add, view, search, edit, delete; create a student's mobile app login
- User Accounts: add staff accounts, assign roles, deactivate/activate, online status
- Announcements and Events management
- Documents: upload, categorize, search and open organizational files
- Financial Management (Event Fund and Liquidation): Treasurer records the event budget and each expense with official receipt and proof-of-purchase photo; totals and remaining budget are computed automatically; Treasurer submits for review; Auditor approves or returns with remarks; printable liquidation report
- Reports: membership summary, members by year level, event liquidation summary (printable)
- Messenger: real-time chat with students, active status, read indicators, video call

**Mobile app (Android, iOS, HarmonyOS)**
- Login for students (username/student no. created by officers) and officers
- Real-time Messenger with JPCS Officers, active status and read indicators
- Video call (both directions: student ↔ officer, app ↔ web portal), mute, camera on/off, switch camera, speaker
- Officers can read and reply to all student conversations and start a chat or call

## Database (Cloud Firestore)

Follows the ERD in the capstone document:

| ERD entity | Collection |
|---|---|
| USER_ACCOUNT | `users/{uid}` (role: admin, officer, treasurer, auditor, student) |
| MEMBER | `members/{id}` |
| ANNOUNCEMENT | `announcements/{id}` |
| EVENT | `events/{id}` |
| DOCUMENT | `documents/{id}` |
| MESSAGE | `conversations/{studentUid}/messages/{id}` |
| CALL_SESSION | `calls/{id}` (+ `callerCandidates`, `calleeCandidates` for WebRTC) |
| LIQUIDATION | `liquidations/{eventId}` |
| EXPENSE_ITEM | `expense_items/{id}` |

Also `presence/{uid}` (active status) and `settings/bootstrap` (first-time setup).

## Live setup

- Firebase project: **JPCS HUB** (`jpcs-hub-e1240`), Spark (free) plan, region `asia-southeast1` (Singapore)
- Authentication: Email/Password enabled · Firestore: created, `firestore.rules` published
- The Firebase config is already filled in `web/src/firebaseConfig.js` and `mobile/src/firebaseConfig.ts`
- **First step:** open the web portal → *Create the admin account* (only works once)

## 1. Firebase setup (reference — already done for jpcs-hub-e1240)

1. In the [Firebase console](https://console.firebase.google.com), create a project (e.g. `jpcs-hub`).
2. **Authentication** → Get started → enable **Email/Password**.
3. **Firestore Database** → Create database (production mode, region `asia-southeast1`).
4. **Project settings** → Your apps → add a **Web app**. Copy the config values.
5. Paste the config into **both**:
   - `web/src/firebaseConfig.js`
   - `mobile/src/firebaseConfig.ts`
   (or use the `VITE_FIREBASE_*` / `EXPO_PUBLIC_FIREBASE_*` environment variables).
6. Put the project ID in `.firebaserc`, then publish the security rules:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore
   ```
   (Or paste `firestore.rules` into Firestore → Rules → Publish in the console.)
7. Open the web portal, click **Create the admin account** on the login page, and create the Admin/Faculty Adviser. Then add the officers, Treasurer and Auditor in **User Accounts**, and members in **Membership Records**.

### File uploads (receipts, proofs, documents)
Firebase Storage needs the Blaze (pay-as-you-go) plan. To stay free, create a free [Cloudinary](https://cloudinary.com) account, add an **unsigned upload preset**, and set
`VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` (in `web/.env`). If these are not set, uploads go to Firebase Storage (deploy `storage.rules` too).

### Video calls between different networks
Calls use Google's public STUN servers, which work on most Wi-Fi/mobile networks. Some school or mobile networks need a TURN relay; set `VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` (web) and the matching `EXPO_PUBLIC_TURN_*` (mobile), e.g. from a free metered.ca Open Relay account.

## 2. Run the web portal

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # production files in web/dist
firebase deploy --only hosting   # publish to https://jpcs-hub-e1240.web.app
```

Every push to `main` also publishes the portal to **GitHub Pages** (workflow *Publish web portal to GitHub Pages*).

**Windows app (.exe):** download `JPCS-HUB-Setup-x.y.z.exe` from the repository's **Releases** page (built by the *Build Windows app (.exe)* workflow from `desktop/`). It opens the live portal in its own window, with a desktop and Start-menu shortcut. Windows SmartScreen may warn because it is not code-signed: click *More info → Run anyway*.

**Laptop app (browser install):** open the portal in Chrome or Edge and click **Install app** (on the login page, or the install icon in the address bar). JPCS HUB then opens in its own window with a desktop/Start-menu icon. On phones, *Add to Home screen* does the same (handy for iPhone users).

**Demo mode:** run with `VITE_DEMO=1 npm run dev` (or with no API key) and the portal runs with sample data saved in the browser, so every screen can be tried right away. Demo logins: `admin/admin123`, `officer/officer123`, `treasurer/treasurer123`, `auditor/auditor123`, student `2026-001/student123`. Open two browser tabs (officer + student) to try the messenger and video call.

## 3. Run and build the mobile app

The app uses WebRTC (native code), so it runs as a development build, not in Expo Go.

```bash
cd mobile
npm install
npx expo run:android     # Android phone/emulator (needs Android Studio)
npx expo run:ios         # iPhone/simulator (needs a Mac with Xcode)
```

**Android APK without Android Studio:** every push to `main` that changes `mobile/` runs the GitHub Action **Build Android APK**. Download the APK from the repository's **Releases** page (or the workflow run's artifacts) and install it on the phone.

**HarmonyOS:** HarmonyOS 2–4 phones (Huawei) install the same Android APK directly. HarmonyOS NEXT (5.x) phones run it through Huawei's Android-app compatibility layer (e.g. the "Zhuoyitong"/DroiTong container) or need a separate ArkTS build.

**iOS:** build with `npx expo run:ios` on a Mac, or with Expo EAS Build (`npx eas-cli build -p ios`) using an Apple Developer account to install on iPhones.

## Project structure

```
web/                 React web portal
  src/pages/         Dashboard, Members, Accounts, Announcements, Events,
                     Documents, Finance, Reports, Messenger, Login, Setup
  src/data/          Firebase + demo backends, WebRTC call logic
desktop/             Windows app (Electron) that opens the live portal
mobile/              Expo React Native app
  src/screens/       Login, Conversations (officers), Chat
  src/CallLayer.tsx  Incoming call and video call screens
  src/call.ts        WebRTC call logic (same signaling as the web)
firestore.rules      Role-based security rules
.github/workflows/   Android APK build, web deploy
```
