import { execSync, spawn } from 'child_process';
import stripAnsi from 'strip-ansi';
import { getDevAccessToken } from './private/getDevAccessToken';

const execOptions = { stdio: 'pipe', encoding: 'utf-8' } as const;

describe('inquirer cli', () => {
  let devAccessToken: string;

  beforeAll(async () => {
    devAccessToken = await getDevAccessToken();
  });

  it('--version', () => {
    const res = runBackport(`--version`);
    expect(res).toContain(process.env.npm_package_version);
  });

  it('-v', () => {
    const res = runBackport(`-v`);
    expect(res).toContain(process.env.npm_package_version);
  });

  it('--help', () => {
    const res = runBackport(`--help`);
    expect(res).toContain('Show version number');
  });

  it('should return error when branch is missing', () => {
    const res = runBackport(
      `--upstream foo --username sqren --accessToken ${devAccessToken}`
    );
    expect(res).toMatchInlineSnapshot(`
      "You must specify a target branch

      You can specify it via either:
       - Config file (recommended): \\".backportrc.json\\". Read more: https://github.com/sqren/backport/blob/e119d71d6dc03cd061f6ad9b9a8b1cd995f98961/docs/configuration.md#project-config-backportrcjson
       - CLI: \\"--branch 6.1\\"
      "
    `);
  });

  it('should return error when upstream is missing', () => {
    const res = runBackport(
      `--branch foo --username sqren --accessToken ${devAccessToken}`
    );
    expect(res).toMatchInlineSnapshot(`
      "You must specify a valid Github repository

      You can specify it via either:
       - Config file (recommended): \\".backportrc.json\\". Read more: https://github.com/sqren/backport/blob/e119d71d6dc03cd061f6ad9b9a8b1cd995f98961/docs/configuration.md#project-config-backportrcjson
       - CLI: \\"--upstream elastic/kibana\\"
      "
    `);
  });

  it('should return error when access token is invalid', () => {
    const res = runBackport(
      `--branch foo --upstream foo/bar  --username some-user --accessToken some-token`
    );
    expect(res).toContain(
      'Please check your access token and make sure it is valid'
    );
  });

  it(`should return error when repo doesn't exist`, () => {
    const res = runBackport(
      `--branch foo --upstream foo/bar --username sqren --accessToken ${devAccessToken}`
    );
    expect(res).toMatchInlineSnapshot(`
      "The repository \\"foo/bar\\" doesn't exist
      "
    `);
  });

  it(`should list commits from master`, async () => {
    const output = await runBackportAsync([
      '--branch',
      'foo',
      '--upstream',
      'backport-org/backport-e2e',
      '--username',
      'sqren',
      '--accessToken',
      devAccessToken,
      '--author',
      'sqren',
      '--max-number',
      '6',
    ]);

    expect(output).toMatchInlineSnapshot(`
      "? Select commit (Use arrow keys)
      ❯ 1. Add sheep emoji (#9) 7.8
        2. Change Ulysses to Gretha (conflict) (#8)
        3. Add 🍏 emoji (#5) 7.x, 7.8
        4. Add family emoji (#2) 7.x
        5. Add \`backport\` dep (823178be)
        6. Merge pull request #1 from backport-org/add-heart-emoji (#1)"
    `);
  });

  it(`should list commits from 7.x`, async () => {
    const output = await runBackportAsync([
      '--branch',
      'foo',
      '--upstream',
      'backport-org/backport-e2e',
      '--username',
      'sqren',
      '--accessToken',
      devAccessToken,
      '--author',
      'sqren',
      '--max-number',
      '6',
      '--source-branch',
      '7.x',
    ]);

    expect(output).toMatchInlineSnapshot(`
      "? Select commit (Use arrow keys)
      ❯ 1. Add 🍏 emoji (#5) (#6)
        2. Change Ulysses to Carol (2722c78c)
        3. Add family emoji (#2) (#4)
        4. Update .backportrc.json (0d602b25)
        5. Branch off: 7.9.0 (7.x) (908c7686)
        6. Bump to 8.0.0 (16cfd987)"
    `);
  });
});

function runBackport(args: string) {
  const cmd = `./node_modules/.bin/ts-node --transpile-only ./src/entrypoint.cli.ts ${args}`;
  return execSync(cmd, execOptions);
}

function runBackportAsync(options: string[]) {
  const proc = spawn('./node_modules/.bin/ts-node', [
    '--transpile-only',
    './src/entrypoint.cli.ts',
    ...options,
  ]);

  return new Promise<string>((resolve) => {
    let data = '';

    proc.stdout.on('data', (dataChunk) => {
      data += dataChunk;
      const output = data.toString();
      if (output.includes('Select commit')) {
        // remove ansi codes and whitespace
        resolve(stripAnsi(output).replace(/\s+$/gm, ''));
        proc.kill();
      }
    });
  });
}
