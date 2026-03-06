import { useEffect, useRef } from 'react';
import { useCameraStore } from '../../store/cameraStore';
import styles from './FrameBuffer.module.css';

export function FrameBuffer() {
    const { frameDataUrl, fps, width, height } = useCameraStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Draw the latest JPEG onto the canvas whenever frameDataUrl changes
    useEffect(() => {
        if (!frameDataUrl || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);
        };
        img.src = frameDataUrl;
    }, [frameDataUrl]);

    return (
        <div className={styles.panel}>
            {/* Toolbar */}
            <div className={styles.toolbar}>
                <span className={styles.title}>📷 Frame Buffer</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {width > 0 && height > 0 && (
                        <span className={styles.resInfo}>{width}×{height}</span>
                    )}
                    {fps > 0 && (
                        <span className={styles.badge}>{fps.toFixed(1)} fps</span>
                    )}
                </div>
            </div>

            {/* Canvas / Placeholder */}
            <div className={styles.body}>
                {frameDataUrl ? (
                    <canvas ref={canvasRef} className={styles.canvas} />
                ) : (
                    <div className={styles.placeholder}>
                        <div className={styles.placeholderIcon}>📷</div>
                        <div>No camera frame</div>
                        <div style={{ fontSize: 9, marginTop: 2, opacity: 0.6 }}>
                            Run a script that outputs ##FRAME:&lt;base64-jpeg&gt;
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
