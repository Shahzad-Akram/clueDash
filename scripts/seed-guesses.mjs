/**
 * Uploads `data/guesses.json` into Firestore collection `guesses`.
 *
 * Usage (from project root):
 *   npm run seed:guesses
 *
 * Requires `.env` with EXPO_PUBLIC_FIREBASE_* keys and Firestore rules that allow writes
 * (e.g. temporarily `allow write: if true` in dev — lock down before production).
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadDotEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) {
    console.error('Missing .env — copy .env.example to .env and add Firebase keys.');
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

const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missing = requiredKeys.filter((k) => !firebaseConfig[k]);
if (missing.length) {
  console.error('Missing env for keys:', missing.join(', '));
  process.exit(1);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

const dataFileArg = process.argv[2];
const jsonPath = dataFileArg
  ? join(root, dataFileArg.replace(/^[/\\]/, ''))
  : join(root, 'data', 'guesses.json');
const { guesses } = JSON.parse(readFileSync(jsonPath, 'utf8'));
console.log(`Reading ${jsonPath}`);

if (!Array.isArray(guesses) || guesses.length === 0) {
  console.error('data/guesses.json must contain a non-empty "guesses" array.');
  process.exit(1);
}

if (guesses.length > 500) {
  console.error('At most 500 guesses per batch.');
  process.exit(1);
}

const batch = writeBatch(db);
for (let i = 0; i < guesses.length; i++) {
  const g = guesses[i];
  const id = typeof g.id === 'string' && g.id.length > 0 ? g.id : `guess-${String(i + 1).padStart(3, '0')}`;
  const ref = doc(db, 'guesses', id);
  const payload = {
    phrase: String(g.phrase ?? '').trim(),
    clue: String(g.clue ?? '').trim(),
    category: String(g.category ?? '').trim().toUpperCase(),
    sortOrder: Number(g.sortOrder ?? i + 1),
  };
  if (g.clueEmoji != null && String(g.clueEmoji).length > 0) {
    payload.clueEmoji = String(g.clueEmoji);
  }
  if (g.difficulty === 'easy' || g.difficulty === 'medium' || g.difficulty === 'hard') {
    payload.difficulty = g.difficulty;
  }
  batch.set(ref, payload, { merge: true });
}

await batch.commit();
console.log(`Seeded ${guesses.length} documents into Firestore collection "guesses".`);
