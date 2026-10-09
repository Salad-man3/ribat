import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  OrgPrayerTimesQuerySchema,
  PrayerLookupQuerySchema,
  type OrgPrayerTimesQuery,
  type OrgPrayerTimesResponse,
  type PrayerLookupQuery,
} from '@ribat/shared';
import {
  CurrentOrg,
  OrgRoute,
  type OrgContext,
} from '../auth/org-context.guard';
import { conflict } from '../common/errors';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { dateIn } from '../common/zoned-time';
import { toOrganizationResponse } from '../organizations/organization.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { computePrayerTimes } from './compute';
import { PrayerLookupService } from './prayer-lookup.service';

@Controller()
export class PrayerTimesController {
  constructor(
    private readonly lookupService: PrayerLookupService,
    private readonly prisma: PrismaService,
  ) {}

  /** First-run setup (WF-01): open until the first organization exists. */
  @Get('setup/prayer-times/lookup')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async setupLookup(
    @Query(createZodValidationPipe(PrayerLookupQuerySchema))
    query: PrayerLookupQuery,
  ) {
    if ((await this.prisma.platform.organization.count()) > 0) {
      throw conflict('Organization setup is already complete');
    }
    return this.lookupService.lookup(query);
  }

  @Get('prayer-times/lookup')
  @OrgRoute('organization.manage')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  lookup(
    @Query(createZodValidationPipe(PrayerLookupQuerySchema))
    query: PrayerLookupQuery,
  ) {
    return this.lookupService.lookup(query);
  }

  /** The org's own times for a day, offsets applied. Any member may read them. */
  @Get('organization/prayer-times')
  @OrgRoute()
  async orgPrayerTimes(
    @CurrentOrg() org: OrgContext,
    @Query(createZodValidationPipe(OrgPrayerTimesQuerySchema))
    query: OrgPrayerTimesQuery,
  ): Promise<OrgPrayerTimesResponse> {
    const row = await this.prisma.platform.organization.findUniqueOrThrow({
      where: { id: org.organizationId },
    });
    const settings = toOrganizationResponse(row);
    const date = query.date ?? dateIn(new Date(), settings.timezone);
    return {
      date,
      timezone: settings.timezone,
      times: computePrayerTimes(settings, date),
    };
  }
}
