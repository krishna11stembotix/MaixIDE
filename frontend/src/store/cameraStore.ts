// ─── Camera Store ──────────────────────────────────────────────────────────
// Holds live camera state: frame image, RGB histogram, FPS, resolution.

import { create } from 'zustand';

export interface HistogramData {
    bins: number[];
    mean: number;
    median: number;
    mode: number;
    stdev: number;
    min: number;
    max: number;
    lq: number;
    uq: number;
}

interface CameraState {
    frameDataUrl: string | null;
    fps: number;
    histR: HistogramData | null;
    histG: HistogramData | null;
    histB: HistogramData | null;
    width: number;
    height: number;

    // Actions
    setFrame: (b64: string) => void;
    setHistogram: (r: HistogramData, g: HistogramData, b: HistogramData) => void;
    setFps: (fps: number) => void;
    setResolution: (w: number, h: number) => void;
    clear: () => void;
}

export const useCameraStore = create<CameraState>((set) => ({
    frameDataUrl: null,
    fps: 0,
    histR: null,
    histG: null,
    histB: null,
    width: 0,
    height: 0,

    setFrame: (b64) => set({ frameDataUrl: `data:image/jpeg;base64,${b64}` }),

    setHistogram: (r, g, b) => set({ histR: r, histG: g, histB: b }),

    setFps: (fps) => set({ fps }),

    setResolution: (w, h) => set({ width: w, height: h }),

    clear: () => set({
        frameDataUrl: null,
        fps: 0,
        histR: null,
        histG: null,
        histB: null,
        width: 0,
        height: 0,
    }),
}));

/**
 * Parse a histogram line sent from the board.
 * Format: "bins=v0,v1,...|mean=n|median=n|mode=n|stdev=n|min=n|max=n|lq=n|uq=n"
 * or simply comma-separated bin values (legacy/simple format).
 */
export function parseHistLine(raw: string): HistogramData {
    if (raw.includes('|')) {
        // Rich format from board: "v0,v1,...|mean=n|median=n|mode=n|stdev=n|min=n|max=n|lq=n|uq=n"
        // The FIRST segment (before any '|') is the raw bin CSV — it has no '=' key.
        const segments = raw.split('|');
        const kv: Record<string, string> = {};
        let binSeg = '';
        for (const seg of segments) {
            const idx = seg.indexOf('=');
            if (idx >= 0) {
                kv[seg.slice(0, idx)] = seg.slice(idx + 1);
            } else if (seg.trim().length > 0) {
                // First plain segment = bins CSV
                binSeg = seg;
            }
        }
        // bins may also come as kv['bins'] if the board uses that key
        const binStr = kv['bins'] ?? binSeg;
        const bins = binStr.split(',').map(Number).filter(n => !isNaN(n));
        return {
            bins,
            mean: parseFloat(kv['mean'] ?? '0'),
            median: parseFloat(kv['median'] ?? '0'),
            mode: parseFloat(kv['mode'] ?? '0'),
            stdev: parseFloat(kv['stdev'] ?? '0'),
            min: parseFloat(kv['min'] ?? '0'),
            max: parseFloat(kv['max'] ?? '0'),
            lq: parseFloat(kv['lq'] ?? '0'),
            uq: parseFloat(kv['uq'] ?? '0'),
        };
    }

    // Simple format: just comma-separated bin counts
    const bins = raw.split(',').map(Number).filter(n => !isNaN(n));
    const sorted = [...bins].sort((a, b) => a - b);
    const total = bins.reduce((a, b) => a + b, 0);
    const mean = total / (bins.length || 1);
    const variance = bins.reduce((s, b) => s + (b - mean) ** 2, 0) / (bins.length || 1);
    return {
        bins,
        mean,
        median: sorted[Math.floor(sorted.length / 2)] ?? 0,
        mode: sorted[sorted.length - 1] ?? 0,
        stdev: Math.sqrt(variance),
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
        lq: sorted[Math.floor(sorted.length / 4)] ?? 0,
        uq: sorted[Math.floor((3 * sorted.length) / 4)] ?? 0,
    };
}
