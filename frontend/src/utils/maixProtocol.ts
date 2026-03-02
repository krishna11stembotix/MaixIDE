// ─── Maix Built-in Communication Protocol Helpers ────────────────────────────
// Reference: https://wiki.sipeed.com/maixpy/doc/en/comm/comm_protocol.html
//
// Frame format (binary mode):
//   [0xAA][0x55][CMD:1B][LEN:2B LE][DATA:LEN B][CRC8:1B]
//
// Character-based (REPL) mode is used for script upload.

// ── Frame constants ───────────────────────────────────────────────────────────
export const FRAME_HEADER_1 = 0xaa;
export const FRAME_HEADER_2 = 0x55;

export const CMD = {
    UPLOAD_FILE: 0x01,
    RUN_SCRIPT: 0x02,
    LIST_FILES: 0x03,
    DELETE_FILE: 0x04,
    RESET: 0x05,
    LOG_DATA: 0x10, // device → IDE
    ACK: 0x20,
    NAK: 0x21,
} as const;

// ── CRC-8 (Dallas/Maxim) ──────────────────────────────────────────────────────
export function crc8(data: Uint8Array): number {
    let crc = 0;
    for (const byte of data) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) {
            if (crc & 0x80) crc = ((crc << 1) ^ 0x31) & 0xff;
            else crc = (crc << 1) & 0xff;
        }
    }
    return crc;
}

// ── Frame builder ─────────────────────────────────────────────────────────────
export function buildFrame(cmd: number, payload: Uint8Array = new Uint8Array()): Uint8Array {
    const len = payload.length;
    const frame = new Uint8Array(6 + len);
    frame[0] = FRAME_HEADER_1;
    frame[1] = FRAME_HEADER_2;
    frame[2] = cmd;
    frame[3] = len & 0xff;
    frame[4] = (len >> 8) & 0xff;
    frame.set(payload, 5);
    frame[5 + len] = crc8(frame.subarray(0, 5 + len));
    return frame;
}

// ── Frame parser state ────────────────────────────────────────────────────────
export interface ParsedFrame {
    cmd: number;
    payload: Uint8Array;
}

export class FrameParser {
    private buf: number[] = [];

    /** Feed incoming bytes; returns any complete frames found. */
    feed(data: Uint8Array): ParsedFrame[] {
        const frames: ParsedFrame[] = [];
        for (const byte of data) {
            this.buf.push(byte);
            const f = this._tryParse();
            if (f) frames.push(f);
        }
        return frames;
    }

    private _tryParse(): ParsedFrame | null {
        // find header
        const s = this.buf.findIndex((b, i) => b === FRAME_HEADER_1 && this.buf[i + 1] === FRAME_HEADER_2);
        if (s < 0) { this.buf = []; return null; }
        if (s > 0) this.buf = this.buf.slice(s);

        if (this.buf.length < 6) return null;
        const len = this.buf[3] | (this.buf[4] << 8);
        if (this.buf.length < 6 + len) return null;

        const frame = new Uint8Array(this.buf.splice(0, 6 + len));
        const expected = crc8(frame.subarray(0, 5 + len));
        const actual = frame[5 + len];
        if (expected !== actual) return null;

        return { cmd: frame[2], payload: frame.slice(5, 5 + len) };
    }
}

// ── REPL-mode helpers (character-based, standard MaixPy REPL) ─────────────────

/** Bytes to interrupt any running script and enter REPL mode. */
export const REPL_INTERRUPT = new Uint8Array([0x03]); // CTRL+C
export const REPL_SOFT_RESET = new Uint8Array([0x04]); // CTRL+D

/** Encode a MaixPy script for REPL paste-mode upload. */
export function encodeReplScript(code: string): Uint8Array {
    // Use paste mode (\x05 … \x04) to upload multi-line scripts reliably
    const encoder = new TextEncoder();
    const enter = encoder.encode('\x05');   // CTRL+E — enter paste mode
    const body = encoder.encode(code + '\n');
    const commit = encoder.encode('\x04');   // CTRL+D — execute
    const merged = new Uint8Array(enter.length + body.length + commit.length);
    merged.set(enter, 0);
    merged.set(body, enter.length);
    merged.set(commit, enter.length + body.length);
    return merged;
}

/** Strip ANSI escape codes from terminal output. */
export function stripAnsi(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');
}
