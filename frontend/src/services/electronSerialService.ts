// ─── Electron Serial Service ──────────────────────────────────────────────────
// Implements SerialBridge using window.electronBridge IPC exposed by preload.ts.
// This is a thin adapter; real serial work happens in the Electron main process.

import { SerialBridge, SerialDataCallback, PortInfo } from './serialBridge';

// Shape exposed by Electron's contextBridge preset
interface ElectronBridge {
    serial: {
        listPorts: () => Promise<PortInfo[]>;
        connect: (port: string, baud: number) => Promise<void>;
        disconnect: () => Promise<void>;
        write: (data: number[]) => Promise<void>;
        onData: (cb: (data: number[]) => void) => void;
        offData: () => void;
    };
}

function bridge(): ElectronBridge {
    return (window as unknown as { electronBridge: ElectronBridge }).electronBridge;
}

export class ElectronSerialService implements SerialBridge {
    private callbacks: Set<SerialDataCallback> = new Set();
    private _connected = false;

    get isConnected(): boolean {
        return this._connected;
    }

    async listPorts(): Promise<PortInfo[]> {
        return bridge().serial.listPorts();
    }

    async connect(port: string, baud: number): Promise<void> {
        await bridge().serial.connect(port, baud);
        this._connected = true;
        // Wire up data from main process to our callbacks
        bridge().serial.onData((raw: number[]) => {
            const data = new Uint8Array(raw);
            this.callbacks.forEach(cb => cb(data));
        });
    }

    async disconnect(): Promise<void> {
        await bridge().serial.disconnect();
        bridge().serial.offData();
        this._connected = false;
    }

    async write(data: Uint8Array): Promise<void> {
        await bridge().serial.write(Array.from(data));
    }

    onData(cb: SerialDataCallback): void {
        this.callbacks.add(cb);
    }

    offData(cb: SerialDataCallback): void {
        this.callbacks.delete(cb);
    }
}
