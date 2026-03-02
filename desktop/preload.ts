import { contextBridge, ipcRenderer } from 'electron';

// Expose a safe bridge to the renderer process.
// The renderer imports `electronSerialService.ts` which calls these.
contextBridge.exposeInMainWorld('electronBridge', {
    serial: {
        listPorts: () => ipcRenderer.invoke('serial:list'),
        connect: (port: string, baud: number) => ipcRenderer.invoke('serial:connect', port, baud),
        disconnect: () => ipcRenderer.invoke('serial:disconnect'),
        write: (data: number[]) => ipcRenderer.invoke('serial:write', data),
        onData: (cb: (data: number[]) => void) => {
            ipcRenderer.on('serial:data', (_evt, data: number[]) => cb(data));
        },
        offData: () => {
            ipcRenderer.removeAllListeners('serial:data');
        },
    },

    flash: {
        start: (url: string, port: string) => ipcRenderer.invoke('flash:start', url, port),
        onProgress: (cb: (pct: number) => void) => {
            ipcRenderer.on('flash:progress', (_evt, pct: number) => cb(pct));
        },
    },

    build: {
        run: (projectPath: string) => ipcRenderer.invoke('build:run', projectPath),
        onOutput: (cb: (line: string) => void) => {
            ipcRenderer.on('build:output', (_evt, line: string) => cb(line));
        },
    },
});
