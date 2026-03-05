// ─── Serial Bridge — Abstract Interface ──────────────────────────────────────
// Both WebSerial (browser) and Electron IPC implement this interface.
// The rest of the application only talks to this interface, never to concrete
// implementations directly, keeping the codebase transport-agnostic.

export interface PortInfo {
    path: string;
    manufacturer?: string;
    productId?: string;
    vendorId?: string;
}

export type SerialDataCallback = (data: Uint8Array) => void;

export interface SerialBridge {
    /** List available serial ports. */
    listPorts(): Promise<PortInfo[]>;

    /** Open a connection to the given port at given baud rate. */
    connect(port: string, baud: number): Promise<void>;
    

    /** Close the current connection. */
    disconnect(): Promise<void>;

    /** Write raw bytes to the device. */
    write(data: Uint8Array): Promise<void>;

    /**
     * Upload and run a Python script via REPL paste mode.
     * Implementations should send CTRL+C, CTRL+E, code chunks, CTRL+D with proper delays.
     * If not provided, Toolbar falls back to raw write().
     */
    uploadScript?(code: string): Promise<void>;

    /** Register a callback that fires whenever data arrives from the device. */
    onData(cb: SerialDataCallback): void;

    /** Remove a previously registered data callback. */
    offData(cb: SerialDataCallback): void;

    /** Whether a connection is currently open. */
    readonly isConnected: boolean;
}

// ─── Text helpers ─────────────────────────────────────────────────────────────

export function encodeText(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

export function decodeText(data: Uint8Array): string {
    return new TextDecoder().decode(data);
}

// ─── Runtime detection ────────────────────────────────────────────────────────

/** Returns true when running inside an Electron window with our bridge exposed. */
export function isElectron(): boolean {
    return typeof window !== 'undefined' &&
        typeof (window as unknown as Record<string, unknown>).electronBridge !== 'undefined';
}

/** Returns true when the browser exposes the Web Serial API. */
export function hasWebSerial(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
}
