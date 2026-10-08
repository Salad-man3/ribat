import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { MembersService } from './members.service';
import { MembersRepository } from './members.repository';

const audit = { record: jest.fn() } as unknown as AuditService;
const households = { siblingIds: jest.fn().mockResolvedValue([]) } as unknown as import('../households/households.service').HouseholdsService;
const auditCtx = {
    organizationId: '11111111-1111-1111-1111-111111111111',
    actorIdentityId: '33333333-3333-3333-3333-333333333333',
    actorMembershipId: '44444444-4444-4444-4444-444444444444',
};

describe('MembersService', () => {
    const organizationId = '11111111-1111-1111-1111-111111111111';
    const memberId = '22222222-2222-2222-2222-222222222222';

    const member = {
        id: memberId,
        organizationId,
        householdId: null,
        firstName: 'Ahmad',
        fatherName: 'Hassan',
        familyName: 'Ali',
        motherName: null,
        birthDate: new Date('2015-03-01'),
        phone: null,
        address: null,
        schoolGrade: null,
        schoolName: null,
        joinedAt: new Date('2024-09-01'),
        notes: null,
        status: 'ACTIVE' as const,
        createdAt: new Date('2024-09-01T10:00:00.000Z'),
        updatedAt: new Date('2024-09-01T10:00:00.000Z'),
        archivedAt: null,
    };

    it('getById throws 404 for missing member', async () => {
        const repository = {
            findById: jest.fn().mockResolvedValue(null),
        } as unknown as MembersRepository;

        const service = new MembersService(repository, audit, households);

        await expect(service.getById(organizationId, memberId)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('archive returns archived member', async () => {
        const repository = {
            findById: jest.fn().mockResolvedValue(member),
            archive: jest.fn().mockResolvedValue({
                ...member,
                status: 'ARCHIVED',
                archivedAt: new Date('2024-09-02T10:00:00.000Z'),
            }),
        } as unknown as MembersRepository;

        const service = new MembersService(repository, audit, households);
        const result = await service.archive(organizationId, memberId, auditCtx);

        expect(result.status).toBe('ARCHIVED');
        expect(result.archivedAt).not.toBeNull();
    });
});