// ─── WebSerial Service ────────────────────────────────────────────────────────
// Implements SerialBridge using the browser Web Serial API.

import type { SerialBridge, SerialDataCallback, PortInfo } from './serialBridge';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export class WebSerialService implements SerialBridge {
    private port: SerialPort | null = null;
    private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
    private callbacks: Set<SerialDataCallback> = new Set();
    private _reading = false;
    private decoder = new TextDecoder(); // streaming-safe decoder

    get isConnected(): boolean {
        return this.port !== null && this._reading;
    }

    async listPorts(): Promise<PortInfo[]> {
        if (!('serial' in navigator)) return [];
        const ports = await navigator.serial.getPorts();
        return ports.map((p, i) => ({
            path: `WebSerial-${i}`,
            manufacturer: String(p.getInfo().usbVendorId ?? ''),
            vendorId: String(p.getInfo().usbVendorId ?? ''),
            productId: String(p.getInfo().usbProductId ?? ''),
        }));
    }

    async connect(_port: string, baud: number): Promise<void> {
        if (!('serial' in navigator)) {
            throw new Error('WebSerial not supported in this browser');
        }

        this.port = await navigator.serial.requestPort();

        await this.port.open({
            baudRate: baud,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });

        this.writer = this.port.writable!.getWriter();

        this._reading = true;
        this._readLoop(); // background resilient loop

        console.log('[WebSerial] Connected');
    }

    async disconnect(): Promise<void> {
        this._reading = false;

        try { this.writer?.releaseLock(); } catch {}
        try { await this.port?.close(); } catch {}

        this.writer = null;
        this.port = null;

        console.log('[WebSerial] Disconnected');
    }

    async write(data: Uint8Array): Promise<void> {
        if (!this.writer) throw new Error('Not connected');
        await this.writer.write(data);
    }

    /**
     * Upload and run Python script via MicroPython REPL (line-by-line).
     */
    async uploadScript(code: string): Promise<void> {
        const enc = new TextEncoder();

        // Interrupt running script (CTRL+C × 3)
        for (let i = 0; i < 3; i++) {
            await this.write(new Uint8Array([0x03]));
            await sleep(500);
        }

        const lines = code.split('\n');

        for (const line of lines) {
            const trimmed = line.trimEnd();

            if (trimmed.startsWith('#!') || trimmed.startsWith('# -*- coding')) continue;

            await this.write(enc.encode(trimmed + '\r\n'));
            await sleep(100);
        }

        console.log('[WebSerial] Script uploaded');
    }

    onData(cb: SerialDataCallback): void {
        this.callbacks.add(cb);
    }

    offData(cb: SerialDataCallback): void {
        this.callbacks.delete(cb);
    }

    /**
     * Robust read loop — automatically recreates reader on error.
     */
    private async _readLoop(): Promise<void> {
        console.log('[WebSerial] _readLoop started');

        while (this._reading && this.port?.readable) {
            const reader = this.port.readable.getReader();

            try {
                while (true) {
                    const { value, done } = await reader.read();

                    if (done) {
                        console.log('[WebSerial] Stream closed');
                        break;
                    }

                    if (value && value.length > 0) {
                        const text = this.decoder.decode(value, { stream: true });

                        if (text.length > 0) {
                            this.callbacks.forEach(cb =>
                                cb(new TextEncoder().encode(text))
                            );
                        }
                    }
                }
            } catch (err) {
                console.warn('[WebSerial] Read error — recovering:', err);
            } finally {
                reader.releaseLock();
            }

            await sleep(100);
        }

        console.log('[WebSerial] _readLoop exited');
    }
}