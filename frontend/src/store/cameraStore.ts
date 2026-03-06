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
    // Try the rich format first
    if (raw.includes('|')) {
        const parts: Record<string, string> = {};
        for (const seg of raw.split('|')) {
            const idx = seg.indexOf('=');
            if (idx >= 0) parts[seg.slice(0, idx)] = seg.slice(idx + 1);
        }
        const bins = (parts['bins'] ?? '').split(',').map(Number).filter(n => !isNaN(n));
        return {
            bins,
            mean: parseFloat(parts['mean'] ?? '0'),
            median: parseFloat(parts['median'] ?? '0'),
            mode: parseFloat(parts['mode'] ?? '0'),
            stdev: parseFloat(parts['stdev'] ?? '0'),
            min: parseFloat(parts['min'] ?? '0'),
            max: parseFloat(parts['max'] ?? '0'),
            lq: parseFloat(parts['lq'] ?? '0'),
            uq: parseFloat(parts['uq'] ?? '0'),
        };
    }

    // Simple: just a list of bin values
    const bins = raw.split(',').map(Number).filter(n => !isNaN(n));
    const sorted = [...bins].sort((a, b) => a - b);
    const sum = bins.reduce((a, b) => a + b, 0);
    const mean = sum / (bins.length || 1);
    const variance = bins.reduce((a, b) => a + (b - mean) ** 2, 0) / (bins.length || 1);
    return {
        bins,
        mean,
        median: sorted[Math.floor(sorted.length / 2)] ?? 0,
        mode: sorted[0] ?? 0,
        stdev: Math.sqrt(variance),
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
        lq: sorted[Math.floor(sorted.length / 4)] ?? 0,
        uq: sorted[Math.floor((3 * sorted.length) / 4)] ?? 0,
    };
}
