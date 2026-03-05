// ─── WebSerial Service ────────────────────────────────────────────────────────
// Implements SerialBridge using the browser Web Serial API.

import type { SerialBridge, SerialDataCallback, PortInfo } from './serialBridge';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Returns true if this line is boot/REPL noise and should be suppressed.
 * Runs on a single complete line, so patterns match reliably even when
 * the device sends data in tiny fragments.
 */
function shouldDropLine(line: string): boolean {
    const t = line.trim();
    if (t === '') return true;
    if (t === 'OK') return true;
    if (t === '>') return true;
    if (/^>>>\s*$/.test(t)) return true;
    if (t.startsWith('[MAIXPY]') || t.startsWith('[MaixPy]')) return true;
    if (t.startsWith('MicroPython')) return true;
    if (t.startsWith('raw REPL')) return true;
    if (t.startsWith('Type "help()"')) return true;
    if (t.startsWith('Traceback (most recent call last)')) return true;
    if (/^\s*File ".+", line \d+/.test(t)) return true;
    if (t.startsWith('OSError:')) return true;
    if (t.startsWith('MemoryError:')) return true;
    if (t.startsWith('RuntimeError:')) return true;
    if (t.startsWith('ImportError:')) return true;
    if (t.startsWith('AttributeError:')) return true;
    // Bare firmware version strings like "6.2-89-gd8901fd22-dirty on 2026-..."
    if (/^\d+\.\d+-\d+-g[0-9a-f]{7}/.test(t)) return true;
    return false;
}

/**
 * Strip Raw REPL protocol tokens that may be prepended to real output.
 * e.g. ">OKHello world" → "Hello world"
 */
function stripReplPrefixes(line: string): string {
    // Repeatedly strip leading >, OK, >>> tokens until none remain
    let prev = '';
    let s = line;
    while (s !== prev) {
        prev = s;
        s = s
            .replace(/^>+/, '')           // leading > or >>>
            .replace(/^OK/, '')            // Raw REPL OK response
            .replace(/^\s+/, '');          // any whitespace left over
    }
    return s;
}

/**
 * Strip ANSI escape codes and control characters from a single chunk.
 * Full line-level filtering is handled by LineBuffer / shouldDropLine.
 */
export function cleanAnsi(raw: string): string {
    return raw
        .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')   // CSI sequences
        .replace(/\x1B[A-Za-z]/g, '')              // bare ESC sequences
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // control chars
}

/**
 * Accumulates raw text fragments and emits filtered complete lines.
 * Call push() with each incoming chunk; it returns an array of clean
 * lines ready to display (may be empty if no complete line yet).
 */
export class LineBuffer {
    private _buf = '';

    push(chunk: string): string[] {
        // Strip ANSI/control chars from incoming chunk first
        this._buf += cleanAnsi(chunk);

        const parts = this._buf.split('\n');
        // Last element is the incomplete line — keep it in the buffer
        this._buf = parts.pop() ?? '';

        const results: string[] = [];
        for (const part of parts) {
            const line = part.replace(/\r$/, ''); // strip trailing \r
            if (!shouldDropLine(line)) {
                const cleaned = stripReplPrefixes(line);
                if (cleaned.trim().length > 0) results.push(cleaned);
            }
        }
        return results;
    }

    /** Flush any remaining partial line (e.g. on disconnect). */
    flush(): string[] {
        if (!this._buf.trim()) { this._buf = ''; return []; }
        const line = cleanAnsi(this._buf).replace(/\r$/, '');
        this._buf = '';
        if (shouldDropLine(line)) return [];
        const cleaned = stripReplPrefixes(line);
        return cleaned.trim().length > 0 ? [cleaned] : [];
    }
}

/**
 * @deprecated Use LineBuffer instead. Kept for backward-compat with deviceStore.
 */
export function cleanDeviceOutput(raw: string): string {
    const lb = new LineBuffer();
    const lines = lb.push(raw + '\n');
    return lines.join('\n');
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

        console.log('[WebSerial] === Starting upload (Raw REPL test) ===');

        // Step 1: Interrupt any running script
        await this.write(new Uint8Array([0x03]));
        await sleep(50);
        await this.write(new Uint8Array([0x03]));
        await sleep(80);

        // Step 2: Enter Raw REPL
        await this.write(new Uint8Array([0x01])); // CTRL+A
        await sleep(50);

        // Ensure script ends with newline
        if (!code.endsWith("\n")) {
            code += "\n";
        }

        // Step 3: Send full script in chunks for reliability
        const CHUNK = 512;
        const encoded = enc.encode(code);
        for (let off = 0; off < encoded.length; off += CHUNK) {
            await this.write(encoded.slice(off, off + CHUNK));
            if (off + CHUNK < encoded.length) await sleep(20);
        }
        await sleep(50);

        // Step 4: Execute script
        await this.write(new Uint8Array([0x04])); // CTRL+D
        await sleep(50);

        // Step 5: Exit Raw REPL back to friendly REPL
        await this.write(new Uint8Array([0x02])); // CTRL+B

        console.log('[WebSerial] === Raw REPL execution complete ===');
    }


    onData(cb: SerialDataCallback): void {
        this.callbacks.add(cb);
    }

    offData(cb: SerialDataCallback): void {
        this.callbacks.delete(cb);
    }

    /**
     * Persistent read loop — runs in background for the lifetime of the connection.
     * Uses a LineBuffer so filtering happens on complete lines, not raw fragments.
     */
    private async _readLoop(): Promise<void> {
        console.log('[WebSerial] _readLoop started');
        const decoder = new TextDecoder();
        const lineBuf = new LineBuffer();

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
                        const text = decoder.decode(value, { stream: true });
                        const lines = lineBuf.push(text);

                        if (lines.length > 0) {
                            const out = lines.join('\n') + '\n';
                            const encoded = new TextEncoder().encode(out);
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
