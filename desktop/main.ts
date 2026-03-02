import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { SerialHandler } from './serialHandler';
import { FlashHandler } from './flashHandler';
import { BuildHandler } from './buildHandler';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
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

    // Load frontend
    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
    }

    win.once('ready-to-show', () => win.show());

    // Wire serial data → renderer
    serialHandler.onData(data => {
        win.webContents.send('serial:data', Array.from(data));
    });

    // Wire build output → renderer
    buildHandler.onOutput(line => {
        win.webContents.send('build:output', line);
    });
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('serial:list', () => serialHandler.listPorts());
ipcMain.handle('serial:connect', (_, port: string, baud: number) => serialHandler.connect(port, baud));
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
