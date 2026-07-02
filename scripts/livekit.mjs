/**
 * Download (if needed) and run LiveKit server on Windows without Docker.
 * Usage: node scripts/livekit.mjs
 */
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TOOLS_DIR = join(ROOT, 'tools');
const CONFIG = join(ROOT, 'livekit.yaml');
const VERSION = '1.13.1';

const isWindows = process.platform === 'win32';
const EXE_NAME = isWindows ? 'livekit-server.exe' : 'livekit-server';
const EXE_PATH = join(TOOLS_DIR, EXE_NAME);

const DOWNLOAD_URL = isWindows
  ? `https://github.com/livekit/livekit/releases/download/v${VERSION}/livekit_${VERSION}_windows_amd64.zip`
  : `https://github.com/livekit/livekit/releases/download/v${VERSION}/livekit_${VERSION}_linux_amd64.tar.gz`;

function findBinary(dir) {
  if (existsSync(join(dir, EXE_NAME))) {
    return join(dir, EXE_NAME);
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const found = findBinary(join(dir, entry.name));
      if (found) return found;
    }
  }
  return null;
}

function downloadWindows() {
  mkdirSync(TOOLS_DIR, { recursive: true });
  const zipPath = join(TOOLS_DIR, 'livekit.zip');

  console.log(`Downloading LiveKit v${VERSION} for Windows...`);
  execSync(
    `powershell -NoProfile -Command "Invoke-WebRequest -Uri '${DOWNLOAD_URL}' -OutFile '${zipPath}'"`,
    { stdio: 'inherit' },
  );

  console.log('Extracting...');
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${TOOLS_DIR}' -Force"`,
    { stdio: 'inherit' },
  );

  const binary = findBinary(TOOLS_DIR);
  if (!binary) {
    throw new Error('livekit-server.exe not found after extraction.');
  }

  if (binary !== EXE_PATH) {
    execSync(`powershell -NoProfile -Command "Move-Item -Force '${binary}' '${EXE_PATH}'"`, {
      stdio: 'inherit',
    });
  }

  console.log(`Installed: ${EXE_PATH}`);
}

function downloadLinux() {
  mkdirSync(TOOLS_DIR, { recursive: true });
  const archivePath = join(TOOLS_DIR, 'livekit.tar.gz');

  console.log(`Downloading LiveKit v${VERSION} for Linux...`);
  execSync(`curl -fsSL "${DOWNLOAD_URL}" -o "${archivePath}"`, { stdio: 'inherit' });
  execSync(`tar -xzf "${archivePath}" -C "${TOOLS_DIR}"`, { stdio: 'inherit' });

  const binary = findBinary(TOOLS_DIR);
  if (!binary) {
    throw new Error('livekit-server not found after extraction.');
  }
  if (binary !== EXE_PATH) {
    execSync(`mv "${binary}" "${EXE_PATH}"`, { stdio: 'inherit' });
  }
  execSync(`chmod +x "${EXE_PATH}"`, { stdio: 'inherit' });
  console.log(`Installed: ${EXE_PATH}`);
}

function ensureBinary() {
  if (existsSync(EXE_PATH)) return;

  if (isWindows) {
    downloadWindows();
  } else {
    downloadLinux();
  }
}

function startServer() {
  if (!existsSync(CONFIG)) {
    console.error(`Missing config: ${CONFIG}`);
    process.exit(1);
  }

  console.log('Starting LiveKit server...');
  console.log(`  Config: ${CONFIG}`);
  console.log(`  Signaling: ws://0.0.0.0:7880`);
  console.log(`  API key: devkey`);
  console.log('  Allow Windows Firewall if prompted (TCP 7880-7881, UDP 7882, UDP 50000-50100)');
  console.log('');

  const child = spawn(EXE_PATH, ['--config', CONFIG, '--bind', '0.0.0.0'], {
    stdio: 'inherit',
    cwd: ROOT,
  });

  child.on('exit', (code) => process.exit(code ?? 0));
  child.on('error', (err) => {
    console.error('Failed to start LiveKit:', err.message);
    process.exit(1);
  });
}

ensureBinary();
startServer();
