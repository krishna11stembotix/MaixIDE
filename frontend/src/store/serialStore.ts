import { create } from 'zustand';

export interface SerialEntry {
    id: string;
    timestamp: number;
    text: string;
    kind: 'stdout' | 'stderr' | 'system';
}

interface SerialState {
    entries: SerialEntry[];
    paused: boolean;
    maxLines: number;

    append: (text: string, kind?: SerialEntry['kind']) => void;
    clear: () => void;
    setPaused: (v: boolean) => void;
}

let _id = 0;

export const useSerialStore = create<SerialState>((set, get) => ({
    entries: [],
    paused: false,
    maxLines: 2000,

    append: (text, kind = 'stdout') => {
        if (get().paused) return;
        const entry: SerialEntry = { id: String(++_id), timestamp: Date.now(), text, kind };
        set(s => {
            const entries = [...s.entries, entry];
            return { entries: entries.length > s.maxLines ? entries.slice(-s.maxLines) : entries };
        });
    },

    clear: () => set({ entries: [] }),
    setPaused: (v) => set({ paused: v }),
}));
