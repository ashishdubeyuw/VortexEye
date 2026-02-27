# VortexEye 🌀👁️

AI-powered indoor and outdoor navigation, installable as a **Progressive Web App (PWA)** on Android and iOS — no app store required.

---

## Features

- Outdoor GPS Navigation
- Indoor Visual Positioning
- Voice-activated Destination Routing
- Real-time Obstacle Detection
- Automatic POI Scanning
- Offline support via Service Worker

---

## Running the Server

```bash
python server.py
```

The server starts on `https://0.0.0.0:8080` and prints a QR code for easy access from mobile devices.

---

## Installing on Android

1. Open **Chrome** on your Android device.
2. Navigate to the app URL (scan the QR code from the server).
3. Tap the **three-dot menu (⋮)** in the top-right corner.
4. Select **"Add to Home screen"** (or **"Install app"**).
5. Confirm by tapping **"Add"** / **"Install"**.
6. VortexEye will appear on your home screen like a native app.

> **Note:** Android Chrome will show an install banner automatically after a short visit.

---

## Installing on iOS (Safari)

1. Open **Safari** on your iPhone or iPad.
2. Navigate to the app URL (scan the QR code from the server).
3. Tap the **Share button** (rectangle with an arrow pointing up) at the bottom of the screen.
4. Scroll down and tap **"Add to Home Screen"**.
5. Optionally edit the name, then tap **"Add"**.
6. VortexEye will appear on your home screen like a native app.

> **Note:** On iOS, PWA installation only works through **Safari** — Chrome and other iOS browsers do not support "Add to Home Screen" for PWAs.

---

## Platform Notes

| Feature | Android (Chrome) | iOS (Safari) |
|---|---|---|
| Install to home screen | ✅ | ✅ |
| Offline support | ✅ | ✅ |
| Background sync | ✅ | Limited |
| Push notifications | ✅ | iOS 16.4+ |
| Camera access | ✅ | ✅ |
| GPS / Geolocation | ✅ | ✅ |
| Bluetooth (BLE) | ✅ | ❌ (not supported in Safari) |
| Device orientation | ✅ | Requires user permission prompt |
| Speech synthesis (TTS) | ✅ | ✅ |

---

## Version

**1.1.0** — See `index.html` for full feature list.
