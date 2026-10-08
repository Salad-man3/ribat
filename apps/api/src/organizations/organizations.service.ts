import { ConflictException, Injectable } from '@nestjs/common';
import type {
  OrganizationResponse,
  SetupOrganizationInput,
  SetupOrganizationResponse,
  SetupStatus,
  UpdateOrganizationInput,
} from '@ribat/shared';
import { AuditService } from '../audit/audit.service';
import { IdentitiesService } from '../auth/identities.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  mergeUpdateData,
  settingsFromSetup,
  toOrganizationResponse,
} from './organization.mapper';

function slugifyName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base.length > 0 ? base : 'mosque';
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identities: IdentitiesService,
    private readonly audit: AuditService,
  ) {}

  async setupStatus(): Promise<SetupStatus> {
    const count = await this.prisma.platform.organization.count();
    return { setupRequired: count === 0 };
  }

  async setupOrganization(input: SetupOrganizationInput): Promise<SetupOrganizationResponse> {
    const existing = await this.prisma.platform.organization.count();
    if (existing > 0) {
      throw new ConflictException({
        error: { code: 'CONFLICT', message: 'Organization setup is already complete' },
      });
    }

    const slug = await this.uniqueSlug(slugifyName(input.name));
    const joinedAt = new Date();
    const settings = settingsFromSetup(input);

    const created = await this.prisma.platform.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: input.name,
          slug,
          timezone: input.timezone,
          latitude: input.latitude,
          longitude: input.longitude,
          prayerMethod: input.prayerMethod,
          settings,
        },
      });

      const identity = await this.identities.ensureIdentity(input.sheikh.phone);

      const member = await tx.member.create({
        data: {
          organizationId: organization.id,
          firstName: input.sheikh.firstName,
          fatherName: input.sheikh.fatherName,
          familyName: input.sheikh.familyName,
          birthDate: new Date('1980-01-01'),
          phone: input.sheikh.phone,
          joinedAt,
        },
      });

      const membership = await tx.membership.create({
        data: {
          organizationId: organization.id,
          identityId: identity.id,
          role: 'SHEIKH',
          memberId: member.id,
          status: 'ACTIVE',
        },
      });

      return { organization, member, membership, identityId: identity.id };
    });

    const issued = await this.identities.issueSetupCode(
      created.identityId,
      created.membership.id,
    );

    await this.audit.record(
      {
        organizationId: created.organization.id,
        actorIdentityId: null,
        actorMembershipId: null,
      },
      {
        action: 'organization.setup',
        entityType: 'organization',
        entityId: created.organization.id,
        after: { slug: created.organization.slug },
      },
    );

    return {
      organizationId: created.organization.id,
      sheikhMemberId: created.member.id,
      setupCode: issued.setupCode,
      setupCodeExpiresAt: issued.expiresAt,
    };
  }

  async getOrganization(organizationId: string): Promise<OrganizationResponse> {
    const org = await this.prisma.platform.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    return toOrganizationResponse(org);
  }

  async updateOrganization(
    organizationId: string,
    input: UpdateOrganizationInput,
  ): Promise<OrganizationResponse> {
    const current = await this.prisma.platform.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const org = await this.prisma.platform.organization.update({
      where: { id: organizationId },
      data: mergeUpdateData(input, current),
    });
    return toOrganizationResponse(org);
  }

  private async uniqueSlug(base: string): Promise<string> {
    let candidate = base;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const found = await this.prisma.platform.organization.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!found) return candidate;
      candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
    throw new ConflictException({
      error: { code: 'CONFLICT', message: 'Could not allocate organization slug' },
    });
  }
}
