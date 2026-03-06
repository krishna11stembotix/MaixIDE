// ─── WebSerial Service ────────────────────────────────────────────────────────
// Implements SerialBridge using the browser Web Serial API.

import type { SerialBridge, SerialDataCallback, PortInfo } from './serialBridge';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function shouldDropLine(line: string): boolean {
    const t = line.trim();
    if (t === '') return true;
    // Structured camera/histogram data — never drop
    if (t.startsWith('##')) return false;
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
    if (/^\d+\.\d+-\d+-g[0-9a-f]{7}/.test(t)) return true;
    return false;
}

function stripReplPrefixes(line: string): string {
    let prev = '';
    let s = line;
    while (s !== prev) {
        prev = s;
        s = s
            .replace(/^>+/, '')
            .replace(/^OK/, '')
            .replace(/^\s+/, '');
    }
    return s;
}

export function cleanAnsi(raw: string): string {
    return raw
        .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')
        .replace(/\x1B[A-Za-z]/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export class LineBuffer {
    private _buf = '';

    push(chunk: string): string[] {
        this._buf += cleanAnsi(chunk);

        const parts = this._buf.split('\n');
        this._buf = parts.pop() ?? '';

        const results: string[] = [];
        for (const part of parts) {
            const line = part.replace(/\r$/, '');
            if (!shouldDropLine(line)) {
                const cleaned = stripReplPrefixes(line);
                if (cleaned.trim().length > 0) results.push(cleaned);
            }
        }
        return results;
    }
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
            productId: String(p.getInfo().usbProductId ?? '')
        }));
    }

    async connect(_port: string, baud: number): Promise<void> {

        if (!('serial' in navigator)) {
            throw new Error('WebSerial not supported');
        }

        this.port = await navigator.serial.requestPort();

        await this.port.open({
            baudRate: baud,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });

        this.writer = this.port.writable!.getWriter();

        try {
            await this.port.setSignals({
                dataTerminalReady: false,
                requestToSend: false
            });

            console.log('[WebSerial] Signals set: DTR=false RTS=false');

        } catch (e) {
            console.warn('[WebSerial] setSignals not supported:', e);
        }

        await sleep(4000);

        console.log('[WebSerial] Board boot wait complete — ready');

        this._reading = true;
        this._readLoop();
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

        const hex = Array.from(data)
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ');

        console.log(`[WebSerial] TX (${data.length}B): ${hex}`);

        await this.writer.write(data);
    }

    async uploadScript(code: string): Promise<void> {

        const enc = new TextEncoder();

        console.log('[WebSerial] === Starting upload (Raw REPL) ===');

        // Interrupt running program
        for (let i = 0; i < 3; i++) {
            await this.write(new Uint8Array([0x03])); // CTRL+C
            await sleep(80);
        }

        // Enter Raw REPL
        await this.write(new Uint8Array([0x01])); // CTRL+A
        await sleep(120);

        // Ensure script ends with newline
        if (!code.endsWith("\n")) {
            code += "\n";
        }

        const encoded = enc.encode(code);

        // Send script
        await this.write(encoded);

        await sleep(50);

        // Execute script
        await this.write(new Uint8Array([0x04])); // CTRL+D
        await sleep(200);

        // Return to friendly REPL
        await this.write(new Uint8Array([0x02])); // CTRL+B

        console.log('[WebSerial] === Raw REPL execution complete ===');
    }
    onData(cb: SerialDataCallback): void {
        this.callbacks.add(cb);
    }

    offData(cb: SerialDataCallback): void {
        this.callbacks.delete(cb);
    }

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

                        console.log('[RX RAW]', text);

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