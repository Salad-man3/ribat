import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { createPrismaClient } from '../src/prisma/create-prisma-client.js';
import { parseCsv, validateImportRows } from './import-members-csv.js';

const prisma = createPrismaClient();

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
          householdKeys.set(key, created.id);
        }
      }
      const validated = valid.find((entry) => entry.line === row.line);
      if (!validated) continue;
      const { customValues, ...memberInput } = validated.input;
      await tx.member.create({
        data: {
          organizationId: org.id,
          householdId: householdId ?? null,
          ...memberInput,
          birthDate: new Date(validated.input.birthDate),
          joinedAt: new Date(validated.input.joinedAt),
          customValues: (customValues ?? {}) as object,
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
