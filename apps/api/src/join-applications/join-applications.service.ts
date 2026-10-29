import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ApproveJoinApplicationResponse,
  CreateJoinApplicationInput,
  JoinApplicationResponse,
  ListJoinApplicationsQuery,
  MemberAccessGap,
  PublicOrganizationJoinInfo,
} from '@ribat/shared';
import { JoinApplicationWardSchema } from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import type { OrgContext } from '../auth/org-context.guard';
import { fromDateString, toDateString } from '../common/zoned-time';
import { GuardiansService } from '../guardians/guardians.service';
import { MembersService } from '../members/members.service';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { toJoinApplicationResponse } from './join-application.mapper';

function notFound(): NotFoundException {
  return new NotFoundException({
    error: { code: 'NOT_FOUND', message: 'Application not found' },
  });
}

@Injectable()
export class JoinApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
    private readonly memberships: MembershipsService,
    private readonly guardians: GuardiansService,
    private readonly audit: AuditService,
  ) {}

  async createPublic(
    organizationId: string,
    input: CreateJoinApplicationInput,
  ): Promise<JoinApplicationResponse> {
    const pending = await this.prisma.platform.joinApplication.findFirst({
      where: { organizationId, phone: input.phone, status: 'PENDING' },
    });
    if (pending) {
      throw new ConflictException({
        error: { code: 'CONFLICT', message: 'An application is already pending for this phone' },
      });
    }

    const row = await this.prisma.forOrganization(organizationId).joinApplication.create({
      data: {
        organizationId,
        kind: input.kind,
        phone: input.phone,
        firstName: input.firstName,
        fatherName: input.fatherName,
        familyName: input.familyName,
        birthDate:
          input.kind === 'STUDENT' ? fromDateString(input.birthDate) : undefined,
        wards: input.kind === 'GUARDIAN' ? input.wards : undefined,
      },
    });
    return toJoinApplicationResponse(row);
  }

  async list(
    organizationId: string,
    query: ListJoinApplicationsQuery,
  ): Promise<JoinApplicationResponse[]> {
    const rows = await this.prisma.forOrganization(organizationId).joinApplication.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(toJoinApplicationResponse);
  }

  async joinInfo(organizationId: string): Promise<PublicOrganizationJoinInfo> {
    const org = await this.prisma.platform.organization.findFirst({
      where: { id: organizationId, status: 'ACTIVE' },
      select: { slug: true, name: true },
    });
    if (!org) throw notFound();
    return { slug: org.slug, name: org.name };
  }

  async listAccessGaps(organizationId: string): Promise<MemberAccessGap[]> {
    const db = this.prisma.forOrganization(organizationId);
    const members = await db.member.findMany({
      where: { status: 'ACTIVE', phone: { not: null } },
      select: {
        id: true,
        firstName: true,
        fatherName: true,
        familyName: true,
        phone: true,
      },
      take: 500,
    });
    if (members.length === 0) return [];

    const memberIds = members.map((m) => m.id);
    const phones = [...new Set(members.map((m) => m.phone!).filter(Boolean))];

    const [memberships, identities] = await Promise.all([
      this.prisma.platform.membership.findMany({
        where: {
          organizationId,
          memberId: { in: memberIds },
          status: 'ACTIVE',
        },
        select: { memberId: true, identityId: true },
      }),
      this.prisma.platform.identity.findMany({
        where: { phone: { in: phones } },
        select: { phone: true, passwordHash: true },
      }),
    ]);

    const membershipByMember = new Map(
      memberships.filter((m) => m.memberId).map((m) => [m.memberId!, m]),
    );
    const identityByPhone = new Map(identities.map((i) => [i.phone, i]));

    const gaps: MemberAccessGap[] = [];
    for (const member of members) {
      const phone = member.phone!;
      const membership = membershipByMember.get(member.id);
      if (!membership) {
        gaps.push({
          memberId: member.id,
          firstName: member.firstName,
          fatherName: member.fatherName,
          familyName: member.familyName,
          phone,
          reason: 'NO_MEMBERSHIP',
        });
        continue;
      }
      const identity = identityByPhone.get(phone);
      if (!identity?.passwordHash) {
        gaps.push({
          memberId: member.id,
          firstName: member.firstName,
          fatherName: member.fatherName,
          familyName: member.familyName,
          phone,
          reason: 'SETUP_PENDING',
        });
      }
    }
    return gaps;
  }

  async resolvePublicOrg(slug: string): Promise<{ organizationId: string; info: PublicOrganizationJoinInfo }> {
    const org = await this.prisma.platform.organization.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: { id: true, slug: true, name: true },
    });
    if (!org) throw notFound();
    return {
      organizationId: org.id,
      info: { slug: org.slug, name: org.name },
    };
  }

  async reject(
    organizationId: string,
    id: string,
    actor: OrgContext,
    auditCtx: AuditContext,
  ): Promise<JoinApplicationResponse> {
    const row = await this.findPending(organizationId, id);
    await this.prisma.forOrganization(organizationId).joinApplication.updateMany({
      where: { id },
      data: {
        status: 'REJECTED',
        decidedAt: new Date(),
        decidedByMembershipId: actor.membershipId,
      },
    });
    const after = await this.find(organizationId, id);
    await this.audit.record(auditCtx, {
      action: 'join_application.rejected',
      entityType: 'join_application',
      entityId: id,
      before: toJoinApplicationResponse(row),
      after: toJoinApplicationResponse(after),
    });
    return toJoinApplicationResponse(after);
  }

  async approve(
    organizationId: string,
    id: string,
    actor: OrgContext,
    auditCtx: AuditContext,
  ): Promise<ApproveJoinApplicationResponse> {
    const app = await this.findPending(organizationId, id);
    const joinedAt = toDateString(new Date());

    let memberId: string;
    if (app.kind === 'STUDENT') {
      if (!app.birthDate) throw notFound();
      const member = await this.members.create(organizationId, {
        firstName: app.firstName,
        fatherName: app.fatherName,
        familyName: app.familyName,
        birthDate: app.birthDate.toISOString().slice(0, 10),
        joinedAt,
        phone: app.phone,
      }, auditCtx);
      memberId = member.id;
    } else {
      const wards = JoinApplicationWardSchema.array().parse(app.wards);
      const guardian = await this.members.create(organizationId, {
        firstName: app.firstName,
        fatherName: app.fatherName,
        familyName: app.familyName,
        birthDate: joinedAt,
        joinedAt,
        phone: app.phone,
      }, auditCtx);
      memberId = guardian.id;
      for (const ward of wards) {
        const wardMember = await this.members.create(organizationId, {
          firstName: ward.firstName,
          fatherName: ward.fatherName,
          familyName: ward.familyName,
          birthDate: ward.birthDate,
          joinedAt,
        }, auditCtx);
        await this.guardians.create(
          organizationId,
          wardMember.id,
          {
            mode: 'existing',
            guardianMemberId: guardian.id,
            relation: ward.relation,
            isPrimary: true,
          },
          auditCtx,
        );
      }
    }

    const role = app.kind === 'GUARDIAN' ? 'GUARDIAN' : 'MEMBER';
    const access = await this.memberships.grantMemberAccess(
      organizationId,
      memberId,
      actor,
      role,
      auditCtx,
    );

    await this.prisma.forOrganization(organizationId).joinApplication.updateMany({
      where: { id },
      data: {
        status: 'APPROVED',
        decidedAt: new Date(),
        decidedByMembershipId: actor.membershipId,
      },
    });

    const application = toJoinApplicationResponse(await this.find(organizationId, id));
    await this.audit.record(auditCtx, {
      action: 'join_application.approved',
      entityType: 'join_application',
      entityId: id,
      after: { applicationId: id, memberId, role },
    });

    return { application, memberId, access };
  }

  private async findPending(organizationId: string, id: string) {
    const row = await this.prisma.forOrganization(organizationId).joinApplication.findFirst({
      where: { id, status: 'PENDING' },
    });
    if (!row) throw notFound();
    return row;
  }

  private async find(organizationId: string, id: string) {
    const row = await this.prisma.forOrganization(organizationId).joinApplication.findFirst({
      where: { id },
    });
    if (!row) throw notFound();
    return row;
  }
}
