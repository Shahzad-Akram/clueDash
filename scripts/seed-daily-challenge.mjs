/**
 * Seeds the Firestore `dailyChallenge` collection from guesses-categories-expanded.json.
 * Picks 5 puzzles per category (50 total) for the daily challenge pool.
 *
 * Usage:
 *   npm run seed:daily-challenge
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';

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

const jsonPath = join(root, 'data', 'guesses-categories-expanded.json');
const { guesses } = JSON.parse(readFileSync(jsonPath, 'utf8'));

const PER_CATEGORY = 5;
const byCategory = new Map();
for (const g of guesses) {
  const cat = String(g.category ?? '').trim().toUpperCase();
  if (!cat) continue;
  if (!byCategory.has(cat)) byCategory.set(cat, []);
  byCategory.get(cat).push(g);
}

const selected = [];
let sortOrder = 1;
for (const [cat, items] of byCategory.entries()) {
  const slice = items.slice(0, PER_CATEGORY);
  for (const g of slice) {
    selected.push({
      id: `daily-${String(sortOrder).padStart(3, '0')}`,
      phrase: g.phrase,
      clue: g.clue,
      category: cat,
      clueEmoji: g.clueEmoji,
      difficulty: g.difficulty,
      sortOrder: sortOrder++,
    });
  }
}

if (selected.length === 0) {
  console.error('No puzzles selected from expanded file.');
  process.exit(1);
}

const batch = writeBatch(db);
for (const g of selected) {
  const ref = doc(db, 'dailyChallenge', g.id);
  const payload = {
    phrase: String(g.phrase ?? '').trim(),
    clue: String(g.clue ?? '').trim(),
    category: String(g.category ?? '').trim().toUpperCase(),
    sortOrder: g.sortOrder,
  };
  if (g.clueEmoji) payload.clueEmoji = String(g.clueEmoji);
  if (g.difficulty === 'easy' || g.difficulty === 'medium' || g.difficulty === 'hard') {
    payload.difficulty = g.difficulty;
  }
  batch.set(ref, payload, { merge: true });
}

await batch.commit();
console.log(`Seeded ${selected.length} documents into Firestore collection "dailyChallenge".`);
