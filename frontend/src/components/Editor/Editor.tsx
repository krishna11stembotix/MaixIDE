import React, { useCallback } from 'react';
import MonacoEditor, { type OnChange } from '@monaco-editor/react';
import { useEditorStore, getActiveFile } from '../../store/editorStore';

const LANG_MAP = { python: 'python', cpp: 'cpp' } as const;

export function Editor(): JSX.Element {
    const activeFile = useEditorStore(getActiveFile);
    const updateContent = useEditorStore(s => s.updateContent);

    const handleChange: OnChange = useCallback((value) => {
        if (activeFile && value !== undefined) {
            updateContent(activeFile.id, value);
        }
    }, [activeFile, updateContent]);

    if (!activeFile) {
        return (
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-muted)',
                flexDirection: 'column',
                gap: 12,
                fontSize: 14,
                background: 'var(--color-bg-base)',
            }}>
                <div style={{ fontSize: 48 }}>📟</div>
                <div>Open or create a file to start editing</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    MaixPy (.py) · MaixCDK (.cpp / .h)
                </div>
            </div>
        );
    }

    return (
        <MonacoEditor
            height="100%"
            language={LANG_MAP[activeFile.language]}
            value={activeFile.content}
            onChange={handleChange}
            theme="vs-dark"
            options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontLigatures: true,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 4,
                insertSpaces: true,
                automaticLayout: true,
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                bracketPairColorization: { enabled: true },
                smoothScrolling: true,
                cursorSmoothCaretAnimation: 'on',
                padding: { top: 12, bottom: 12 },
                renderWhitespace: 'boundary',
                suggest: {
                    showKeywords: true,
                    showSnippets: true,
                },
            }}
        />
    );
}
