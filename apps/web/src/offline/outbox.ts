import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import {
  SYNC_BATCH_LIMIT,
  SyncMutationSchema,
  type ClassKit,
  type SyncMutationInput,
  type SyncResponse,
} from '@ribat/shared';
import { ApiError, apiFetch } from '../api/api-fetch';
import { db, type OfflineDb, type OutboxEntry } from './db';

/** SYNC-03: the kit is good for a class, not for days. Older than this, warn but keep accepting writes. */
export const KIT_STALE_MS = 24 * 60 * 60 * 1000;

/** Device time with its UTC offset, e.g. 2026-10-15T15:04:11+03:00. */
export function localIso(date = new Date()): string {
  const offset = -date.getTimezoneOffset();
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const local = new Date(date.getTime() + offset * 60_000).toISOString().slice(0, 19);
  return `${local}${offset >= 0 ? '+' : '-'}${pad(offset / 60)}:${pad(offset % 60)}`;
}

type Draft = Pick<SyncMutationInput, 'type' | 'payload'>;

/**
 * Queues one write. The idempotency key is made here, once, at the tap (SYNC-06), and the
 * payload is checked with the API's own schema before it waits in a queue (SYNC-07).
 * Throws a ZodError for an invalid payload.
 */
export async function enqueue(draft: Draft, store: OfflineDb = db): Promise<OutboxEntry> {
  const row = await store.kit.get('current');
  if (!row) throw new Error('No class kit on this device');
  const mutation = SyncMutationSchema.parse({
    ...draft,
    idempotencyKey: crypto.randomUUID(),
    capturedAt: localIso(),
  });
  const entry: OutboxEntry = { ...mutation, queuedAt: Date.now(), ownerMemberId: row.kit.memberId };
  await store.outbox.add(entry);
  if (store === db && navigator.onLine) void syncNow();
  return entry;
}

export type FlushOutcome = 'idle' | 'ok' | 'offline' | 'needs-login';

/**
 * Replays the queue in tap order (SYNC-08), 200 at a time. Applied and duplicate entries leave
 * the queue; superseded and rejected ones move to `results` for the banner. Nothing is dropped
 * on a network failure or an expired session (SYNC-15) — the queue simply waits.
 */
export async function flush(
  store: OfflineDb = db,
  send: (mutations: SyncMutationInput[]) => Promise<SyncResponse> = postMutations,
): Promise<FlushOutcome> {
  const kit = await store.kit.get('current');
  const queued = (await store.outbox.orderBy('queuedAt').toArray()).filter(
    (e) => e.ownerMemberId === kit?.kit.memberId,
  );
  if (queued.length === 0) return 'idle';

  for (let i = 0; i < queued.length; i += SYNC_BATCH_LIMIT) {
    const chunk = queued.slice(i, i + SYNC_BATCH_LIMIT);
    let response: SyncResponse;
    try {
      response = await send(chunk.map(({ queuedAt: _q, ownerMemberId: _o, ...mutation }) => mutation));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await store.meta.put({ key: 'needsLogin', value: true });
        return 'needs-login';
      }
      return 'offline';
    }
    const byKey = new Map(chunk.map((e) => [e.idempotencyKey, e]));
    await store.transaction('rw', store.outbox, store.results, async () => {
      for (const result of response.results) {
        const entry = byKey.get(result.idempotencyKey);
        if (!entry) continue;
        await store.outbox.delete(result.idempotencyKey);
        if (result.status === 'superseded' || result.status === 'rejected')
          await store.results.put({
            idempotencyKey: entry.idempotencyKey,
            type: entry.type,
            payload: entry.payload,
            status: result.status,
            error: result.error,
            server: result.server,
            at: Date.now(),
          });
      }
    });
  }
  await store.meta.bulkPut([
    { key: 'lastSyncedAt', value: Date.now() },
    { key: 'needsLogin', value: false },
  ]);
  return 'ok';
}

function postMutations(mutations: SyncMutationInput[]): Promise<SyncResponse> {
  return apiFetch<SyncResponse>('/api/v1/sync/mutations', {
    method: 'POST',
    body: JSON.stringify({ mutations }),
  });
}

/** Fetches a fresh kit. When the date rolls, yesterday's kit is kept alongside. */
export async function refreshKit(store: OfflineDb = db): Promise<ClassKit> {
  const kit = await apiFetch<ClassKit>('/api/v1/class-kit');
  const old = await store.kit.get('current');
  const previous = old && old.kit.date !== kit.date ? old.kit : old?.previous;
  await store.kit.put({ id: 'current', kit, previous });
  return kit;
}

let inFlight: Promise<FlushOutcome> | null = null;

/** One sync at a time; then a fresh kit so the screen shows server truth (decision 9.4). */
export function syncNow(): Promise<FlushOutcome> {
  inFlight ??= (async () => {
    // A kit first, so entries are matched to whoever is signed in now.
    await refreshKit().catch(() => undefined);
    const outcome = await flush();
    if (outcome === 'ok') await refreshKit().catch(() => undefined);
    return outcome;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Sync on open, on reconnect, and every 30 seconds while online. */
export function useBackgroundSync() {
  useEffect(() => {
    const run = () => {
      if (navigator.onLine) void syncNow();
    };
    run();
    window.addEventListener('online', run);
    const timer = window.setInterval(run, 30_000);
    return () => {
      window.removeEventListener('online', run);
      window.clearInterval(timer);
    };
  }, []);
}

/** A Dexie query that re-renders when its tables change. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({ next: setValue, error: console.error });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
