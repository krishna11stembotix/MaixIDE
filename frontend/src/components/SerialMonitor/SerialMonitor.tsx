import { useEffect, useRef, useState } from 'react';
import { useSerialStore, type SerialEntry } from '../../store/serialStore';
import { useDeviceStore } from '../../store/deviceStore';
import { encodeText } from '../../services/serialBridge';
import styles from './SerialMonitor.module.css';

function formatTs(ms: number): string {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function SerialMonitor() {
    const { entries, paused, clear, setPaused, append } = useSerialStore();
    const { serialBridge, status } = useDeviceStore();
    const bottomRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = useState('');

    // Auto-scroll
    useEffect(() => {
        if (!paused) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [entries, paused]);

    const sendInput = async () => {
        if (!serialBridge || !input) return;
        await serialBridge.write(encodeText(input + '\r\n'));
        append(`> ${input}`, 'system');
        setInput('');
    };

    return (
        <div className={styles.monitor}>
            <div className={styles.monitorToolbar}>
                <div className={styles.monitorToolbarLeft}>
                    <span className={styles.monitorTitle}>Serial Monitor</span>
                    {status === 'connected' && <span className="badge badge--connected">Live</span>}
                </div>
                <div className={styles.monitorToolbarRight}>
                    <button className="btn btn--ghost" onClick={() => setPaused(!paused)} style={{ fontSize: 11 }}>
                        {paused ? 'Resume' : 'Pause'}
                    </button>
                    <button className="btn btn--ghost" onClick={clear} style={{ fontSize: 11 }}>Clear</button>
                </div>
            </div>

            <div className={styles.monitorBody}>
                {entries.length === 0 ? (
                    <div className={styles.monitorEmpty}>No output yet. Connect a device and run a script.</div>
                ) : (
                    entries.map(entry => <LogEntry key={entry.id} entry={entry} />)
                )}
                <div ref={bottomRef} />
            </div>

            <div className={styles.monitorInputRow}>
                <input
                    type="text"
                    className={styles.monitorInput}
                    value={input}
                    placeholder="Send command to device…"
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') sendInput(); }}
                    disabled={status !== 'connected'}
                />
                <button className="btn btn--primary" onClick={sendInput}
                    disabled={status !== 'connected' || !input} style={{ fontSize: 11, flexShrink: 0 }}>
                    Send
                </button>
            </div>
        </div>
    );
}

function LogEntry({ entry }: { entry: SerialEntry }) {
    const kindClass = entry.kind === 'stderr' ? styles.monitorTextStderr
        : entry.kind === 'system' ? styles.monitorTextSystem
            : styles.monitorTextStdout;
    return (
        <div className={styles.monitorEntry}>
            <span className={styles.monitorTs}>{formatTs(entry.timestamp)}</span>
            <span className={`${styles.monitorText} ${kindClass}`}>{entry.text}</span>
        </div>
    );
}
