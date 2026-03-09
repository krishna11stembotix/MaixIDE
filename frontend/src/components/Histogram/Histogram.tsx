import { useCameraStore, type HistogramData } from '../../store/cameraStore';
import styles from './Histogram.module.css';
import { useMemo } from 'react';

// ── Per-channel sub-component (hook usage at top level, safe) ─────────────
function HistChannel({
    data,
    label,
    color,
}: {
    data: HistogramData | null;
    label: string;
    color: string;
}) {
    const path = useMemo(() => {
        if (!data || data.bins.length === 0) return '';
        const max = Math.max(...data.bins, 1);
        const n = data.bins.length;
        const W = 256;
        const H = 36;
        const parts: string[] = [];
        for (let i = 0; i < n; i++) {
            const x = (i / n) * W;
            const w = W / n;
            const barH = (data.bins[i] / max) * H;
            parts.push(
                `M${x.toFixed(1)},${H} ` +
                `L${x.toFixed(1)},${(H - barH).toFixed(1)} ` +
                `L${(x + w).toFixed(1)},${(H - barH).toFixed(1)} ` +
                `L${(x + w).toFixed(1)},${H}`
            );
        }
        return parts.join(' ');
    }, [data]);

    const fmt = (n: number) => (isNaN(n) ? '—' : Math.round(n).toString());
    const fmtF = (n: number) => (isNaN(n) ? '—' : n.toFixed(1));

    return (
        <div className={styles.channel}>
            <div className={styles.channelLabel} style={{ color }}>{label}</div>
            <div className={styles.svgWrap}>
                <svg viewBox="0 0 256 36" preserveAspectRatio="none" width="100%" height="100%">
                    {path ? (
                        <path d={path} fill={color} opacity="0.8" />
                    ) : (
                        <line x1="0" y1="36" x2="256" y2="36" stroke={color} strokeWidth="1" opacity="0.3" />
                    )}
                </svg>
            </div>
            {data && (
                <div className={styles.statsRow}>
                    {(
                        [
                            ['Mean', fmt(data.mean)],
                            ['Median', fmt(data.median)],
                            ['Mode', fmt(data.mode)],
                            ['StDev', fmtF(data.stdev)],
                            ['Min', fmt(data.min)],
                            ['Max', fmt(data.max)],
                            ['LQ', fmt(data.lq)],
                            ['UQ', fmt(data.uq)],
                        ] as [string, string][]
                    ).map(([k, v]) => (
                        <span key={k} className={styles.stat}>
                            <span className={styles.statKey}>{k}: </span>
                            <span className={styles.statVal}>{v}</span>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main Histogram panel ──────────────────────────────────────────────────
export function Histogram() {
    const { histR, histG, histB } = useCameraStore();
    const hasData = histR || histG || histB;

    return (
        <div className={styles.panel}>
            <div className={styles.toolbar}>
                <span className={styles.title}>📊 Histogram</span>
                <span className={styles.label}>RGB Color Space</span>
            </div>

            <div className={styles.body}>
                {hasData ? (
                    <>
                        <HistChannel data={histR} label="R" color="#f87171" />
                        <div className={styles.divider} />
                        <HistChannel data={histG} label="G" color="#4ade80" />
                        <div className={styles.divider} />
                        <HistChannel data={histB} label="B" color="#60a5fa" />
                    </>
                ) : (
                    <div className={styles.placeholder}>
                        No histogram data.<br />
                        <span style={{ fontSize: 9, marginTop: 4, display: 'block' }}>
                            Output ##HIST_R/G/B: lines from your script.
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
