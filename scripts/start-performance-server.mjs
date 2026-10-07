import { config } from 'dotenv';
import { spawn } from 'node:child_process';
config({ path: '.env.production.local', quiet: true });
process.env.DATABASE_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3100'], { stdio: 'inherit', env: process.env });
process.on('SIGINT', () => server.kill('SIGINT'));
server.on('exit', (code) => { process.exitCode = code || 0; });
