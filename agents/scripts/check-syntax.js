const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const roots = ['src', 'scripts', 'tests'];
const files = [];

function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collect(entryPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(entryPath);
    }
  }
}

for (const root of roots) {
  collect(path.resolve(__dirname, '..', root));
}

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}

console.log(`Syntax check passed for ${files.length} agent JavaScript files.`);
