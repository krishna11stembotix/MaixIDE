import { create } from 'zustand';
import { SerialBridge, isElectron, hasWebSerial } from '../services/serialBridge';
import { WebSerialService, LineBuffer } from '../services/webSerialService';
import { ElectronSerialService } from '../services/electronSerialService';
import { useSerialStore } from './serialStore';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface DeviceState {
    status: ConnectionStatus;
    portPath: string;
    baudRate: number;
    errorMsg: string | null;
    serialBridge: SerialBridge | null;

    // Actions
    setBaud: (baud: number) => void;
    setPort: (port: string) => void;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    clearError: () => void;
}

function makeBridge(): SerialBridge {
    if (isElectron()) return new ElectronSerialService();
    return new WebSerialService();
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
    status: 'disconnected',
    portPath: '',
    baudRate: 115200,
    errorMsg: null,
    serialBridge: null,

    setBaud: (baud) => set({ baudRate: baud }),
    setPort: (port) => set({ portPath: port }),
    clearError: () => set({ errorMsg: null }),

    connect: async () => {
        if (!hasWebSerial() && !isElectron()) {
            set({ status: 'error', errorMsg: 'WebSerial is not supported in this browser. Use Chrome/Edge 89+.' });
            return;
        }
        set({ status: 'connecting', errorMsg: null });
        try {
            const bridge = makeBridge();
            await bridge.connect(get().portPath, get().baudRate);

            // ── Wire incoming serial bytes into the serial store ───────────────
            // LineBuffer accumulates fragments, splits on \n, and filters
            // noise line-by-line. Works for both Electron (raw bytes) and
            // WebSerial (already-clean lines pass through unchanged).
            const { append } = useSerialStore.getState();
            const lineBuf = new LineBuffer();
            bridge.onData((data: Uint8Array) => {
                const chunk = new TextDecoder().decode(data);
                const lines = lineBuf.push(chunk);
                if (lines.length > 0) {
                    append(lines.join('\n'), 'stdout');
                }
            });

            set({ status: 'connected', serialBridge: bridge });
        } catch (err) {
            set({ status: 'error', errorMsg: String(err) });
        }
    },

    disconnect: async () => {
        const { serialBridge } = get();
        if (serialBridge) {
            try { await serialBridge.disconnect(); } catch { /* ignore */ }
        }
        set({ status: 'disconnected', serialBridge: null });
        useSerialStore.getState().append('Disconnected.', 'system');
    },
}));
