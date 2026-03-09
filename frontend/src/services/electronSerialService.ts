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
            // DIAGNOSTIC: log every raw chunk that arrives from the board via IPC
            console.log('[RX-RAW]', JSON.stringify(text.slice(0, 120)));
            const lines = this.lineBuffer.push(text);
            // DIAGNOSTIC: log what survives the LineBuffer filter
            if (lines.length > 0) console.log('[RX-LINES]', lines.map(l => l.slice(0, 80)));

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

        // Step 1: Interrupt any running script — send CTRL+C twice with generous
        // pauses so the K210 REPL task has time to process each interrupt.
        await this.write(new Uint8Array([0x03]));
        await sleep(300);
        await this.write(new Uint8Array([0x03]));
        await sleep(400);

        // Step 2: Enter Raw REPL (CTRL+A).
        // K210 MaixPy needs ~300 ms to fully switch into raw-REPL mode before
        // it can correctly buffer incoming code bytes.
        await this.write(new Uint8Array([0x01]));
        await sleep(300);

        // ── Inject MaixIDE camera streaming ───────────────────────────────────
        // Mirrors the exact same injection done by WebSerialService.uploadScript().
        // Without this, lcd.display() runs but never emits ##FRAME: / ##HIST lines,
        // so the FrameBuffer and Histogram panels stay blank on desktop.
        const PREAMBLE = `import lcd as __rl,ubinascii as __ui\n__sn=0\ndef __sd(img,*a,**k):\n global __sn;__rl.display(img,*a,**k);__sn+=1\n try:\n  if __sn%4==0:\n   __r=[0]*32;__g=[0]*32;__b=[0]*32\n   for __y in range(0,img.height(),10):\n    for __x in range(0,img.width(),10):\n     __p=img.get_pixel(__x,__y);__r[__p[0]>>3]+=1;__g[__p[1]>>3]+=1;__b[__p[2]>>3]+=1\n   print('##HIST_R:'+','.join(str(__v)for __v in __r))\n   print('##HIST_G:'+','.join(str(__v)for __v in __g))\n   print('##HIST_B:'+','.join(str(__v)for __v in __b))\n  img.compress(quality=35);print('##FRAME:'+__ui.b2a_base64(img).decode().strip())\n except:pass\n`;

        // Replace lcd.display( → __sd( in user code (handles spaces like "lcd.display (")
        const injectedCode = code.replace(/lcd\s*\.\s*display\s*\(/g, '__sd(');

        let fullCode = PREAMBLE + injectedCode;
        if (!fullCode.endsWith('\n')) fullCode += '\n';

        // Step 3: Send full script in 256-byte chunks
        const CHUNK = 256;
        const encoded = enc.encode(fullCode);
        for (let off = 0; off < encoded.length; off += CHUNK) {
            await this.write(encoded.slice(off, off + CHUNK));
            if (off + CHUNK < encoded.length) await sleep(20);
        }
        // Give the K210 REPL parser time to digest the last chunk before CTRL+D
        await sleep(200);

        // Step 4: Execute (CTRL+D)
        await this.write(new Uint8Array([0x04])); // execute
        await sleep(500);

        // exit raw repl so stdout streams normally
        console.log('[ElectronSerial] === Raw REPL upload complete ===');
    }

    onData(cb: SerialDataCallback): void {
        this.callbacks.add(cb);
    }

    offData(cb: SerialDataCallback): void {
        this.callbacks.delete(cb);
    }
}


