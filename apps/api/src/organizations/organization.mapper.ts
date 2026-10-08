import type { Organization, Prisma } from '@prisma/client';
import type {
  OrganizationResponse,
  PrayerMethod,
  PrayerOffsets,
  UpdateOrganizationInput,
} from '@ribat/shared';
import { PrayerMethodSchema, PrayerOffsetsSchema } from '@ribat/shared';

type OrganizationSettings = {
  locale?: 'ar' | 'en';
  pointsEnabled?: boolean;
  memberLimit?: number | null;
};

function readSettings(raw: Prisma.JsonValue): OrganizationSettings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  return raw as OrganizationSettings;
}

export function toOrganizationResponse(org: Organization): OrganizationResponse {
  const settings = readSettings(org.settings);
  const prayerOffsets = PrayerOffsetsSchema.safeParse(org.prayerOffsets).success
    ? (org.prayerOffsets as PrayerOffsets)
    : {};
  const prayerMethod = PrayerMethodSchema.safeParse(org.prayerMethod).success
    ? (org.prayerMethod as PrayerMethod)
    : 'MuslimWorldLeague';

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    status: org.status,
    timezone: org.timezone,
    latitude: Number(org.latitude),
    longitude: Number(org.longitude),
    prayerMethod,
    prayerOffsets,
    locale: settings.locale ?? 'ar',
    pointsEnabled: settings.pointsEnabled ?? false,
    memberLimit: settings.memberLimit ?? null,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

export function settingsFromSetup(input: {
  locale: 'ar' | 'en';
  memberLimit?: number;
}): OrganizationSettings {
  return {
    locale: input.locale,
    pointsEnabled: false,
    memberLimit: input.memberLimit ?? null,
  };
}

export function mergeUpdateData(
  input: UpdateOrganizationInput,
  current: Organization,
): Prisma.OrganizationUpdateInput {
  const settings = readSettings(current.settings);
  const nextSettings: OrganizationSettings = { ...settings };
  if (input.locale !== undefined) nextSettings.locale = input.locale;
  if (input.pointsEnabled !== undefined) nextSettings.pointsEnabled = input.pointsEnabled;

  const data: Prisma.OrganizationUpdateInput = { settings: nextSettings };
  if (input.name !== undefined) data.name = input.name;
  if (input.timezone !== undefined) data.timezone = input.timezone;
  if (input.latitude !== undefined) data.latitude = input.latitude;
  if (input.longitude !== undefined) data.longitude = input.longitude;
  if (input.prayerMethod !== undefined) data.prayerMethod = input.prayerMethod;
  if (input.prayerOffsets !== undefined) data.prayerOffsets = input.prayerOffsets;
  return data;
}
