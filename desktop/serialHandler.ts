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
                autoOpen: false
            });

            this.port.open(async err => {
                if (err) return reject(err);

                try {
                    // CRITICAL for K210 boards
                    await new Promise<void>((res, rej) =>
                        this.port!.set({ dtr: false, rts: false }, e => e ? rej(e) : res())
                    );

                    await new Promise(r => setTimeout(r, 100));

                    await new Promise<void>((res, rej) =>
                        this.port!.set({ dtr: true, rts: false }, e => e ? rej(e) : res())
                    );

                    await new Promise(r => setTimeout(r, 2000));
                } catch (e) {
                    console.warn("Signal control failed:", e);
                }

                this.port!.on('data', (data: Buffer) => {
                    this.callbacks.forEach(cb => cb(data));
                });

                resolve();
            });
        });
    }

    async disconnect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.port?.isOpen) { resolve(); return; }
            this.port.close(err => { if (err) reject(err); else resolve(); });
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
}
