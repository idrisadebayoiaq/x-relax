import type { Sound } from '@/types/database';

const DB_NAME = 'xrelax-offline';
const DB_VERSION = 1;
const STORE = 'sounds';

type StoredSound = {
  soundId: string;
  blob: Blob;
  meta: Pick<Sound, 'id' | 'title' | 'cover_url' | 'duration_seconds' | 'description'>;
  savedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'soundId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

export async function saveOfflineSound(sound: Sound, blob: Blob) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      soundId: sound.id,
      blob,
      meta: {
        id: sound.id,
        title: sound.title,
        cover_url: sound.cover_url,
        duration_seconds: sound.duration_seconds,
        description: sound.description,
      },
      savedAt: new Date().toISOString(),
    } satisfies StoredSound);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getOfflineAudioUrl(soundId: string): Promise<string | null> {
  const db = await openDb();
  const row = await new Promise<StoredSound | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(soundId);
    req.onsuccess = () => resolve(req.result as StoredSound | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  if (!row?.blob) return null;
  return URL.createObjectURL(row.blob);
}

export async function hasOfflineSound(soundId: string): Promise<boolean> {
  const db = await openDb();
  const row = await new Promise<StoredSound | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(soundId);
    req.onsuccess = () => resolve(req.result as StoredSound | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return !!row;
}

export async function listOfflineSounds(): Promise<Sound[]> {
  const db = await openDb();
  const rows = await new Promise<StoredSound[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as StoredSound[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows.map((row) => ({
    ...(row.meta as Sound),
    audio_url: null,
    audio_path: null,
    creator_id: null,
    status: 'published',
    play_count: 0,
    favourite_count: 0,
    average_rating: null,
    rating_count: 0,
    is_premium_only: false,
    is_featured: false,
    created_at: row.savedAt,
    updated_at: row.savedAt,
  }));
}

export async function removeOfflineSound(soundId: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(soundId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
