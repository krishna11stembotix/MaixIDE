import { useEffect, useState } from 'react';
import { useDeviceStore } from '../../store/deviceStore';
import type { PortInfo } from '../../services/serialBridge';
import { isElectron, hasWebSerial } from '../../services/serialBridge';
import { ElectronSerialService } from '../../services/electronSerialService';
import styles from './DeviceManager.module.css';

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

export function DeviceManager() {
    const { status, portPath, baudRate, errorMsg, serialBridge,
        setPort, setBaud, connect, disconnect, clearError } = useDeviceStore();
    const [ports, setPorts] = useState<PortInfo[]>([]);

    const isConnected = status === 'connected';

    // Single refreshPorts: uses existing bridge if available, otherwise creates a temp one
    const refreshPorts = async () => {
        try {
            const bridge = serialBridge ?? (isElectron() ? new ElectronSerialService() : null);
            if (!bridge) return;
            const list = await bridge.listPorts();
            setPorts(list);
            // Auto-select first port if none currently selected
            if (list.length > 0 && !portPath) setPort(list[0].path);
        } catch { /* ignore */ }
    };

    // Load ports on mount (Electron only — browser uses OS dialog)
    useEffect(() => {
        if (isElectron()) refreshPorts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Refresh after reconnect
    useEffect(() => {
        if (serialBridge && isConnected) {
            serialBridge.listPorts().then(setPorts).catch(() => { });
        }
    }, [serialBridge, isConnected]);

    const canConnect = isElectron() ? !!portPath : true;

    return (
        <div className={styles.deviceManager}>
            {!hasWebSerial() && !isElectron() && (
                <div className={styles.deviceManagerHint}>
                    Note: WebSerial not available. Use Chrome / Edge 89+ or the Desktop app.
                </div>
            )}

            {isElectron() ? (
                <div className={styles.deviceManagerRow}>
                    <span className={styles.deviceManagerLabel}>Port</span>
                    <select className="select" value={portPath} onChange={e => setPort(e.target.value)} disabled={isConnected}>
                        <option value="">— select —</option>
                        {ports.map(p => <option key={p.path} value={p.path}>{p.path}</option>)}
                    </select>
                    <button className="btn btn--ghost" onClick={refreshPorts} data-tooltip="Refresh ports">Refresh</button>
                </div>
            ) : (
                <div className={styles.deviceManagerHint}>
                    Port selected via OS dialog on Connect.
                </div>
            )}

            <div className={styles.deviceManagerRow}>
                <span className={styles.deviceManagerLabel}>Baud</span>
                <select className="select" value={baudRate} onChange={e => setBaud(Number(e.target.value))} disabled={isConnected}>
                    {BAUD_RATES.map(b => <option key={b} value={b}>{b.toLocaleString()}</option>)}
                </select>
            </div>

            <div className={styles.deviceManagerStatusRow}>
                <div className={`dot ${status === 'connected' ? 'dot--connected' :
                    status === 'connecting' ? 'dot--busy animate-pulse' :
                        status === 'error' ? 'dot--error' : 'dot--disconnected'}`} />
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {status === 'connected' ? `Connected · ${baudRate.toLocaleString()} baud`
                        : status === 'connecting' ? 'Connecting…'
                            : status === 'error' ? 'Connection failed'
                                : 'Not connected'}
                </span>
            </div>

            {errorMsg && (
                <div className={styles.deviceManagerError}>
                    {errorMsg}
                    <button className="btn btn--ghost" style={{ marginLeft: 8, padding: '2px 6px' }} onClick={clearError}>✕</button>
                </div>
            )}

            <button
                className={`btn ${isConnected ? 'btn--danger' : 'btn--primary'}`}
                onClick={isConnected ? disconnect : connect}
                disabled={status === 'connecting' || (!isConnected && !canConnect)}
                title={!canConnect ? 'Select a port first' : ''}
            >
                {status === 'connecting' ? 'Connecting…' : isConnected ? 'Disconnect' : 'Connect Device'}
            </button>
        </div>
    );
}
