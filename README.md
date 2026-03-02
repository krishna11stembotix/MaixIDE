# MaixIDE

> A unified, production-grade IDE for **Maix hardware boards** (MaixCAM, MaixCAM-Pro, K210-based).
> Write MaixPy (Python) and MaixCDK (C/C++) code, upload scripts, monitor serial output, manage files, and flash firmware — in the **browser** or as a **desktop app**.

![MaixIDE](https://img.shields.io/badge/Status-MVP%20Alpha-3ecfb2?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-informational?style=flat-square)
![Maix](https://img.shields.io/badge/Target-MaixCAM%20%7C%20MaixPy%20v4-2a9d8f?style=flat-square)

---

## ✨ Features

| Feature | Browser IDE | Desktop IDE |
|---|:---:|:---:|
| Python (MaixPy) editor | ✅ | ✅ |
| C/C++ (MaixCDK) editor | ✅ | ✅ |
| Serial connection (WebSerial) | ✅ (Chrome/Edge) | — |
| Serial connection (serialport) | — | ✅ |
| Script upload & run | ✅ | ✅ |
| Live serial monitor | ✅ | ✅ |
| Firmware flashing | ❌ | ✅ |
| MaixCDK build system | ❌ | ✅ |
| File explorer | ✅ | ✅ |
| Firmware release browser | ✅ | ✅ |

---

## 📁 Project Structure

```
MaixIDE/
├── frontend/          ← Shared React 18 + Vite + Monaco IDE (browser + Electron)
├── desktop/           ← Electron wrapper (serialport, firmware flash, CMake build)
├── backend/           ← Optional Fastify + Socket.IO cloud backend
└── device-tools/      ← Standalone CLI tools (Python upload script, flash wrappers)
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+ (`npm i -g pnpm`)

### Install dependencies

```bash
pnpm install
```

### Run the Browser IDE

```bash
pnpm dev:web
```
Open **Chrome or Edge** and navigate to `http://localhost:5173`.

> ⚠️ WebSerial only works in Chromium-based browsers. Firefox and Safari are not supported for device communication.

### Run the Desktop IDE (Electron)

```bash
# Terminal 1 – start the frontend dev server
pnpm dev:web

# Terminal 2 – start Electron (it loads localhost:5173)
pnpm dev:desktop
```

### Run the Backend

```bash
pnpm dev:backend
# Listening on http://localhost:3001
```

---

## 🔌 Device Communication

### Connection Parameters (MaixCAM default)

| Parameter | Value |
|---|---|
| Baud rate | 115200 |
| Data bits | 8 |
| Stop bits | 1 |
| Parity | None |

### Script Upload Protocol (REPL mode)

```
CTRL+C  → interrupt running script
CTRL+E  → enter paste mode
<code>  → paste script content
CTRL+D  → execute
```

### Standalone Upload CLI

```bash
# Upload and run a MaixPy script without the IDE
python device-tools/maixpy-upload.py --port COM3 --file main.py
```

---

## ⚡ Firmware Flashing (Desktop only)

Requires **esptool** installed and in PATH:

```bash
pip install esptool
```

The Firmware panel in the Desktop IDE fetches MaixPy releases from GitHub and flashes them using esptool automatically.

---

## 🔧 MaixCDK Build Integration (Desktop only)

Requires **MaixCDK** and its toolchain installed:

```bash
# Install MaixCDK (see https://github.com/sipeed/MaixCDK)
pip install maixcdk
```

Open a MaixCDK project folder in the IDE and click **Build** to run `maixcdk build` with live output streaming.

---

## 🏗 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Monaco Editor |
| State | Zustand |
| Desktop | Electron 31, serialport |
| Backend | Fastify 4, Socket.IO, JWT |
| Build | pnpm workspaces |

---

## 📋 MVP Roadmap

- [x] Phase 1 – Browser IDE (MaixPy editor, WebSerial, serial monitor)
- [x] Phase 2 – Desktop IDE (Electron + serialport + firmware flash)
- [ ] Phase 3 – MaixCDK C/C++ project build panel
- [ ] Phase 4 – AI model upload and deployment
- [ ] Phase 5 – Cloud project sync and remote device management

---

## 📄 License

MIT © STEMbotix
