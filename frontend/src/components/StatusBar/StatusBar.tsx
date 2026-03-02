import { useDeviceStore } from '../../store/deviceStore';
import { useEditorStore, getActiveFile } from '../../store/editorStore';
import { hasWebSerial, isElectron } from '../../services/serialBridge';
import styles from './StatusBar.module.css';

export function StatusBar() {
    const { status, portPath, baudRate } = useDeviceStore();
    const activeFile = useEditorStore(getActiveFile);
    const mode = isElectron() ? 'Desktop' : hasWebSerial() ? 'Browser (WebSerial)' : 'Browser (No Serial)';

    return (
        <div className={styles.statusBar}>
            <div className={`${styles.statusBarItem} ${status === 'connected' ? styles.statusBarConnected :
                    status === 'error' ? styles.statusBarError : ''
                }`}>
                <div className={`dot ${status === 'connected' ? 'dot--connected' :
                        status === 'connecting' ? 'dot--busy' :
                            status === 'error' ? 'dot--error' : 'dot--disconnected'
                    }`} />
                {status === 'connected' ? `Connected${portPath ? ` · ${portPath}` : ''} · ${baudRate.toLocaleString()} baud`
                    : status === 'connecting' ? 'Connecting…'
                        : status === 'error' ? 'Connection error'
                            : 'Not connected'}
            </div>

            <span className={styles.statusBarSep}>│</span>
            <div className={styles.statusBarItem}>{mode}</div>

            <div className={styles.statusBarRight}>
                {activeFile && (
                    <>
                        <span>{activeFile.language === 'python' ? 'Python · MaixPy' : 'C/C++ · MaixCDK'}</span>
                        <span className={styles.statusBarSep}>│</span>
                        <span>{activeFile.name}</span>
                        <span className={styles.statusBarSep}>│</span>
                    </>
                )}
                <span>MaixIDE v0.1.0</span>
            </div>
        </div>
    );
}
