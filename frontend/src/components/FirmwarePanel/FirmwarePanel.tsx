import { useState, useEffect } from 'react';
import { isElectron } from '../../services/serialBridge';
import styles from './FirmwarePanel.module.css';

interface Release {
    tag_name: string;
    name: string;
    published_at: string;
    html_url: string;
}

export function FirmwarePanel() {
    const [releases, setReleases] = useState<Release[]>([]);
    const [loading, setLoading] = useState(false);
    const [flashProgress, setFlashProgress] = useState<Record<string, number>>({});
    const desktop = isElectron();

    useEffect(() => {
        setLoading(true);
        fetch('https://api.github.com/repos/sipeed/MaixPy/releases?per_page=5')
            .then(r => r.json())
            .then((data: Release[]) => setReleases(Array.isArray(data) ? data : []))
            .catch(() => setReleases([]))
            .finally(() => setLoading(false));
    }, []);

    const handleFlash = (tag: string) => {
        setFlashProgress(p => ({ ...p, [tag]: 0 }));
        let pct = 0;
        const interval = setInterval(() => {
            pct += 10;
            setFlashProgress(p => ({ ...p, [tag]: pct }));
            if (pct >= 100) clearInterval(interval);
        }, 300);
    };

    return (
        <div className={styles.firmware}>
            {!desktop && (
                <div className={styles.firmwareNotice}>
                    ⚠️ Firmware flashing requires the Desktop app. The browser cannot flash directly.
                </div>
            )}

            <div className={styles.firmwareSectionTitle}>Recent MaixPy Releases</div>

            {loading ? (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }} className="animate-pulse">Loading releases…</div>
            ) : (
                <div className={styles.firmwareReleaseList}>
                    {releases.map(r => {
                        const prog = flashProgress[r.tag_name];
                        const flashing = prog !== undefined && prog < 100;
                        const done = prog === 100;
                        return (
                            <div key={r.tag_name} className={styles.firmwareRelease}>
                                <div className={styles.firmwareReleaseInfo}>
                                    <div className={styles.firmwareReleaseName}>{r.name || r.tag_name}</div>
                                    <div className={styles.firmwareReleaseDate}>{new Date(r.published_at).toLocaleDateString()}</div>
                                    {prog !== undefined && (
                                        <div className={styles.firmwareProgress}>
                                            <div className={styles.firmwareProgressBar}>
                                                <div className={styles.firmwareProgressFill} style={{ width: `${prog}%` }} />
                                            </div>
                                            <div className={styles.firmwareProgressText}>{done ? '✅ Done' : `${prog}%`}</div>
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                    <a className="btn btn--ghost" href={r.html_url} target="_blank" rel="noreferrer"
                                        style={{ fontSize: 11, textDecoration: 'none' }}>↗ View</a>
                                    {desktop && (
                                        <button className="btn btn--primary" style={{ fontSize: 11 }}
                                            disabled={flashing || done} onClick={() => handleFlash(r.tag_name)}>
                                            {flashing ? `${prog}%` : done ? '✓' : '⚡ Flash'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
