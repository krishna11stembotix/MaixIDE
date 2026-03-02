import { create } from 'zustand';
import { SerialBridge, isElectron, hasWebSerial, decodeText } from '../services/serialBridge';
import { WebSerialService } from '../services/webSerialService';
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

            // ── Wire incoming serial bytes directly into the serial store ──────
            // Show ALL output from the device — no filtering.
            const { append } = useSerialStore.getState();
            bridge.onData((data: Uint8Array) => {
                const raw = new TextDecoder().decode(data);
                // Strip ANSI escape codes but keep all printable chars
                const text = raw.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');
                if (text.length > 0) append(text, 'stdout');
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
