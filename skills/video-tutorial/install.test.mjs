// Run from this folder: node --test install.test.mjs. Every outside command is a stub, so nothing here installs or downloads.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = (path, body) => {
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
};

// A logging python: pip and the import check obey the switches, everything else succeeds.
const fakeEnvPython = (log) => `echo "env-python $*" >> ${log}
case "$*" in
  *"-c "*) echo "import-check offline=\${HF_HUB_OFFLINE:-unset} args=$1 $2" >> ${log} ;;
esac
case "$*" in
  *"-m pip"*) [ ! -f "$FAIL_PIP" ] ;;
  *"-c "*) if [ -f "$FAIL_IMPORT" ]; then echo "Traceback"; echo "ModuleNotFoundError: No module named 'mlx_audio'"; exit 1; fi ;;
esac`;

function machine({os = 'Darwin', hardware = '1', arch = 'arm64', tools = ['node', 'pnpm', 'ffmpeg', 'ffprobe'], python312 = 'arm64', voice = true} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'vt-install-'));
  const home = join(root, 'home');
  const skill = join(root, 'skill');
  const bin = join(root, 'bin');
  const log = join(root, 'calls.log');
  mkdirSync(home);
  mkdirSync(skill);
  mkdirSync(bin);
  writeFileSync(log, '');
  copyFileSync(join(here, 'install.sh'), join(skill, 'install.sh'));
  copyFileSync(join(here, 'requirements.txt'), join(skill, 'requirements.txt'));
  if (voice) {
    mkdirSync(join(skill, 'voices'));
    writeFileSync(join(skill, 'voices/ref-tanya-s45.wav'), '');
  }
  script(join(bin, 'uname'), `[ "$1" = -s ] && echo ${os} || echo ${arch}`);
  script(join(bin, 'sysctl'), `echo ${hardware}`);
  for (const tool of tools) script(join(bin, tool), 'exit 0');
  if (python312) {
    const envPython = fakeEnvPython(log);
    script(join(bin, 'python3.12'), `case "$1" in
  -c) echo ${python312} ;;
  -m) echo "python3.12 $*" >> ${log}
      mkdir -p "$3/bin"
      cat > "$3/bin/python" <<'INNER'
#!/bin/sh
${envPython}
INNER
      chmod +x "$3/bin/python" ;;
esac`);
  }
  const failPip = join(root, 'fail-pip');
  const failImport = join(root, 'fail-import');
  const run = () => spawnSync('/bin/sh', [join(skill, 'install.sh')], {
    env: {HOME: home, PATH: `${bin}:/usr/bin:/bin`, FAIL_PIP: failPip, FAIL_IMPORT: failImport},
    encoding: 'utf8',
  });
  return {
    root, home, skill, run, failPip, failImport, env: join(home, '.venv/mlx-tts'),
    calls: () => readFileSync(log, 'utf8'),
    existingEnv() {
      script(join(home, '.venv/mlx-tts/bin/python'), fakeEnvPython(log));
    },
    cleanup: () => rmSync(root, {recursive: true, force: true}),
  };
}

const refusesBeforeWriting = (m, message) => {
  const result = m.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, message);
  assert.deepEqual(readdirSync(m.home), []);
  assert.equal(m.calls(), '');
  m.cleanup();
};

test('a machine that is not a Mac is refused before anything is written', () => {
  refusesBeforeWriting(machine({os: 'Linux', hardware: ''}), /needs an Apple Silicon Mac, and this machine runs Linux/);
});

test('an Intel Mac is refused before anything is written', () => {
  refusesBeforeWriting(machine({hardware: '0', arch: 'x86_64'}), /needs an Apple Silicon Mac, and this is an Intel Mac/);
});

test('an Intel Mac whose sysctl has no answer is refused too', () => {
  refusesBeforeWriting(machine({hardware: '', arch: 'x86_64'}), /this is an Intel Mac/);
});

test('a terminal under Rosetta is refused before anything is written', () => {
  refusesBeforeWriting(machine({arch: 'x86_64'}), /under Rosetta/);
});

test('missing tools are all named before anything is written', () => {
  refusesBeforeWriting(machine({tools: ['node', 'ffprobe']}), /Missing: pnpm ffmpeg\./);
});

test('no python3.12 stops before anything is written', () => {
  refusesBeforeWriting(machine({python312: null}), /Missing: python3\.12/);
});

test('an Intel python3.12 stops before anything is written', () => {
  refusesBeforeWriting(machine({python312: 'x86_64'}), /is not an arm64 build/);
});

test('no environment: creates it from the fixed versions, then checks models', () => {
  const m = machine();
  const result = m.run();
  assert.equal(result.status, 0, result.stderr);
  const calls = m.calls().trim().split('\n').filter((line) => !line.startsWith('import-check'));
  assert.match(calls[0], /^python3\.12 -m venv .*\.venv\/mlx-tts$/);
  assert.match(calls[1], /^env-python -m pip install .*-r .*requirements\.txt$/);
  assert.match(calls[2], /^env-python -I -B -c import mlx\.core/);
  assert.match(calls[3], /^env-python -I .*install_models\.py$/);
  assert.equal(existsSync(join(m.env, '.video-tutorial-installing')), false);
  assert.match(result.stdout, /are ready/);
  m.cleanup();
});

test('a finished environment is only checked, never installed into', () => {
  const m = machine();
  m.existingEnv();
  const result = m.run();
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(m.calls(), /pip|venv/);
  assert.match(m.calls(), /install_models\.py/);
  m.cleanup();
});

test('the import check cannot download or write into the environment', () => {
  const m = machine();
  m.existingEnv();
  assert.equal(m.run().status, 0);
  assert.match(m.calls(), /import-check offline=1 args=-I -B/);
  m.cleanup();
});

test('an environment that cannot run the narration is reported and left unchanged', () => {
  const m = machine();
  m.existingEnv();
  writeFileSync(m.failImport, '');
  const result = m.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /left unchanged: ModuleNotFoundError: No module named 'mlx_audio'/);
  assert.doesNotMatch(m.calls(), /pip|venv|install_models/);
  m.cleanup();
});

test('a folder at the environment path without Python is left unchanged', () => {
  const m = machine();
  mkdirSync(m.env, {recursive: true});
  const result = m.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /has no Python\. It was left unchanged/);
  assert.equal(m.calls(), '');
  assert.deepEqual(readdirSync(m.env), []);
  m.cleanup();
});

test('an interrupted install continues on the next run and then counts as finished', () => {
  const m = machine();
  writeFileSync(m.failPip, '');
  const first = m.run();
  assert.equal(first.status, 1);
  assert.match(first.stderr, /Run install\.sh again to continue/);
  assert.doesNotMatch(m.calls(), /install_models/);
  rmSync(m.failPip);
  const second = m.run();
  assert.equal(second.status, 0, second.stderr);
  assert.equal(existsSync(join(m.env, '.video-tutorial-installing')), false);
  assert.match(m.calls(), /install_models/);
  const pipRuns = m.calls().match(/-m pip install/g).length;
  assert.equal(pipRuns, 2);
  const third = m.run();
  assert.equal(third.status, 0);
  assert.equal(m.calls().match(/-m pip install/g).length, pipRuns);
  m.cleanup();
});

test('a failing model step fails the install', () => {
  const m = machine();
  m.existingEnv();
  const python = join(m.env, 'bin/python');
  writeFileSync(python, `${readFileSync(python, 'utf8')}\ncase "$*" in *install_models*) exit 1 ;; esac\n`);
  const result = m.run();
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /are ready/);
  m.cleanup();
});

test('a missing voice is named, without failing the machine setup', () => {
  const m = machine({voice: false});
  const result = m.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Still missing: .*ref-tanya-s45\.wav.*ask the owner/);
  m.cleanup();
});

test('with the voice in place, nothing is reported missing', () => {
  const m = machine();
  const result = m.run();
  assert.doesNotMatch(result.stdout, /Still missing/);
  m.cleanup();
});
