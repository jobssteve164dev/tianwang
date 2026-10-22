const { spawnSync } = require('node:child_process');

if ((process.env.npm_config_omit || '').split(/\s+/).includes('dev')) {
  process.exit(0);
}

let patchPackage;
try {
  patchPackage = require.resolve('patch-package');
} catch {
  try {
    require.resolve('webpack-dev-server/package.json');
  } catch {
    process.exit(0);
  }
  throw new Error('patch-package is required when webpack-dev-server is installed');
}

const result = spawnSync(process.execPath, [patchPackage, '--error-on-fail'], {
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
