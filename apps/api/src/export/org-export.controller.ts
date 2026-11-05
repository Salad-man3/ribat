import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import {
  CurrentOrg,
  OrgRoute,
  type OrgContext,
} from '../auth/org-context.guard';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { OrgExportService, type ExportSelection } from './org-export.service';

const ExportSchema = z.object({
  selection: z
    .array(
      z.enum([
        'Member',
        'Course',
        'Enrollment',
        'Attendance',
        'MemorizationLog',
        'Material',
      ]),
    )
    .min(1),
});

@Controller('organization/export')
export class OrgExportController {
  constructor(private readonly exportService: OrgExportService) {}

  @Post()
  @OrgRoute('organization.manage')
  async exportOrg(
    @CurrentOrg() org: OrgContext,
    @Body(createZodValidationPipe(ExportSchema))
    body: z.infer<typeof ExportSchema>,
    @Res() res: Response,
  ) {
    const buffer = await this.exportService.buildWorkbook(
      org.organizationId,
      body.selection as ExportSelection,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="ribat-export.xlsx"',
    );
    res.send(buffer);
  }

  @Post('import')
  @OrgRoute('organization.manage')
  async importOrg(
    @CurrentOrg() org: OrgContext,
    @Body() body: { fileBase64: string },
  ) {
    const buffer = Buffer.from(body.fileBase64, 'base64');
    return this.exportService.importWorkbook(org, buffer);
  }
}
