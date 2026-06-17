/**
 * Creates EAS secrets from .env.local for production builds.
 * Skips AdMob test unit ID overrides so app.json production ad units are used.
 *
 * Usage:
 *   node scripts/setup-eas-secrets.mjs
 *   node scripts/setup-eas-secrets.mjs --dry-run
 */
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

const envPath = [join(root, '.env'), join(root, '.env.local')].find((p) => existsSync(p));
if (!envPath) {
  console.error('Missing .env / .env.local');
  process.exit(1);
}

const SKIP_KEYS = new Set([
  'EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_UNIT_ID',
  'EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_UNIT_ID',
]);

const ALLOWED_PREFIXES = ['EXPO_PUBLIC_FIREBASE_', 'EXPO_PUBLIC_PRIVACY_POLICY_URL'];

const vars = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  const key = t.slice(0, eq).trim();
  let val = t.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (SKIP_KEYS.has(key)) {
    console.log(`Skipping ${key} (use app.json production AdMob IDs in production builds)`);
    continue;
  }
  if (!ALLOWED_PREFIXES.some((p) => key.startsWith(p) || key === p)) {
    continue;
  }
  if (!val) continue;
  vars[key] = val;
}

const keys = Object.keys(vars);
if (keys.length === 0) {
  console.error('No Firebase / privacy env vars found to upload.');
  process.exit(1);
}

console.log(`Uploading ${keys.length} EAS secret(s) from ${envPath}...`);

for (const key of keys) {
  const args = [
    'env:create',
    'production',
    '--name',
    key,
    '--value',
    vars[key],
    '--type',
    'string',
    '--visibility',
    'plaintext',
    '--environment',
    'production',
    '--force',
    '--non-interactive',
  ];
  if (dryRun) {
    console.log(`[dry-run] eas ${args.join(' ').replace(vars[key], '***')}`);
    continue;
  }
  const result = spawnSync('npx', ['eas-cli', ...args], { stdio: 'inherit', cwd: root });
  if (result.status !== 0) {
    console.error(`Failed to create secret: ${key}`);
    process.exit(result.status ?? 1);
  }
}

console.log(dryRun ? 'Dry run complete.' : 'EAS secrets created. Production builds will embed Firebase config.');
