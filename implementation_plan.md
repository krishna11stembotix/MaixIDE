# MaixIDE — Unified Development Platform

## Overview

MaixIDE is an original, production-grade IDE for Maix hardware boards (MaixCAM, M5Stick-M, etc.) that lets developers write MaixPy (Python) and MaixCDK (C/C++) applications, upload scripts, monitor serial output, manage device files, flash firmware, and deploy AI models. It is modular: a single shared React frontend powers both a browser-based IDE and an Electron desktop application.

---

## Recommended Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | **React 18 + Vite** | Fast HMR, mature ecosystem, works in both browser & Electron |
| Code Editor | **Monaco Editor** (`@monaco-editor/react`) | Same engine as VS Code, supports Python & C/C++ |
| Package Manager | **pnpm workspaces** | Monorepo management across frontend / desktop / backend |
| Desktop Shell | **Electron 30** | Cross-platform wrapper; uses `contextBridge` for safe IPC |
| Serial (Browser) | **Web Serial API** (native browser) | Zero-dependency, works in Chrome/Edge |
| Serial (Desktop) | **`serialport` npm package** | Full serial access from Node.js/Electron main process |
| Firmware Flash | **`esptool-js`** + `maixflash` CLI wrapper | Compatible with Maix firmware format |
| Backend | **Fastify 4** + **Socket.IO** | Fast, type-safe, real-time WebSocket support |
| Language | **TypeScript** throughout | Type safety, IDE completions |
| Styling | **CSS Modules + CSS custom properties** | No framework lock-in, fine-grained control |
| State | **Zustand** | Lightweight global state, no boilerplate |
| Testing | **Vitest** (unit) + **Playwright** (e2e) | Native Vite-compatible test tools |

---

## Project Structure

```
/MaixIDE (monorepo root)
├── package.json              ← pnpm workspace root
├── pnpm-workspace.yaml
│
├── /frontend                 ← Shared React IDE (browser + Electron)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Editor/       ← Monaco wrapper
│   │   │   ├── FileExplorer/ ← Virtual + device filesystem tree
│   │   │   ├── SerialMonitor/← Incoming log panel
│   │   │   ├── Toolbar/      ← Run/Stop/Upload/Flash controls
│   │   │   ├── DeviceManager/← Connection & port selector
│   │   │   ├── StatusBar/    ← Connected/disconnected indicator
│   │   │   └── FirmwarePanel/← Firmware download & flash UI
│   │   ├── services/
│   │   │   ├── serialBridge.ts   ← Abstract serial interface
│   │   │   ├── webSerialService.ts  ← WebSerial implementation
│   │   │   ├── electronSerialService.ts ← IPC-based implementation
│   │   │   └── backendService.ts  ← REST + WS client
│   │   ├── store/            ← Zustand state slices
│   │   ├── hooks/            ← Custom React hooks
│   │   ├── utils/
│   │   │   └── maixProtocol.ts ← Maix built-in comm protocol helpers
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   └── package.json
│
├── /desktop                  ← Electron wrapper
│   ├── main.ts               ← Electron main process
│   ├── preload.ts            ← contextBridge IPC definitions
│   ├── serialHandler.ts      ← serialport-based serial management
│   ├── flashHandler.ts       ← Firmware flashing logic
│   ├── buildHandler.ts       ← MaixCDK CMake build integration
│   └── package.json
│
├── /backend                  ← Optional cloud backend
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── projects.ts
│   │   │   └── devices.ts
│   │   ├── ws/
│   │   │   └── deviceRelay.ts ← WebSocket relay for remote device
│   │   └── server.ts
│   └── package.json
│
└── /device-tools             ← CLI utilities
    ├── flash.sh / flash.ps1  ← Firmware flash wrappers
    ├── maixpy-upload.py      ← MaixPy script upload helper
    └── README.md
```

---

## Proposed Changes

### Component 1 — Monorepo Foundation

#### [NEW] `package.json` (root)
- pnpm workspace config listing `frontend`, `desktop`, `backend`
- Shared dev scripts: `dev:web`, `dev:desktop`, `dev:backend`

#### [NEW] `pnpm-workspace.yaml`
- Declares `./frontend`, `./desktop`, `./backend` as workspace packages

---

### Component 2 — Frontend (Shared Core IDE)

#### [NEW] `frontend/src/components/Editor/Editor.tsx`
- Monaco Editor wrapper with Python & C/C++ language support
- Configurable language mode based on active file extension
- Dark theme (`vs-dark`) default

#### [NEW] `frontend/src/components/FileExplorer/FileExplorer.tsx`
- Tree view component for local files and device filesystem
- Supports create, rename, delete, upload to device
- Uses virtual file system interface for portability

#### [NEW] `frontend/src/components/SerialMonitor/SerialMonitor.tsx`
- Auto-scrolling terminal-style log panel
- Timestamps each message
- Supports clear and pause/resume
- ANSI color code rendering

#### [NEW] `frontend/src/components/Toolbar/Toolbar.tsx`
- Run Script / Stop / Upload File / Flash Firmware buttons
- Contextual enable/disable based on connection state

#### [NEW] `frontend/src/components/DeviceManager/DeviceManager.tsx`
- Port selector dropdown (populated via serial bridge)
- Baud rate selector (default 115200)
- Connect / Disconnect button

#### [NEW] `frontend/src/components/StatusBar/StatusBar.tsx`
- Bottom bar showing: connection state, device name, port, baud rate, active language mode

#### [NEW] `frontend/src/components/FirmwarePanel/FirmwarePanel.tsx`
- List of available firmware versions (fetched from Maix releases)
- Download + Flash buttons (Flash enabled only in desktop mode)

#### [NEW] `frontend/src/services/serialBridge.ts`
- Abstract interface (TypeScript interface) implemented by both WebSerial and Electron IPC
  ```ts
  interface SerialBridge {
    connect(port: string, baud: number): Promise<void>
    disconnect(): Promise<void>
    write(data: Uint8Array): Promise<void>
    onData(cb: (data: Uint8Array) => void): void
    listPorts(): Promise<PortInfo[]>
  }
  ```

#### [NEW] `frontend/src/services/webSerialService.ts`
- Implements `SerialBridge` using the browser Web Serial API
- Handles reader/writer loop in a `ReadableStream`

#### [NEW] `frontend/src/services/electronSerialService.ts`
- Implements `SerialBridge` using `window.electronBridge.serial.*` IPC calls
- Injected by Electron's `contextBridge`

#### [NEW] `frontend/src/utils/maixProtocol.ts`
- Helpers for Maix built-in communication protocol
- Encode script-run command, parse response frames
- Implement character-based protocol as default; binary opt-in

#### [NEW] `frontend/src/store/` (Zustand slices)
- `deviceStore.ts` — port, baud, connected state
- `editorStore.ts` — open files, active file, dirty state
- `serialStore.ts` — log buffer
- `uiStore.ts` — panel visibility, theme

---

### Component 3 — Browser IDE

> No additional files needed beyond the frontend services above. The browser IDE **is** the frontend loaded directly in a browser, using `webSerialService.ts`.

Noteworthy browser-specific behaviors:
- On load, detect if `navigator.serial` is available; if not, show a banner: "WebSerial requires Chrome/Edge 89+"
- Flash Firmware button hidden / disabled in browser mode
- File system operations limited to browser memory (IndexedDB) or device serial upload only

---

### Component 4 — Desktop IDE (Electron)

#### [NEW] `desktop/main.ts`
- Creates `BrowserWindow` loading the Vite dev server or built `frontend/dist`
- Registers IPC handlers from `serialHandler`, `flashHandler`, `buildHandler`

#### [NEW] `desktop/preload.ts`
- Exposes `window.electronBridge` via `contextBridge`:
  - `serial.connect`, `serial.disconnect`, `serial.write`, `serial.onData`, `serial.listPorts`
  - `flash.start`, `flash.status`
  - `build.run`, `build.output`

#### [NEW] `desktop/serialHandler.ts`
- Uses `serialport` library
- Manages open/close, read stream, write
- Sends incoming data to renderer via `webContents.send`

#### [NEW] `desktop/flashHandler.ts`
- Wraps `esptool-js` or spawns `kflash` CLI
- Reports progress percentage to renderer

#### [NEW] `desktop/buildHandler.ts`
- Spawns `maixcdk build` as a child process
- Streams stdout/stderr to renderer's build output panel

---

### Component 5 — Backend

#### [NEW] `backend/src/server.ts`
- Fastify server with Socket.IO integration
- CORS configured for both local dev and production

#### [NEW] `backend/src/routes/auth.ts`
- Basic JWT auth (register / login / refresh)

#### [NEW] `backend/src/routes/projects.ts`
- CRUD for cloud-synced projects

#### [NEW] `backend/src/ws/deviceRelay.ts`
- Relays serial data between a remote device agent and the browser client over WebSocket

---

### Component 6 — Device Tools

#### [NEW] `device-tools/maixpy-upload.py`
- Python script: open serial port, upload MaixPy `.py` file using Maix built-in protocol
- CLI: `python maixpy-upload.py --port COM3 --file main.py`

#### [NEW] `device-tools/flash.ps1` / `flash.sh`
- Thin wrappers around `kflash_gui` or `esptool` CLI

---

## Serial Communication Protocol Design

### Connection Parameters
| Parameter | Value |
|---|---|
| Baud rate | 115200 (default, configurable) |
| Data bits | 8 |
| Stop bits | 1 |
| Parity | None |
| Flow control | None |

### MaixPy Script Upload Flow
```
IDE                    Maix Firmware
 │── CTRL+C ──────────────────────▷  (interrupt any running script)
 │── "\x04" (soft reset) ─────────▷  (enter REPL mode)
 │── "exec(open('/tmp/__ide__.py').read())\r\n" ──▷
 │   [or use Maix built-in protocol frame to upload file]
 │◁──── ">>> " ───────────────────  (REPL prompt confirms ready)
 │── raw script text ─────────────▷
 │◁──── stdout logs ──────────────  (stream back to serial monitor)
```

### Maix Built-in Protocol Frame (binary mode)
```
[0xAA] [0x55] [CMD:1B] [LEN:2B LE] [DATA:LEN B] [CRC8:1B]
```
- `CMD 0x01` = Upload file
- `CMD 0x02` = Run script
- `CMD 0x03` = List files
- `CMD 0x10` = Stream log data (device → IDE)

### MaixCDK Build Flow
```
User → "Build" button → Electron IPC → spawn `maixcdk build`
→ stdout stream → build output panel
→ On success → binary artifact available for upload/flash
```

---

## API Integration Plan

### MaixPy API Usage
- Use `maix.comm.CommBase` and `maix.protocol` Python modules on device side
- IDE sends commands using Maix built-in comm protocol over UART
- Device responses parsed by `maixProtocol.ts`

### MaixCDK Build Integration
- Desktop IDE spawns `maixcdk menuconfig` (via Electron) for project config
- `maixcdk build` compiles; output `.elf`/`.bin` can be flashed via `esptool`

### Firmware API
- Firmware releases fetched from: `https://api.github.com/repos/sipeed/MaixPy/releases`
- Download `.img` file, flash using `kflash` CLI (wrapped in `flashHandler.ts`)

---

## MVP Timeline

| Phase | Duration | Deliverable |
|---|---|---|
| **Phase 1** – Core Frontend | 2 weeks | React app with Monaco, file explorer, serial monitor UI, WebSerial connect |
| **Phase 2** – MaixPy Browser IDE | 1 week | Script upload + run, live serial log |
| **Phase 3** – Electron Desktop | 2 weeks | Full serial via `serialport`, flash support, filesystem |
| **Phase 4** – MaixCDK Integration | 2 weeks | Build panel, CMake output, deploy binary |
| **Phase 5** – Backend & Cloud | 2 weeks | Auth, project sync, WebSocket relay |
| **Phase 6** – AI Model Deploy | 1 week | Upload `.mud`/`.onnx` model files to device |

**Total MVP estimate: ~10 weeks**

---

## Verification Plan

### Automated Tests

#### Unit Tests (Vitest)
```bash
cd frontend && pnpm test
```
- Tests `maixProtocol.ts` frame encode/decode
- Tests Zustand store state transitions
- Tests serial bridge mock implementations

#### E2E Tests (Playwright)
```bash
cd frontend && pnpm test:e2e
```
- Test: Open IDE → Monaco editor is visible
- Test: Connect button triggers WebSerial request (mocked)
- Test: Serial monitor receives and displays text
- Test: File explorer shows file tree

### Manual Verification

#### Browser IDE
1. `cd frontend && pnpm dev` → open `http://localhost:5173` in Chrome
2. Connect MaixCAM via USB
3. Click "Connect Device" → select port in browser dialog
4. Paste a MaixPy script into editor
5. Click "Run" → verify script executes on device
6. Observe serial output in monitor panel

#### Electron Desktop IDE
1. `cd desktop && pnpm dev` → Electron window opens
2. Repeat steps 2–6 above
3. Click "Flash Firmware" → select `.img` file → verify flash progress bar
4. Use file explorer to browse device filesystem

#### Build Output
```bash
cd frontend && pnpm build        # verify no TypeScript errors
cd desktop && pnpm build         # verify Electron main process compiles
cd backend && pnpm build         # verify Fastify server compiles
```

---

> [!IMPORTANT]
> The browser IDE uses **WebSerial API**, which is only available in **Chromium-based browsers** (Chrome 89+, Edge 89+). Firefox and Safari are not supported for device communication.

> [!NOTE]
> Phase 1 will be built first to verify the shared frontend core works in both browser and Electron contexts before advancing.
