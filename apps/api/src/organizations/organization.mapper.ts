import type { Organization, Prisma } from '@prisma/client';
import type {
  OrganizationResponse,
  PrayerMethod,
  PrayerOffsets,
  S1Permission,
  UpdateOrganizationInput,
} from '@ribat/shared';
import {
  PrayerMethodSchema,
  PrayerOffsetsSchema,
  S1PermissionSchema,
  STAFF_ADMIN_PERMISSIONS,
} from '@ribat/shared';

type OrganizationSettings = {
  locale?: 'ar' | 'en';
  pointsEnabled?: boolean;
  tagsEnabled?: boolean;
  orgAdminPermissions?: S1Permission[];
  memberLimit?: number | null;
  whatsappSetupTemplate?: string | null;
};

export function readOrganizationSettings(raw: Prisma.JsonValue): OrganizationSettings {
  return readSettings(raw);
}

function readSettings(raw: Prisma.JsonValue): OrganizationSettings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  return raw as OrganizationSettings;
}

export function orgAdminPermissionsFromSettings(
  raw: Prisma.JsonValue,
): S1Permission[] | null {
  const settings = readSettings(raw);
  if (settings.orgAdminPermissions === undefined) {
    return null;
  }
  return S1PermissionSchema.array().parse(settings.orgAdminPermissions);
}

export function toOrganizationResponse(org: Organization): OrganizationResponse {
  const settings = readSettings(org.settings);
  const prayerOffsets = PrayerOffsetsSchema.safeParse(org.prayerOffsets).success
    ? (org.prayerOffsets as PrayerOffsets)
    : {};
  const prayerMethod = PrayerMethodSchema.safeParse(org.prayerMethod).success
    ? (org.prayerMethod as PrayerMethod)
    : 'MuslimWorldLeague';
  const orgAdminPermissions =
    orgAdminPermissionsFromSettings(org.settings) ?? [...STAFF_ADMIN_PERMISSIONS];

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
    tagsEnabled: settings.tagsEnabled ?? false,
    orgAdminPermissions,
    memberLimit: settings.memberLimit ?? null,
    whatsappSetupTemplate: settings.whatsappSetupTemplate ?? null,
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
  if (input.tagsEnabled !== undefined) nextSettings.tagsEnabled = input.tagsEnabled;
  if (input.orgAdminPermissions !== undefined) {
    nextSettings.orgAdminPermissions = input.orgAdminPermissions;
  }
  if (input.whatsappSetupTemplate !== undefined) {
    nextSettings.whatsappSetupTemplate = input.whatsappSetupTemplate;
  }

  const data: Prisma.OrganizationUpdateInput = { settings: nextSettings };
  if (input.name !== undefined) data.name = input.name;
  if (input.timezone !== undefined) data.timezone = input.timezone;
  if (input.latitude !== undefined) data.latitude = input.latitude;
  if (input.longitude !== undefined) data.longitude = input.longitude;
  if (input.prayerMethod !== undefined) data.prayerMethod = input.prayerMethod;
  if (input.prayerOffsets !== undefined) data.prayerOffsets = input.prayerOffsets;
  return data;
}
