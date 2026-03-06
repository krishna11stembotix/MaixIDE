import { create } from 'zustand';
import { SerialBridge, isElectron, hasWebSerial } from '../services/serialBridge';
import { WebSerialService } from '../services/webSerialService';
import { ElectronSerialService } from '../services/electronSerialService';
import { useSerialStore } from './serialStore';
import { useCameraStore, parseHistLine, type HistogramData } from './cameraStore';

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

            // ── Wire incoming serial bytes into serial + camera stores ─────────
            // _readLoop in WebSerialService already assembles full lines and
            // strips REPL noise. Here we decode the chunk, split on '\n', and
            // route ## camera lines vs regular text lines.
            const { append } = useSerialStore.getState();

            // Per-frame histogram accumulator
            let pendingR: HistogramData | null = null;
            let pendingG: HistogramData | null = null;

            bridge.onData((data: Uint8Array) => {
                const chunk = new TextDecoder().decode(data);
                // The data is already clean lines separated by '\n'
                const lines = chunk.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.length > 0);

                const textLines: string[] = [];

                for (const line of lines) {
                    if (line.startsWith('##FRAME:')) {
                        const b64 = line.slice('##FRAME:'.length).trim();
                        console.log('[Camera] Got FRAME, b64 length:', b64.length);
                        if (b64.length > 0) useCameraStore.getState().setFrame(b64);
                    } else if (line.startsWith('##HIST_R:')) {
                        pendingR = parseHistLine(line.slice('##HIST_R:'.length));
                    } else if (line.startsWith('##HIST_G:')) {
                        pendingG = parseHistLine(line.slice('##HIST_G:'.length));
                    } else if (line.startsWith('##HIST_B:')) {
                        const b = parseHistLine(line.slice('##HIST_B:'.length));
                        if (pendingR && pendingG) {
                            useCameraStore.getState().setHistogram(pendingR, pendingG, b);
                            pendingR = null; pendingG = null;
                        }
                    } else if (line.startsWith('##FPS:')) {
                        const fps = parseFloat(line.slice('##FPS:'.length));
                        console.log('[Camera] FPS:', fps);
                        useCameraStore.getState().setFps(fps);
                    } else if (line.startsWith('##RES:')) {
                        const [w, h] = line.slice('##RES:'.length).split('x').map(Number);
                        if (w && h) useCameraStore.getState().setResolution(w, h);
                    } else {
                        textLines.push(line);
                    }
                }

                if (textLines.length > 0) {
                    append(textLines.join('\n'), 'stdout');
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
