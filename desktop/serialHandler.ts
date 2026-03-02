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
        if (!portPath) throw new Error('No serial port selected. Pick a port in the Device panel first.');
        if (this.port?.isOpen) await this.disconnect();
        return new Promise((resolve, reject) => {
            this.port = new SerialPort({ path: portPath, baudRate: baud }, err => {
                if (err) return reject(err);
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
            this.port.write(data, err => { if (err) reject(err); else resolve(); });
        });
    }

    onData(cb: DataCallback): void {
        this.callbacks.push(cb);
    }
}
