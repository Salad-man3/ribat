import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { CreateMemberSchema } from '@ribat/shared';

const prisma = new PrismaClient();

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

async function main() {
  const fileArg = process.argv.find((arg) => arg.startsWith('--file='));
  const orgArg = process.argv.find((arg) => arg.startsWith('--org='));
  if (!fileArg || !orgArg) {
    throw new Error('Usage: import:members --file=members.csv --org=demo-mosque');
  }

  const file = fileArg.slice('--file='.length);
  const slug = orgArg.slice('--org='.length);
  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) throw new Error(`Unknown organization slug: ${slug}`);

  const rows = parseCsv(readFileSync(file, 'utf8'));
  const { errors, valid } = validateImportRows(rows);
  if (errors.length > 0) {
    console.error('Import rejected:');
    for (const error of errors) console.error(`  ${error}`);
    process.exit(1);
  }

  const householdKeys = new Map<string, string>();
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const key = row.data.householdKey?.trim();
      let householdId: string | undefined;
      if (key) {
        householdId = householdKeys.get(key);
        if (!householdId) {
          const created = await tx.household.create({
            data: { organizationId: org.id, name: key },
          });
          householdId = created.id;
          householdKeys.set(key, householdId);
        }
      }
      const validated = valid.find((entry) => entry.line === row.line);
      if (!validated) continue;
      await tx.member.create({
        data: {
          organizationId: org.id,
          householdId: householdId ?? null,
          ...validated.input,
          birthDate: new Date(validated.input.birthDate),
          joinedAt: new Date(validated.input.joinedAt),
        },
      });
    }
  });

  console.log(`Imported ${valid.length} members into ${slug}`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
