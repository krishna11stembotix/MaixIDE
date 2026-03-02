import { useCallback, useState } from 'react';
import { Toolbar } from './components/Toolbar/Toolbar';
import { FileExplorer } from './components/FileExplorer/FileExplorer';
import { DeviceManager } from './components/DeviceManager/DeviceManager';
import { Editor } from './components/Editor/Editor';
import { SerialMonitor } from './components/SerialMonitor/SerialMonitor';
import { FirmwarePanel } from './components/FirmwarePanel/FirmwarePanel';
import { StatusBar } from './components/StatusBar/StatusBar';
import { useEditorStore } from './store/editorStore';
import { useUIStore } from './store/uiStore';
import styles from './App.module.css';

type SidebarTab = 'files' | 'device';
type BottomTab = 'serial' | 'firmware';

export default function App() {
    const [sidebarTab, setSidebarTab] = useState<SidebarTab>('files');
    const [bottomTab, setBottomTab] = useState<BottomTab>('serial');
    const { files, activeFileId, setActive, closeFile, newFile } = useEditorStore();
    const { bottomPanelHeight, setBottomPanelHeight } = useUIStore();

    // Drag resizer for bottom panel
    const onResizerMouseDown = useCallback((e: React.MouseEvent) => {
        const startY = e.clientY;
        const startH = bottomPanelHeight;
        e.preventDefault();

        const onMove = (ev: MouseEvent) => {
            const newH = Math.min(600, Math.max(80, startH + (startY - ev.clientY)));
            setBottomPanelHeight(newH);
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [bottomPanelHeight, setBottomPanelHeight]);

    const handleNewPy = () => newFile('main.py', 'python');
    const handleNewCpp = () => newFile('main.cpp', 'cpp');

    return (
        <div className={styles.app}>
            {/* ── Top Toolbar ── */}
            <Toolbar onNewPyFile={handleNewPy} onNewCFile={handleNewCpp} />

            <div className={styles.appBody}>
                {/* ── Left Sidebar ── */}
                <div className={styles.sidebar}>
                    <div className={styles.sidebarNav}>
                        {(['files', 'device'] as SidebarTab[]).map(tab => (
                            <div
                                key={tab}
                                className={`${styles.sidebarNavItem} ${sidebarTab === tab ? styles.sidebarNavItemActive : ''}`}
                                onClick={() => setSidebarTab(tab)}
                            >
                                {tab === 'files' ? '📁 Files' : '🔌 Device'}
                            </div>
                        ))}
                    </div>
                    <div className={styles.sidebarPanel}>
                        {sidebarTab === 'files' && <FileExplorer />}
                        {sidebarTab === 'device' && (
                            <div style={{ overflow: 'auto', flex: 1 }}>
                                <div className="panel-header" style={{ borderRadius: 0 }}>Device</div>
                                <DeviceManager />
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Main Area ── */}
                <div className={styles.main}>
                    {/* File tabs */}
                    {files.length > 0 && (
                        <div className={styles.fileTabs}>
                            {files.map(f => (
                                <div
                                    key={f.id}
                                    className={`${styles.fileTab} ${f.id === activeFileId ? styles.fileTabActive : ''}`}
                                    onClick={() => setActive(f.id)}
                                >
                                    {f.dirty && <span className={styles.fileTabDirty} />}
                                    {f.name}
                                    <button
                                        className={styles.fileTabClose}
                                        onClick={e => { e.stopPropagation(); closeFile(f.id); }}
                                    >✕</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Editor */}
                    <div className={styles.editorArea}>
                        <Editor />
                    </div>

                    {/* Drag splitter */}
                    <div className="resizer" onMouseDown={onResizerMouseDown} />

                    {/* Bottom panel */}
                    <div className={styles.bottomPanel} style={{ height: bottomPanelHeight }}>
                        <div className={styles.bottomPanelTabs}>
                            {(['serial', 'firmware'] as BottomTab[]).map(tab => (
                                <div
                                    key={tab}
                                    className={`${styles.bottomPanelTab} ${bottomTab === tab ? styles.bottomPanelTabActive : ''}`}
                                    onClick={() => setBottomTab(tab)}
                                >
                                    {tab === 'serial' ? '📟 Serial Monitor' : '⚡ Firmware'}
                                </div>
                            ))}
                        </div>
                        <div className={styles.bottomPanelContent}>
                            {bottomTab === 'serial' && <SerialMonitor />}
                            {bottomTab === 'firmware' && <FirmwarePanel />}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Status Bar ── */}
            <StatusBar />
        </div>
    );
}
