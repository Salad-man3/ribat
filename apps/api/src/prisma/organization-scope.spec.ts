import { applyOrganizationScope, TenantScopeError } from './organization-scope';

const ORG = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

describe('applyOrganizationScope', () => {
    it('leaves a platform model unchanged', () => {
        const args = { where: { phone: '+10000000000' } };

        expect(applyOrganizationScope('Identity', 'findMany', args, undefined)).toBe(args);
    });

    it('adds organizationId to a tenant where', () => {
        const scoped = applyOrganizationScope(
            'Member',
            'findMany',
            { where: { status: 'ACTIVE' }, take: 20 },
            ORG,
        );

        expect(scoped.where).toEqual({ status: 'ACTIVE', organizationId: ORG });
        expect(scoped.take).toBe(20);
    });

    it('scopes an empty where', () => {
        const args: { where?: Record<string, unknown> } = {};
        const scoped = applyOrganizationScope('Member', 'findFirst', args, ORG);

        expect(scoped.where).toEqual({ organizationId: ORG });
    });
    it('sets organizationId on create data and keeps the other fields', () => {
        const scoped = applyOrganizationScope(
            'Member',
            'create',
            { data: { firstName: 'Ahmad' } },
            ORG,
        );

        expect(scoped.data).toEqual({ firstName: 'Ahmad', organizationId: ORG });
    });

    it('sets organizationId on every createMany row', () => {
        const scoped = applyOrganizationScope(
            'Member',
            'createMany',
            { data: [{ firstName: 'Ahmad' }, { firstName: 'Omar' }] },
            ORG,
        );

        expect(scoped.data).toEqual([
            { firstName: 'Ahmad', organizationId: ORG },
            { firstName: 'Omar', organizationId: ORG },
        ]);
    });

    it('scopes updateMany where and does not touch data', () => {
        const scoped = applyOrganizationScope(
            'Member',
            'updateMany',
            { where: { id: 'member-1' }, data: { firstName: 'Ahmad' } },
            ORG,
        );

        expect(scoped.where).toEqual({ id: 'member-1', organizationId: ORG });
        expect(scoped.data).toEqual({ firstName: 'Ahmad' });
    });

    it('throws when a tenant model has no organization', () => {
        expect(() => applyOrganizationScope('Member', 'findMany', {}, undefined)).toThrow(
            TenantScopeError,
        );
    });

    it('throws when the query names a different organization', () => {
        expect(() =>
            applyOrganizationScope('Member', 'findMany', { where: { organizationId: OTHER } }, ORG),
        ).toThrow(TenantScopeError);
    });

    it('throws for findUnique, update, and upsert', () => {
        for (const operation of ['findUnique', 'update', 'upsert']) {
            expect(() => applyOrganizationScope('Member', operation, {}, ORG)).toThrow(TenantScopeError);
        }
    });

    it('throws for an operation that has not been classified', () => {
        expect(() => applyOrganizationScope('Member', 'subscribe', {}, ORG)).toThrow(TenantScopeError);
    });
});