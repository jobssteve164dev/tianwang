#!/usr/bin/env node

const { existsSync } = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const aiRoot = path.join(root, 'server', 'ai-engine');
const virtualPython = process.platform === 'win32'
  ? path.join(root, '.venv', 'Scripts', 'python.exe')
  : path.join(root, '.venv', 'bin', 'python');

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) {
    console.error(`Unable to run ${command}: ${result.error.message}`);
    process.exit(1);
  }
  process.exitCode = result.status ?? 1;
  return process.exitCode === 0;
}

function setupVirtualEnvironment() {
  const bootstrapPython = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  if (!existsSync(virtualPython) && !run(bootstrapPython, ['-m', 'venv', path.join(root, '.venv')])) {
    return false;
  }
  return run(virtualPython, ['-m', 'pip', 'install', '-r', path.join(aiRoot, 'requirements.txt')]);
}

function resolvePython() {
  if (process.env.PYTHON) return process.env.PYTHON;
  if (!existsSync(virtualPython) && !setupVirtualEnvironment()) process.exit(1);
  return virtualPython;
}

const mode = process.argv[2];

if (mode === 'setup') {
  if (!setupVirtualEnvironment()) process.exit(1);
} else if (mode === 'test') {
  run(resolvePython(), ['-m', 'pytest', '-q'], aiRoot);
} else if (mode === 'run') {
  run(resolvePython(), ['-m', 'src.main'], aiRoot);
} else {
  console.error('Usage: node scripts/ai-environment.js <setup|test|run>');
  process.exit(1);
}
