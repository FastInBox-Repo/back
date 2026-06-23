import { DomainError } from '../../common/domain-errors';
import { SelfServiceService } from './self-service.service';

function expectDomainCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).getResponse()).toMatchObject({ code });
    return;
  }
  throw new Error(`Expected to throw domain error ${code}`);
}

describe('SelfServiceService', () => {
  let service: SelfServiceService;

  beforeEach(() => {
    service = new SelfServiceService();
  });

  it('generates a NUT-prefixed code and validates it as active', () => {
    const record = service.generate({
      clinicId: 'c1',
      nutritionistId: 'n1',
    });
    expect(record.code).toMatch(/^NUT-[0-9A-Z]{6}$/);
    expect(record.active).toBe(true);
    expect(record.usageCount).toBe(0);
    expect(record.clinicId).toBe('c1');
    expect(record.nutritionistId).toBe('n1');

    const validated = service.validateActive(record.code.toLowerCase());
    expect(validated.code).toBe(record.code);
  });

  it('throws SELF_SERVICE_CODE_INVALID for an unknown code', () => {
    expectDomainCode(
      () => service.validateActive('NUT-ZZZZZZ'),
      'SELF_SERVICE_CODE_INVALID',
    );
  });

  it('throws SELF_SERVICE_CODE_INVALID once deactivated', () => {
    const record = service.generate({ clinicId: 'c1', nutritionistId: 'n1' });
    service.deactivate(record.code);
    expectDomainCode(
      () => service.validateActive(record.code),
      'SELF_SERVICE_CODE_INVALID',
    );
  });

  it('throws SELF_SERVICE_CODE_INVALID once expired', () => {
    const record = service.generate({
      clinicId: 'c1',
      nutritionistId: 'n1',
      ttlDays: 1,
    });
    record.expiresAt = new Date(Date.now() - 1000);
    expectDomainCode(
      () => service.validateActive(record.code),
      'SELF_SERVICE_CODE_INVALID',
    );
  });

  it('increments usage and counts active codes', () => {
    const record = service.generate({ clinicId: 'c1', nutritionistId: 'n1' });
    service.incrementUsage(record.code);
    service.incrementUsage(record.code);
    expect(service.validateActive(record.code).usageCount).toBe(2);
    expect(service.countActive()).toBe(1);
    service.deactivate(record.code);
    expect(service.countActive()).toBe(0);
  });

  it('lists codes scoped by nutritionist', () => {
    service.generate({ clinicId: 'c1', nutritionistId: 'n1' });
    service.generate({ clinicId: 'c1', nutritionistId: 'n2' });
    expect(service.list({ clinicId: 'c1' })).toHaveLength(2);
    expect(service.list({ clinicId: 'c1', nutritionistId: 'n1' })).toHaveLength(
      1,
    );
  });
});
