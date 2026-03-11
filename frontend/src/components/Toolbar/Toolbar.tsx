import { useState, useCallback } from 'react';
import { useEditorStore, getActiveFile } from '../../store/editorStore';
import { useDeviceStore } from '../../store/deviceStore';
import { useSerialStore } from '../../store/serialStore';
import { REPL_INTERRUPT, encodeReplScript } from '../../utils/maixProtocol';
import styles from './Toolbar.module.css';

interface ToolbarProps {
    onNewPyFile: () => void;
    onNewCFile: () => void;
}

export function Toolbar({ onNewPyFile, onNewCFile }: ToolbarProps) {
    const activeFile = useEditorStore(getActiveFile);
    const { status, connect, disconnect, serialBridge } = useDeviceStore();
    const appendSerial = useSerialStore(s => s.append);
    const [running, setRunning] = useState(false);

    const isConnected = status === 'connected';
    const isConnecting = status === 'connecting';

    const handleRun = useCallback(async () => {
        if (!activeFile || !serialBridge) return;
        setRunning(true);
        appendSerial(`Running ${activeFile.name}…`, 'system');
        try {
            if (serialBridge.uploadScript) {
                // Smart chunked upload with proper delays (WebSerial)
                await serialBridge.uploadScript(activeFile.content);
            } else {
                // Fallback: raw write (Electron / other)
                await serialBridge.write(REPL_INTERRUPT);
                await new Promise(r => setTimeout(r, 200));
                await serialBridge.write(encodeReplScript(activeFile.content));
            }
        } catch (e) {
            appendSerial(`Error: ${e}`, 'stderr');
        }
        setRunning(false);
    }, [activeFile, serialBridge, appendSerial]);

    const handleStop = useCallback(async () => {
        if (!serialBridge) return;
        await serialBridge.write(REPL_INTERRUPT);
        appendSerial('Script interrupted.', 'system');
    }, [serialBridge, appendSerial]);

    return (
        <div className={styles.toolbar}>
            {/* Logo */}
            <div className={styles.toolbarLogo}>
                <div className={styles.toolbarLogoIcon}>M</div>
                <div className={styles.toolbarLogoName}>
                    Maix<span>IDE</span>
                </div>
            </div>

            <div className={styles.toolbarDivider} />

            <button className="btn btn--ghost" onClick={onNewPyFile} data-tooltip="New Python file">New .py</button>
            <button className="btn btn--ghost" onClick={onNewCFile} data-tooltip="New C/C++ file">New .cpp</button>

            <div className={styles.toolbarDivider} />

            <button
                className={`btn ${styles.toolbarBtnRun}`}
                onClick={handleRun}
                disabled={!isConnected || !activeFile || running}
                data-tooltip="Run script on device"
            >Run</button>

            <button
                className={`btn ${styles.toolbarBtnStop}`}
                onClick={handleStop}
                disabled={!isConnected}
                data-tooltip="Interrupt running script"
            >Stop</button>

            <div className={styles.toolbarSpacer} />

            {activeFile && (
                <div className={styles.toolbarFileName}>
                    {activeFile.name}{activeFile.dirty ? ' •' : ''}
                </div>
            )}

            <div className={styles.toolbarDivider} />

            <button
                className={`btn ${isConnected ? 'btn--danger' : 'btn--primary'}`}
                onClick={isConnected ? disconnect : connect}
                disabled={isConnecting}
            >
                {isConnecting ? <span className="animate-pulse">Connecting…</span>
                    : isConnected ? 'Disconnect' : 'Connect'}
            </button>
        </div>
    );
}
