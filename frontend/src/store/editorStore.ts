import { create } from 'zustand';

export type Language = 'python' | 'cpp';

export interface EditorFile {
    id: string;
    name: string;
    content: string;
    language: Language;
    dirty: boolean;
}

interface EditorState {
    files: EditorFile[];
    activeFileId: string | null;

    openFile: (file: EditorFile) => void;
    closeFile: (id: string) => void;
    updateContent: (id: string, content: string) => void;
    setActive: (id: string) => void;
    newFile: (name: string, language: Language) => void;
    markSaved: (id: string) => void;
}

// ── Default templates ──────────────────────────────────────────────────────────
// Python: works on K210 MaixDuino AND MaixCAM (uses only stdlib)
const PY_TEMPLATE = `# MaixPy script — works on MaixDuino (K210), MaixCAM, etc.
import sys

print("Hello from MaixIDE!")
print("Board:", sys.platform)

# --- your code below ---
`;

const CPP_TEMPLATE = `// MaixCDK project
#include "maix_basic.hpp"

int main() {
  maix::log::info("Hello from MaixIDE!");
  return 0;
}
`;

const DEFAULTS: Record<Language, string> = {
    python: PY_TEMPLATE,
    cpp: CPP_TEMPLATE,
};

export const useEditorStore = create<EditorState>((set, get) => ({
    files: [],
    activeFileId: null,

    openFile: (file) => {
        const existing = get().files.find(f => f.id === file.id);
        if (!existing) set(s => ({ files: [...s.files, file] }));
        set({ activeFileId: file.id });
    },

    closeFile: (id) => {
        const files = get().files.filter(f => f.id !== id);
        const active = get().activeFileId === id
            ? (files.at(-1)?.id ?? null)
            : get().activeFileId;
        set({ files, activeFileId: active });
    },

    updateContent: (id, content) =>
        set(s => ({
            files: s.files.map(f => f.id === id ? { ...f, content, dirty: true } : f),
        })),

    setActive: (id) => set({ activeFileId: id }),

    newFile: (name, language) => {
        const id = `file-${Date.now()}`;
        const file: EditorFile = { id, name, content: DEFAULTS[language], language, dirty: false };
        set(s => ({ files: [...s.files, file], activeFileId: id }));
    },

    markSaved: (id) =>
        set(s => ({ files: s.files.map(f => f.id === id ? { ...f, dirty: false } : f) })),
}));

// ── Convenience selector ───────────────────────────────────────────────────────
export function getActiveFile(state: EditorState): EditorFile | null {
    return state.files.find(f => f.id === state.activeFileId) ?? null;
}
