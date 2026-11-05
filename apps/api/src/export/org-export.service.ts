import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { OrgContext } from '../auth/org-context.guard';
import { PrismaService } from '../prisma/prisma.service';
import { TENANT_MODELS } from '../prisma/organization-scope';

const EXPORTABLE = [
  'Member',
  'Course',
  'Enrollment',
  'Attendance',
  'MemorizationLog',
  'Material',
] as const;

export type ExportSelection = (typeof EXPORTABLE)[number][];

@Injectable()
export class OrgExportService {
  constructor(private readonly prisma: PrismaService) {}

  async buildWorkbook(
    organizationId: string,
    selection: ExportSelection,
  ): Promise<Buffer> {
    const db = this.prisma.forOrganization(organizationId);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Ribat';

    for (const model of selection) {
      if (!TENANT_MODELS.has(model)) continue;
      const sheet = workbook.addWorksheet(model);
      const rows = await this.rowsForModel(db, model, organizationId);
      if (rows.length === 0) {
        sheet.addRow(['empty']);
        continue;
      }
      const keys = Object.keys(rows[0]);
      sheet.addRow(keys);
      for (const row of rows) {
        sheet.addRow(keys.map((k) => this.cellValue(row[k])));
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private cellValue(value: unknown): string | number | boolean | Date {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return value as string | number | boolean;
  }

  private async rowsForModel(
    db: ReturnType<PrismaService['forOrganization']>,
    model: (typeof EXPORTABLE)[number],
    organizationId: string,
  ): Promise<Record<string, unknown>[]> {
    switch (model) {
      case 'Member':
        return db.member.findMany({ where: { organizationId } }) as Promise<
          Record<string, unknown>[]
        >;
      case 'Course':
        return db.course.findMany({ where: { organizationId } }) as Promise<
          Record<string, unknown>[]
        >;
      case 'Enrollment':
        return db.enrollment.findMany({ where: { organizationId } }) as Promise<
          Record<string, unknown>[]
        >;
      case 'Attendance':
        return db.attendance.findMany({ where: { organizationId } }) as Promise<
          Record<string, unknown>[]
        >;
      case 'MemorizationLog':
        return db.memorizationLog.findMany({
          where: { organizationId },
        }) as Promise<Record<string, unknown>[]>;
      case 'Material':
        return db.material.findMany({ where: { organizationId } }) as Promise<
          Record<string, unknown>[]
        >;
      default:
        return [];
    }
  }

  async importWorkbook(
    org: OrgContext,
    buffer: Buffer,
  ): Promise<{ sheets: number }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const db = this.prisma.forOrganization(org.organizationId);
    let sheets = 0;
    for (const sheet of workbook.worksheets) {
      if (sheet.name === 'Member') {
        sheets += 1;
        const header = sheet.getRow(1).values as unknown[];
        for (let r = 2; r <= sheet.rowCount; r += 1) {
          const row = sheet.getRow(r);
          const data: Record<string, unknown> = {};
          header.forEach((key, idx) => {
            if (typeof key === 'string') data[key] = row.getCell(idx).value;
          });
          if (!data.id) continue;
          await db.member.upsert({
            where: { id: String(data.id) },
            create: {
              id: String(data.id),
              organizationId: org.organizationId,
              firstName: String(data.firstName ?? ''),
              fatherName: String(data.fatherName ?? ''),
              familyName: String(data.familyName ?? ''),
              birthDate: new Date(String(data.birthDate ?? '2010-01-01')),
              joinedAt: new Date(
                String(data.joinedAt ?? new Date().toISOString()),
              ),
              status: 'ACTIVE',
            },
            update: {
              firstName: String(data.firstName ?? ''),
              fatherName: String(data.fatherName ?? ''),
              familyName: String(data.familyName ?? ''),
            },
          });
        }
      }
    }
    return { sheets };
  }
}
