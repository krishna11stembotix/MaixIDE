#!/usr/bin/env python3
"""
MaixPy Script Upload Utility
──────────────────────────────────────────────────────────────────────────────
Uploads a MaixPy .py script to a Maix device over serial using REPL paste mode.

Usage:
    python maixpy-upload.py --port COM3 --file main.py [--baud 115200] [--run]

Requirements:
    pip install pyserial

Protocol used:
    CTRL+C  (0x03) – interrupt any running script
    CTRL+E  (0x05) – enter paste mode
    <code>  – paste the script content
    CTRL+D  (0x04) – execute
"""

import argparse
import serial
import time
import sys

def upload_script(port: str, baud: int, filepath: str, run: bool = True):
    print(f"[MaixUpload] Connecting to {port} @ {baud} baud…")
    ser = serial.Serial(port, baud, timeout=2)
    time.sleep(0.5)

    print("[MaixUpload] Interrupting running script…")
    ser.write(b'\x03')  # CTRL+C
    time.sleep(0.3)
    ser.write(b'\x03')  # second interrupt to be safe
    time.sleep(0.3)
    ser.flushInput()

    with open(filepath, 'r', encoding='utf-8') as f:
        code = f.read()

    print(f"[MaixUpload] Uploading {filepath} ({len(code)} bytes)…")
    ser.write(b'\x05')  # CTRL+E — enter paste mode
    time.sleep(0.1)
    ser.write(code.encode('utf-8'))
    time.sleep(0.1)

    if run:
        ser.write(b'\x04')  # CTRL+D — execute
        print("[MaixUpload] Script sent. Streaming output (Ctrl+C to stop):")
        try:
            while True:
                data = ser.read(256)
                if data:
                    sys.stdout.buffer.write(data)
                    sys.stdout.flush()
        except KeyboardInterrupt:
            pass
    else:
        ser.write(b'\x04')  # commit paste mode without running
        print("[MaixUpload] Script uploaded (not run).")

    ser.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='MaixPy Script Upload Utility')
    parser.add_argument('--port',  required=True, help='Serial port (e.g. COM3 or /dev/ttyUSB0)')
    parser.add_argument('--file',  required=True, help='Path to .py script')
    parser.add_argument('--baud',  type=int, default=115200, help='Baud rate (default: 115200)')
    parser.add_argument('--run',   action='store_true', default=True, help='Run after upload (default: True)')
    args = parser.parse_args()
    upload_script(args.port, args.baud, args.file, args.run)
