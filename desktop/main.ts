import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { SerialHandler } from './serialHandler';
import { FlashHandler } from './flashHandler';
import { BuildHandler } from './buildHandler';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// ✅ Single instance — remove the duplicate `handler`
const serialHandler = new SerialHandler();
const flashHandler = new FlashHandler();
const buildHandler = new BuildHandler();

function createWindow(): void {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#0d0f14',
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
        show: false,
    });

    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
    }

    win.once('ready-to-show', () => win.show());

    // ✅ Register once here — serialHandler.ts will call this cb on every
    //    data chunk after the port is open, regardless of when connect() fires.
    serialHandler.onData(data => {
        console.log('[MAIN-TX] Sending to renderer, bytes:', data.length);
        if (win.isDestroyed()) return;
        win.webContents.send('serial:data', Array.from(data));
    });

    buildHandler.onOutput(line => {
        if (win.isDestroyed()) return;
        win.webContents.send('build:output', line);
    });
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('serial:list', () => serialHandler.listPorts());

// ✅ Just connect — no second onData registration here
ipcMain.handle('serial:connect', async (_, port: string, baud: number) => {
    await serialHandler.connect(port, baud);
});

ipcMain.handle('serial:disconnect', () => serialHandler.disconnect());
ipcMain.handle('serial:write', (_, data: number[]) => serialHandler.write(Buffer.from(data)));

ipcMain.handle('flash:start', (_, firmwareUrl: string, port: string) => flashHandler.start(firmwareUrl, port));
ipcMain.handle('build:run', (_, projectPath: string) => buildHandler.run(projectPath));

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});