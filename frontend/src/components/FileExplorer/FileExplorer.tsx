import { useEditorStore, type EditorFile, type Language } from '../../store/editorStore';
import styles from './FileExplorer.module.css';

const LANG_ICON: Record<Language, string> = {
    python: '🐍',
    cpp: '⚙️',
};

export function FileExplorer() {
    const { files, activeFileId, closeFile, newFile, setActive } = useEditorStore();

    const handleNew = (lang: Language) => {
        const ext = lang === 'python' ? '.py' : '.cpp';
        const base = 'main';
        const taken = new Set(files.map(f => f.name));
        let name = `${base}${ext}`;
        let n = 1;
        while (taken.has(name)) name = `${base}${n++}${ext}`;
        newFile(name, lang);
    };

    return (
        <div className={styles.explorer}>
            <div className="panel-header" style={{ borderRadius: 0 }}>
                Files
                <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn--ghost btn--icon" onClick={() => handleNew('python')} data-tooltip="New Python file">+🐍</button>
                    <button className="btn btn--ghost btn--icon" onClick={() => handleNew('cpp')} data-tooltip="New C++ file">+⚙️</button>
                </div>
            </div>

            <div className={styles.explorerBody}>
                {files.length === 0 ? (
                    <div className={styles.explorerEmpty}>
                        No files open.<br />Create a new file to start.
                    </div>
                ) : (
                    files.map(f => (
                        <FileItem
                            key={f.id}
                            file={f}
                            active={f.id === activeFileId}
                            onSelect={() => setActive(f.id)}
                            onClose={() => closeFile(f.id)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

interface FileItemProps {
    file: EditorFile;
    active: boolean;
    onSelect: () => void;
    onClose: () => void;
}

function FileItem({ file, active, onSelect, onClose }: FileItemProps) {
    return (
        <div
            className={`${styles.explorerItem} ${active ? styles.explorerItemActive : ''}`}
            onClick={onSelect}
        >
            <span className={styles.explorerItemIcon}>{LANG_ICON[file.language]}</span>
            <span className={styles.explorerItemName}>{file.name}</span>
            {file.dirty && <span className={styles.explorerItemDirty} />}
            <button
                className="btn btn--icon"
                style={{ fontSize: 10, opacity: 0.6, padding: '2px', background: 'none', border: 'none' }}
                onClick={e => { e.stopPropagation(); onClose(); }}
                data-tooltip="Close"
            >✕</button>
        </div>
    );
}
