/**
 * Deletes documents in the Firestore `guesses` collection whose IDs are NOT
 * present in `data/guesses-categories-expanded.json` (the current source of truth).
 *
 * Usage (from project root):
 *   node scripts/cleanup-stale-guesses.mjs           # dry run (lists stale docs)
 *   node scripts/cleanup-stale-guesses.mjs --delete  # actually deletes them
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadDotEnv() {
  const envPath = [join(root, '.env'), join(root, '.env.local')].find((p) => existsSync(p));
  if (!envPath) {
    console.error('Missing .env / .env.local — add Firebase EXPO_PUBLIC_* keys.');
    process.exit(1);
  }
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadDotEnv();

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

const { guesses } = JSON.parse(
  readFileSync(join(root, 'data', 'guesses-categories-expanded.json'), 'utf8'),
);
const keepIds = new Set(guesses.map((g) => g.id));
console.log(`Source of truth: ${keepIds.size} puzzle ids.`);

const snap = await getDocs(collection(db, 'guesses'));
const stale = snap.docs.filter((d) => !keepIds.has(d.id));
console.log(`Firestore "guesses" has ${snap.size} docs; ${stale.length} are stale.`);

if (stale.length === 0) {
  console.log('Nothing to delete.');
  process.exit(0);
}

for (const d of stale) {
  const x = d.data();
  console.log(`  stale: ${d.id} [${x.category ?? '?'}] ${x.phrase ?? ''}`);
}

if (!process.argv.includes('--delete')) {
  console.log('\nDry run only. Re-run with --delete to remove these documents.');
  process.exit(0);
}

// Firestore allows max 500 writes per batch.
for (let i = 0; i < stale.length; i += 500) {
  const batch = writeBatch(db);
  for (const d of stale.slice(i, i + 500)) {
    batch.delete(d.ref);
  }
  await batch.commit();
}
console.log(`Deleted ${stale.length} stale documents from "guesses".`);
