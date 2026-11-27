// Runs the server (watching its files) and the Vite dev server together. Ctrl+C stops both.
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const kids = [
  spawn(npm, ['--workspace', '@smartmouth/server', 'run', 'dev'], { stdio: 'inherit', shell: true }),
  spawn(npm, ['--workspace', '@smartmouth/web', 'run', 'dev'], { stdio: 'inherit', shell: true }),
];
const stop = () => { for (const k of kids) k.kill(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const k of kids) k.on('exit', (code) => { if (code) { console.error(`a dev process exited with ${code}`); stop(); } });
