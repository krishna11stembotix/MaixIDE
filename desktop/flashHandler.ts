import { spawn } from 'child_process';
import path from 'path';

export class FlashHandler {
    async start(firmwareUrl: string, port: string): Promise<void> {
        // Download firmware then call kflash/esptool
        // This is a reference implementation; real usage requires kflash or esptool installed.
        return new Promise((resolve, reject) => {
            // Example: esptool.py --port COM3 write_flash 0x0 firmware.bin
            const child = spawn('esptool', ['--port', port, 'write_flash', '0x0', firmwareUrl], {
                shell: true,
            });
            child.on('close', code => {
                if (code === 0) resolve();
                else reject(new Error(`esptool exited with code ${code}`));
            });
            child.on('error', reject);
        });
    }
}
