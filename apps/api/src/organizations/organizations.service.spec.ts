import { ConflictException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { IdentitiesService } from '../auth/identities.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  it('setupOrganization rejects when an organization already exists', async () => {
    const prisma = {
      platform: {
        organization: { count: jest.fn().mockResolvedValue(1) },
      },
    } as unknown as PrismaService;
    const service = new OrganizationsService(
      prisma,
      {} as IdentitiesService,
      {} as AuditService,
    );

    await expect(
      service.setupOrganization({
        name: 'Test Mosque',
        timezone: 'Asia/Damascus',
        latitude: 33.5,
        longitude: 36.3,
        prayerMethod: 'UmmAlQura',
        locale: 'ar',
        sheikh: {
          firstName: 'Ahmad',
          fatherName: 'Hassan',
          familyName: 'Ali',
          phone: '+963944000001',
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
