import { BadRequestException } from '@nestjs/common';
import { CreateMemberSchema } from '@ribat/shared';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(CreateMemberSchema);

  it('returns parsed data for a valid payload', () => {
    const payload = {
      firstName: 'Ahmad',
      fatherName: 'Hassan',
      familyName: 'Ali',
      birthDate: '2015-03-01',
      joinedAt: '2024-09-01',
    };

    expect(pipe.transform(payload)).toEqual(payload);
  });

  it('throws BadRequestException with validation details for invalid payload', () => {
    try {
      pipe.transform({ firstName: '' });
      fail('Expected BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        error: { code: string; details?: Record<string, string[]> };
      };
      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect(response.error.details?.fatherName).toBeDefined();
    }
  });
});
