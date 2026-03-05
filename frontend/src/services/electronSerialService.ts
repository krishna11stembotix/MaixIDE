// ─── Electron Serial Service ──────────────────────────────────────────────────
// Implements SerialBridge using window.electronBridge IPC exposed by preload.ts.
// This is a thin adapter; real serial work happens in the Electron main process.

import { SerialBridge, SerialDataCallback, PortInfo } from './serialBridge';
import { LineBuffer } from './webSerialService';
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
    private lineBuffer = new LineBuffer();
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
            const text = new TextDecoder().decode(new Uint8Array(raw));
            const lines = this.lineBuffer.push(text);

            if (lines.length > 0) {
                const encoded = new TextEncoder().encode(lines.join('\n') + '\n');
                this.callbacks.forEach(cb => cb(encoded));
            }
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
    async uploadScript(code: string): Promise<void> {
        const enc = new TextEncoder();
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

        // Step 1: Interrupt any running script
        await this.write(new Uint8Array([0x03]));
        await sleep(150);
        await this.write(new Uint8Array([0x03]));
        await sleep(200);

        // Step 2: Enter Raw REPL (CTRL+A)
        await this.write(new Uint8Array([0x01]));
        await sleep(100);

        // Ensure script ends with newline
        if (!code.endsWith('\n')) code += '\n';

        // Step 3: Send full script in 256-byte chunks
        const CHUNK = 256;
        const encoded = enc.encode(code);
        for (let off = 0; off < encoded.length; off += CHUNK) {
            await this.write(encoded.slice(off, off + CHUNK));
            if (off + CHUNK < encoded.length) await sleep(20);
        }
        await sleep(50);

        // Step 4: Execute (CTRL+D)
        await this.write(new Uint8Array([0x04]));
        await sleep(100);

        // Step 5: Exit Raw REPL back to friendly REPL (CTRL+B)
        await this.write(new Uint8Array([0x02]));
        await sleep(50);

        console.log('[ElectronSerial] === Raw REPL upload complete ===');
    }

    onData(cb: SerialDataCallback): void {
        this.callbacks.add(cb);
    }

    offData(cb: SerialDataCallback): void {
        this.callbacks.delete(cb);
    }
}


