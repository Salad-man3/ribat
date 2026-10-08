import { parseCsv, validateImportRows } from './import-members';

describe('import-members', () => {
  it('validates all rows before accepting any', () => {
    const rows = parseCsv(
      [
        'firstName,fatherName,familyName,birthDate,joinedAt',
        'Ahmad,Hassan,Ali,2015-03-01,2024-09-01',
        'Bad,,Ali,2015-03-01,2024-09-01',
      ].join('\n'),
    );
    const { errors, valid } = validateImportRows(rows);
    expect(errors).toHaveLength(1);
    expect(valid).toHaveLength(1);
  });
});
