const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

test('built Agent pages contain executable final initialization scripts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tianwang-agent-build-'));
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.copyFileSync(path.join(__dirname, '../../scripts/build.js'), path.join(root, 'scripts/build.js'));
    execFileSync(process.execPath, [path.join(root, 'scripts/build.js')], { stdio: 'pipe' });
    for (const name of ['index.html', 'settings.html']) {
        const html = fs.readFileSync(path.join(root, 'build', name), 'utf8');
        const scripts = Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g));
        expect(scripts.length).toBeGreaterThan(0);
        for (const [, script] of scripts) expect(() => new vm.Script(script, { filename: name })).not.toThrow();
    }
});
