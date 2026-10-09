import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  PrayerLookupQuery,
  PrayerLookupResponse,
  PrayerTimes,
} from '@ribat/shared';
import { notFound, unavailable } from '../common/errors';
import { dateIn } from '../common/zoned-time';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { ALADHAN_METHOD_ID, computePrayerTimes } from './compute';

type Place = { displayName: string; latitude: number; longitude: number };

const TIMEOUT_MS = 15_000;

/**
 * OQ-9: city → coordinates (OpenStreetMap Nominatim) → today's times from Aladhan
 * as the reference the admin approves. Only setup and settings call this;
 * session generation never leaves the server.
 */
@Injectable()
export class PrayerLookupService {
  private readonly logger = new Logger(PrayerLookupService.name);
  // ponytail: in-process cache; Nominatim allows ~1 req/s and cities don't move.
  private readonly places = new Map<string, Place>();

  constructor(@Inject(ENV) private readonly env: Env) {}

  async lookup(query: PrayerLookupQuery): Promise<PrayerLookupResponse> {
    const place = await this.geocode(query.city, query.country);
    const { timezone, times, date } = await this.aladhan(place, query.method);
    return {
      ...place,
      timezone,
      method: query.method,
      date,
      reference: times,
      computed: computePrayerTimes(
        { ...place, timezone, prayerMethod: query.method, prayerOffsets: {} },
        date,
      ),
    };
  }

  private async geocode(city: string, country?: string): Promise<Place> {
    const q = [city, country].filter(Boolean).join(', ');
    const cached = this.places.get(q.toLowerCase());
    if (cached) return cached;

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({
      q,
      format: 'json',
      limit: '1',
      'accept-language': 'ar,en',
    }).toString();
    const rows = await this.getJson<
      { lat: string; lon: string; display_name: string }[]
    >(url, 'geocoder');
    if (!rows.length) throw notFound('City');

    const place = {
      displayName: rows[0].display_name,
      latitude: Number(rows[0].lat),
      longitude: Number(rows[0].lon),
    };
    this.places.set(q.toLowerCase(), place);
    return place;
  }

  /** Today's times, and the calendar date Aladhan answered for, so both sides compare one day. */
  private async aladhan(place: Place, method: PrayerLookupQuery['method']) {
    // The dated path avoids a redirect; Aladhan reads the date in the place's own timezone.
    const [y, m, d] = dateIn(new Date(), 'UTC').split('-');
    const url = new URL(`https://api.aladhan.com/v1/timings/${d}-${m}-${y}`);
    url.search = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      method: String(ALADHAN_METHOD_ID[method]),
    }).toString();
    const body = await this.getJson<{
      data: {
        timings: Record<string, string>;
        date: { gregorian: { date: string } };
        meta: { timezone: string };
      };
    }>(url, 'prayer-time source');
    const t = body.data.timings;
    // Aladhan may append " (EEST)" to a time; keep HH:mm.
    const hm = (value: string) => value.slice(0, 5);
    const times: PrayerTimes = {
      fajr: hm(t.Fajr),
      sunrise: hm(t.Sunrise),
      dhuhr: hm(t.Dhuhr),
      asr: hm(t.Asr),
      maghrib: hm(t.Maghrib),
      isha: hm(t.Isha),
    };
    const [dd, mm, yyyy] = body.data.date.gregorian.date.split('-');
    return {
      timezone: body.data.meta.timezone,
      times,
      date: `${yyyy}-${mm}-${dd}`,
    };
  }

  /** One retry: the free services are occasionally slow, and a person is waiting on this. */
  private async getJson<T>(url: URL, label: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': `Ribat/0.1 (+${this.env.APP_URL})`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as T;
      } catch (error) {
        lastError = error;
      }
    }
    this.logger.warn(
      `${label} request failed: ${lastError instanceof Error ? lastError.message : lastError}`,
    );
    throw unavailable(
      `The ${label} is unreachable. Try again, or enter coordinates by hand.`,
    );
  }
}
