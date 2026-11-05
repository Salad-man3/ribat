import { CreateMemberSchema } from '@ribat/shared';

export type ParsedImportRow = {
  line: number;
  data: Record<string, string>;
};

export function parseCsv(content: string): ParsedImportRow[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((header) => header.trim());
  const rows: ParsedImportRow[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const values = lines[index].split(',').map((value) => value.trim());
    const data: Record<string, string> = {};
    headers.forEach((header, column) => {
      data[header] = values[column] ?? '';
    });
    rows.push({ line: index + 1, data });
  }
  return rows;
}

export function validateImportRows(rows: ParsedImportRow[]) {
  const errors: string[] = [];
  const valid: Array<{ line: number; input: ReturnType<typeof CreateMemberSchema.parse> }> = [];
  for (const row of rows) {
    const payload = {
      firstName: row.data.firstName,
      fatherName: row.data.fatherName,
      familyName: row.data.familyName,
      motherName: row.data.motherName || undefined,
      birthDate: row.data.birthDate,
      joinedAt: row.data.joinedAt,
      phone: row.data.phone || undefined,
      address: row.data.address || undefined,
      schoolGrade: row.data.schoolGrade || undefined,
      schoolName: row.data.schoolName || undefined,
      studyStatus: row.data.study_status || undefined,
      university: row.data.university || undefined,
      faculty: row.data.faculty || undefined,
      universityYear: row.data.university_year ? Number(row.data.university_year) : undefined,
      highestEducation: row.data.highest_education || undefined,
      notes: row.data.notes || undefined,
    };
    const parsed = CreateMemberSchema.safeParse(payload);
    if (!parsed.success) {
      errors.push(`line ${row.line}: validation failed`);
      continue;
    }
    valid.push({ line: row.line, input: parsed.data });
  }
  return { errors, valid };
}
