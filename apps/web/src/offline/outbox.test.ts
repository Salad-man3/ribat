import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ClassKit, SyncMutationInput, SyncResponse } from '@ribat/shared';
import { ApiError } from '../api/api-fetch';
import { OfflineDb } from './db';
import { enqueue, flush, localIso, newIdempotencyKey } from './outbox';

const ME = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const enrollment = (n: number) => `33333333-3333-4333-8333-33333333333${n}`;

const kit = (memberId = ME): ClassKit => ({
  kitVersion: 'v1',
  generatedAt: new Date().toISOString(),
  date: '2026-10-15',
  timezone: 'Asia/Damascus',
  memberId,
  sessions: [],
  materials: [],
  positions: [],
  todayLogs: [],
  explanationProgress: [],
  recitationKinds: [],
  memberHifzMaps: [],
});

const markDraft = (n: number, status: 'PRESENT' | 'ABSENT' = 'PRESENT') => ({
  type: 'attendance.mark' as const,
  payload: { sessionId: SESSION, enrollmentId: enrollment(n), status },
});

let store: OfflineDb;
let sent: SyncMutationInput[][];

const answer =
  (status: (m: SyncMutationInput) => SyncResponse['results'][number]['status']) =>
  async (mutations: SyncMutationInput[]): Promise<SyncResponse> => {
    sent.push(mutations);
    return { results: mutations.map((m) => ({ idempotencyKey: m.idempotencyKey, status: status(m) })) };
  };

beforeEach(async () => {
  store = new OfflineDb(`test-${crypto.randomUUID()}`);
  await store.kit.put({ id: 'current', kit: kit() });
  sent = [];
});

describe('outbox', () => {
  it('builds a UUID when randomUUID is missing (plain HTTP)', () => {
    const orig = crypto.randomUUID;
    // @ts-expect-error simulate insecure origin
    crypto.randomUUID = undefined;
    try {
      expect(newIdempotencyKey()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    } finally {
      crypto.randomUUID = orig;
    }
  });

  it('stamps device time with its offset', () => {
    expect(localIso(new Date())).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  });

  it('refuses a payload the API would refuse, before it is queued (SYNC-07)', async () => {
    await expect(
      enqueue({ type: 'attendance.mark', payload: { sessionId: 'nope', enrollmentId: enrollment(1), status: 'PRESENT' } }, store),
    ).rejects.toThrow();
    expect(await store.outbox.count()).toBe(0);
  });

  it('replays in tap order and clears what the server applied', async () => {
    const a = await enqueue(markDraft(1), store);
    const b = await enqueue(markDraft(2), store);
    const c = await enqueue(markDraft(3), store);
    expect(await flush(store, answer(() => 'applied'))).toBe('ok');
    expect(sent[0].map((m) => m.idempotencyKey)).toEqual([a, b, c].map((e) => e.idempotencyKey));
    expect(await store.outbox.count()).toBe(0);
    expect((await store.meta.get('lastSyncedAt'))?.value).toEqual(expect.any(Number));
  });

  it('keeps the queue and the same keys through a network failure (SYNC-06)', async () => {
    const entry = await enqueue(markDraft(1), store);
    const offline = async () => {
      throw new TypeError('Failed to fetch');
    };
    expect(await flush(store, offline)).toBe('offline');
    expect(await flush(store, answer(() => 'duplicate'))).toBe('ok');
    expect(sent[0][0].idempotencyKey).toBe(entry.idempotencyKey);
    expect(await store.outbox.count()).toBe(0);
  });

  it('keeps the queue when the session expired, and asks for the password (SYNC-15)', async () => {
    await enqueue(markDraft(1), store);
    const expired = async () => {
      throw new ApiError({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);
    };
    expect(await flush(store, expired)).toBe('needs-login');
    expect(await store.outbox.count()).toBe(1);
    expect((await store.meta.get('needsLogin'))?.value).toBe(true);
  });

  it('moves superseded and rejected entries to the conflict list, never drops them (SYNC-13)', async () => {
    const lost = await enqueue(markDraft(1, 'ABSENT'), store);
    const refused = await enqueue(markDraft(2), store);
    await enqueue(markDraft(3), store);
    await flush(
      store,
      answer((m) =>
        m.idempotencyKey === lost.idempotencyKey
          ? 'superseded'
          : m.idempotencyKey === refused.idempotencyKey
            ? 'rejected'
            : 'applied',
      ),
    );
    expect(await store.outbox.count()).toBe(0);
    const results = await store.results.toArray();
    expect(results.map((r) => r.status).sort()).toEqual(['rejected', 'superseded']);
  });

  it("does not replay another person's queue under the current login", async () => {
    await enqueue(markDraft(1), store);
    await store.kit.put({ id: 'current', kit: kit('44444444-4444-4444-8444-444444444444') });
    expect(await flush(store, answer(() => 'applied'))).toBe('idle');
    expect(await store.outbox.count()).toBe(1);
  });

  it('a queue written by schema version 1 survives a reopen and replays (SYNC-05)', async () => {
    await enqueue(markDraft(1), store);
    store.close();
    const reopened = new OfflineDb(store.name);
    expect(await flush(reopened, answer(() => 'applied'))).toBe('ok');
    expect(sent[0]).toHaveLength(1);
  });
});
