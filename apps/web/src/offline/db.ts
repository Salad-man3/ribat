import Dexie, { type EntityTable } from 'dexie';
import type { ClassKit, SyncMutationInput, SyncResult } from '@ribat/shared';

/** A queued write. `ownerMemberId` stops a second person on the same phone replaying it as themselves. */
export type OutboxEntry = SyncMutationInput & {
  queuedAt: number;
  ownerMemberId: string;
};

/** A superseded or rejected write, kept for the conflict banner until dismissed (SYNC-13). */
export type ResultEntry = {
  idempotencyKey: string;
  type: SyncMutationInput['type'];
  payload: SyncMutationInput['payload'];
  status: 'superseded' | 'rejected';
  error?: SyncResult['error'];
  server?: SyncResult['server'];
  at: number;
};

/**
 * `previous` keeps yesterday's kit after a refresh rolls the date, so a class that runs past
 * midnight does not lose its roster mid-session (05-offline-sync §8).
 */
export type KitRow = { id: 'current'; kit: ClassKit; previous?: ClassKit };

export type MetaRow = { key: 'lastSyncedAt' | 'needsLogin'; value: number | boolean };

/** 05-offline-sync §3. SYNC-05: any change here ships a new `version()` and a replay test. */
export class OfflineDb extends Dexie {
  kit!: EntityTable<KitRow, 'id'>;
  outbox!: EntityTable<OutboxEntry, 'idempotencyKey'>;
  results!: EntityTable<ResultEntry, 'idempotencyKey'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'ribat-offline') {
    super(name);
    this.version(1).stores({
      kit: 'id',
      outbox: 'idempotencyKey, queuedAt',
      results: 'idempotencyKey, at',
      meta: 'key',
    });
  }
}

export const db = new OfflineDb();
