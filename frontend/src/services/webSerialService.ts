// ─── WebSerial Service ────────────────────────────────────────────────────────
// Implements SerialBridge using the browser Web Serial API.

import type { SerialBridge, SerialDataCallback, PortInfo } from './serialBridge';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Strip ANSI escape sequences and raw REPL protocol bytes from device output
 * so only printable text reaches the Serial Monitor.
 */
export function cleanDeviceOutput(raw: string): string {
    return raw
        .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')   // ANSI CSI sequences
        .replace(/\x1B[A-Za-z]/g, '')              // ANSI 2-char sequences
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // bare control chars (keep \r \n \t)
}

export class WebSerialService implements SerialBridge {
    private port: SerialPort | null = null;
    private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
    private callbacks: Set<SerialDataCallback> = new Set();
    private _reading = false;

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
        await this.port.open({ baudRate: baud, dataBits: 8, stopBits: 1, parity: 'none' });

        this.writer = this.port.writable!.getWriter();

        // ── Signal control (critical for K210/CH340 boards) ───────────────────
        // When WebSerial opens the port, the OS may assert RTS=true.
        // On MaixDock / MaixDuino K210 boards: RTS=true during boot → ISP
        // bootloader mode (not MicroPython). We must de-assert RTS so the board
        // boots normally. DTR may also trigger a reset via the capacitor circuit.
        try {
            // RTS=false → K210 samples BOOT pin LOW → runs SPI flash (MicroPython)
            // DTR=false → don't hold board in reset
            await this.port.setSignals({ dataTerminalReady: false, requestToSend: false });
            console.log('[WebSerial] Signals set: DTR=false RTS=false');
            await sleep(100);
            // Pulse DTR to trigger clean reset (like pressing the RST button)
            await this.port.setSignals({ dataTerminalReady: true, requestToSend: false });
            console.log('[WebSerial] Signals set: DTR=true RTS=false (board resets)');
        } catch (e) {
            console.warn('[WebSerial] setSignals not supported:', e);
        }

        this._reading = true;
        this._readLoop();

        // Wait for board to boot MicroPython after reset
        await sleep(2000);
        console.log('[WebSerial] Board boot wait complete — ready');
    }

    async disconnect(): Promise<void> {
        this._reading = false;
        try { this.writer?.releaseLock(); } catch { }
        try { await this.port?.close(); } catch { }
        this.writer = null;
        this.port = null;
        console.log('[WebSerial] Disconnected');
    }

    async write(data: Uint8Array): Promise<void> {
        if (!this.writer) throw new Error('Not connected');
        const hex = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`[WebSerial] TX (${data.length}B): ${hex}`);
        await this.writer.write(data);
    }

    /**
     * Upload and run a MaixPy / MicroPython script.
     *
     * Problem: The board runs a user main.py on boot that captures the serial
     * port and ignores plain ASCII/REPL commands.
     *
     * Solution — "Soft reset + boot interrupt":
     *   1. Send CTRL+D  → soft-reset the board (reboots into fresh MicroPython)
     *   2. Wait briefly, then flood CTRL+C to interrupt boot BEFORE main.py runs
     *   3. Board is now at a clean ">>>" prompt with no user script running
     *   4. Send our script lines one-by-one; output flows back through readLoop
     *
     * This is the technique used by Thonny IDE and mpremote for boards
     * where main.py blocks the REPL.
     */
    async uploadScript(code: string): Promise<void> {
        const enc = new TextEncoder();

        console.log('[WebSerial] === Starting upload ===');

        // ── Step 1: Interrupt any running script (NO CTRL+D — that can trigger
        // ISP bootloader on some firmware versions) ──────────────────────────
        console.log('[WebSerial] Step 1: interrupt with CTRL+C');
        await this.write(new Uint8Array([0x03]));
        await sleep(300);
        await this.write(new Uint8Array([0x03]));
        await sleep(500);

        // ── Step 3: Send script line by line ────────────────────────────────
        console.log('[WebSerial] Step 3: sending script lines');
        const lines = code.split('\n').map(l => l.trimEnd());
        let prevEndsBlock = false;

        for (const line of lines) {
            const trimmed = line.trim();

            // Skip blank lines and comments
            if (trimmed === '' || trimmed.startsWith('#')) continue;

            const isIndented = line.length > 0 && (line[0] === ' ' || line[0] === '\t');

            // When we leave an indented block, send a blank line to commit it
            if (prevEndsBlock && !isIndented) {
                await this.write(enc.encode('\r\n'));
                await sleep(100);
            }

            await this.write(enc.encode(line + '\r\n'));
            await sleep(80); // give REPL time to process each line

            prevEndsBlock = isIndented || trimmed.endsWith(':');
        }

        // Commit any trailing indented block
        if (prevEndsBlock) {
            await this.write(enc.encode('\r\n'));
            await sleep(100);
        }

        // Wait to capture output
        await sleep(2000);
        console.log('[WebSerial] === Upload complete — check monitor for output ===');
    }

    onData(cb: SerialDataCallback): void {
        this.callbacks.add(cb);
    }

    offData(cb: SerialDataCallback): void {
        this.callbacks.delete(cb);
    }

    /**
     * Persistent read loop — runs in background for the lifetime of the connection.
     */
    private async _readLoop(): Promise<void> {
        console.log('[WebSerial] _readLoop started');
        const decoder = new TextDecoder();

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
                        const hex = Array.from(value)
                            .map(b => b.toString(16).padStart(2, '0'))
                            .join(' ');
                        console.log(`[WebSerial] RX (${value.length}B): ${hex}`);

                        const text = decoder.decode(value, { stream: true });
                        if (text.length > 0) {
                            const encoded = new TextEncoder().encode(text);
                            this.callbacks.forEach(cb => cb(encoded));
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
