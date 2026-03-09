import { SerialPort } from 'serialport';

type DataCallback = (data: Buffer) => void;

export class SerialHandler {
    private port: SerialPort | null = null;
    private callbacks: DataCallback[] = [];

    async listPorts(): Promise<{ path: string; manufacturer?: string }[]> {
        const list = await SerialPort.list();
        return list.map(p => ({ path: p.path, manufacturer: p.manufacturer }));
    }

    async connect(portPath: string, baud: number): Promise<void> {
        if (!portPath) throw new Error('No serial port selected.');
        if (this.port?.isOpen) await this.disconnect();

        return new Promise((resolve, reject) => {
            this.port = new SerialPort({
                path: portPath,
                baudRate: baud,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                rtscts: false,
                xon: false,
                xoff: false,
                xany: false,
                // ✅ let us wire listeners before the port starts receiving
                autoOpen: false,
            });

            this.port.on('data', (buf: Buffer) => {
                console.log('[MAIN-RX] RAW BYTES:', buf.length, buf.toString('hex'));
                console.log('[MAIN-RX] AS TEXT:', JSON.stringify(buf.toString('utf8').slice(0, 120)));
                this.callbacks.forEach(cb => cb(buf));
            });

            this.port.on('error', err => {
                console.error('[SERIAL ERROR]', err);
                reject(err);
            });

            this.port.open((err) => {
                if (err) return reject(err);
                console.log('[SERIAL] Port opened:', portPath);

                // ✅ Set DTR+RTS high — required by CH340 to enable data flow back to host
                this.port!.set({ dtr: true, rts: true }, (setErr) => {
                    if (setErr) console.warn('[SERIAL] set() error:', setErr);
                    else console.log('[SERIAL] DTR+RTS set high');

                    setTimeout(() => {
                        this.port!.write(Buffer.from([0x03]));
                        console.log('[SERIAL] Board ready');
                        resolve();
                    }, 200);
                });
            });
        });
    }
    async disconnect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.port?.isOpen) { resolve(); return; }
            this.port.close(err => {
                if (err) reject(err);
                else resolve();
            });
            this.port = null;
        });
    }

    async write(data: Buffer): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.port?.isOpen) return reject(new Error('Port not open'));

            this.port.write(data, err => {
                if (err) return reject(err);

                this.port!.drain(err2 => {
                    if (err2) reject(err2);
                    else resolve();
                });
            });
        });
    }

    onData(cb: DataCallback): void {
        this.callbacks.push(cb);
    }

    // ✅ ADD: cleanup method so IPC layer can unsubscribe on disconnect
    offData(cb: DataCallback): void {
        this.callbacks = this.callbacks.filter(c => c !== cb);
    }
}