import { spawn, ChildProcess } from 'child_process';

type OutputCallback = (line: string) => void;

export class BuildHandler {
    private outputCbs: OutputCallback[] = [];
    private proc: ChildProcess | null = null;

    onOutput(cb: OutputCallback): void {
        this.outputCbs.push(cb);
    }

    private emit(line: string): void {
        this.outputCbs.forEach(cb => cb(line));
    }

    async run(projectPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Spawn `maixcdk build` in the project directory
            this.proc = spawn('maixcdk', ['build'], { cwd: projectPath, shell: true });

            this.proc.stdout?.on('data', (d: Buffer) => {
                d.toString().split('\n').filter(Boolean).forEach(l => this.emit(l));
            });
            this.proc.stderr?.on('data', (d: Buffer) => {
                d.toString().split('\n').filter(Boolean).forEach(l => this.emit(`[stderr] ${l}`));
            });
            this.proc.on('close', code => {
                if (code === 0) { this.emit('[build] ✅ Build succeeded'); resolve(); }
                else { this.emit(`[build] ❌ Build failed (exit ${code})`); reject(new Error(`Build failed: ${code}`)); }
            });
            this.proc.on('error', err => { this.emit(`[build] Error: ${err.message}`); reject(err); });
        });
    }
}
