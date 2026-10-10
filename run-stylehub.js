
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.join(projectRoot, 'stylehub', 'stylehub-frontend');
const backendRoot = path.join(projectRoot, 'stylehub', 'stylehub-backend');
const npmCommand = process.platform === 'win32' ? 'npm' : 'npm';

const services = [
  {
    name: 'backend',
    cwd: backendRoot,
    command: npmCommand,
    args: ['run', 'dev'],
    env: {
      NODE_ENV: 'development',
    },
  },
  {
    name: 'frontend',
    cwd: frontendRoot,
    command: npmCommand,
    args: ['run', 'dev'],
  },
];

const children = [];
let shuttingDown = false;

for (const service of services) {
  if (!fs.existsSync(service.cwd)) {
    console.error(`[StyleHub] Directory not found for ${service.name}: ${service.cwd}`);
    process.exit(1);
  }
}

function stopChildren(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => process.exit(exitCode), 500);
}

for (const service of services) {
  let child;
  try {
    child = spawn(service.command, service.args, {
      cwd: service.cwd,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...service.env,
      },
      shell: process.platform === 'win32',
      windowsHide: false,
    });
  } catch (error) {
    console.error(`[StyleHub] Failed to start ${service.name}: ${error.message}`);
    stopChildren(1);
    break;
  }

  children.push(child);
  child.on('error', (error) => {
    console.error(`[StyleHub] Failed to start ${service.name}: ${error.message}`);
    stopChildren(1);
  });
  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.error(
        `[StyleHub] ${service.name} stopped` +
        ` (code: ${code ?? 'none'}, signal: ${signal ?? 'none'})`,
      );
      stopChildren(code ?? 1);
    }
  });
}

process.once('SIGINT', () => stopChildren(0));
process.once('SIGTERM', () => stopChildren(0));
