const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const repositoryRoot = path.resolve(__dirname, '../../..');

function commandsFor(job) {
    return job.steps
        .filter((step) => typeof step.run === 'string')
        .map((step) => step.run)
        .join('\n');
}

test('client release workflow builds installable packages for all supported desktop platforms', () => {
    const workflowPath = path.join(repositoryRoot, '.github/workflows/client-release.yml');
    const workflow = YAML.parse(fs.readFileSync(workflowPath, 'utf8'));
    const build = workflow.jobs.build;

    expect(build.strategy.matrix.include).toEqual(expect.arrayContaining([
        expect.objectContaining({ os: 'windows-2022', platform: 'win', arch: 'x64', extension: 'exe' }),
        expect.objectContaining({ os: 'macos-14', platform: 'mac', arch: 'universal', extension: 'dmg' }),
        expect.objectContaining({ os: 'ubuntu-22.04', platform: 'linux', arch: 'x64', extension: 'AppImage' })
    ]));

    const buildCommands = commandsFor(build);
    expect(buildCommands).toContain('npm ci');
    expect(buildCommands).toContain('npm test -- --runInBand');
    expect(buildCommands).toContain('client-v${package_version}');
    expect(buildCommands).toContain('electron-builder --${{ matrix.platform }} --${{ matrix.arch }} --publish never');

    const upload = build.steps.find((step) => step.uses === 'actions/upload-artifact@v4');
    expect(upload.with['if-no-files-found']).toBe('error');
    expect(upload.with.path).toContain('agents/dist/*.${{ matrix.extension }}');
});

test('tagged client builds publish all installers with checksums', () => {
    const workflow = YAML.parse(fs.readFileSync(
        path.join(repositoryRoot, '.github/workflows/client-release.yml'),
        'utf8'
    ));
    const release = workflow.jobs.release;

    expect(release.needs).toBe('build');
    expect(release.if).toContain("refs/tags/client-v");
    expect(release.permissions.contents).toBe('write');

    const releaseCommands = commandsFor(release);
    expect(releaseCommands).toContain('sha256sum');
    expect(releaseCommands).toContain('gh release create');
    expect(releaseCommands).toContain('--verify-tag');
});

test('desktop packaging configuration is self-contained and emits stable installer names', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'agents/package.json'), 'utf8'));
    const build = packageJson.build;

    expect(build.artifactName).toBe('TianWang-Agent-${version}-${os}-${arch}.${ext}');
    expect(build.mac.target).toBe('dmg');
    expect(build.win.target).toBe('nsis');
    expect(build.linux.target).toBe('AppImage');

    for (const platform of ['mac', 'win', 'linux']) {
        if (build[platform].icon) {
            expect(fs.existsSync(path.join(repositoryRoot, 'agents', build[platform].icon))).toBe(true);
        }
    }

    expect(build.mac.provisioningProfile).toBeUndefined();
    expect(build.mac.entitlements).toBeUndefined();
    expect(build.mac.entitlementsInherit).toBeUndefined();
});
