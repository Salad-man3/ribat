import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  CreateMaterialLogSchema,
  CreateMemorizationLogSchema,
  CreateSessionSchema,
  CreateTestSchema,
  ListProgressQuerySchema,
  PostAttendanceSchema,
  SyncBatchSchema,
  UpdateSessionSchema,
  VoidLogSchema,
  type CreateMaterialLogInput,
  type CreateMemorizationLogInput,
  type CreateSessionInput,
  type CreateTestInput,
  type ListProgressQuery,
  type PostAttendanceInput,
  type SyncBatchInput,
  type SyncMutationInput,
  type SyncResponse,
  type SyncResult,
  type UpdateSessionInput,
  type VoidLogInput,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import {
  CurrentAudit,
  CurrentOrg,
  OrgRoute,
  type OrgContext,
} from '../auth/org-context.guard';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { ProgressReaderService } from './progress-reader.service';
import { ProgressWriterService } from './progress-writer.service';

const id = new ParseUUIDPipe();

/** Split the online body back into the offline mutation shape, so both take one path. */
function asMutation<T extends { idempotencyKey: string; capturedAt?: string }>(
  type: SyncMutationInput['type'],
  body: T,
): SyncMutationInput {
  const { idempotencyKey, capturedAt, ...payload } = body;
  return {
    type,
    idempotencyKey,
    capturedAt: capturedAt ?? new Date().toISOString(),
    payload,
  } as unknown as SyncMutationInput;
}

/** Online writes answer like REST: a refusal is the HTTP error, a superseded mark is 200 with the server row. */
@Controller()
export class ProgressController {
  constructor(
    private readonly reader: ProgressReaderService,
    private readonly writer: ProgressWriterService,
  ) {}

  // Class kit and offline replay (05-offline-sync.md)

  @Get('class-kit')
  @OrgRoute()
  classKit(@CurrentOrg() org: OrgContext) {
    return this.reader.classKit(org);
  }

  /** SYNC-09…12: up to 200 mutations, each in its own transaction, in the order sent. */
  @Post('sync/mutations')
  @HttpCode(200)
  @OrgRoute()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async sync(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Body(createZodValidationPipe(SyncBatchSchema)) body: SyncBatchInput,
  ): Promise<SyncResponse> {
    return {
      results: await this.writer.applyBatch(
        org,
        audit,
        body.mutations,
        'OFFLINE',
      ),
    };
  }

  // Sessions and attendance

  @Post('courses/:id/sessions')
  @OrgRoute()
  addSession(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Body(createZodValidationPipe(CreateSessionSchema))
    body: CreateSessionInput,
  ) {
    return this.reader.addSession(org, audit, courseId, body);
  }

  @Patch('sessions/:id')
  @OrgRoute()
  updateSession(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) sessionId: string,
    @Body(createZodValidationPipe(UpdateSessionSchema))
    body: UpdateSessionInput,
  ) {
    return this.reader.updateSession(org, audit, sessionId, body);
  }

  @Get('sessions/:id/attendance')
  @OrgRoute()
  roster(@CurrentOrg() org: OrgContext, @Param('id', id) sessionId: string) {
    return this.reader.roster(org, sessionId);
  }

  /** Batch marks, same shape and same rules as the offline payload. */
  @Post('sessions/:id/attendance')
  @HttpCode(200)
  @OrgRoute()
  async mark(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) sessionId: string,
    @Body(createZodValidationPipe(PostAttendanceSchema))
    body: PostAttendanceInput,
  ): Promise<SyncResponse> {
    const results: SyncResult[] = [];
    for (const mark of body.marks) {
      const mutation = asMutation('attendance.mark', { ...mark, sessionId });
      results.push(
        await this.writer.applyOrThrow(org, audit, mutation, 'ONLINE'),
      );
    }
    return { results };
  }

  // Memorization

  @Get('memorization/logs')
  @OrgRoute()
  listLogs(
    @CurrentOrg() org: OrgContext,
    @Query(createZodValidationPipe(ListProgressQuerySchema))
    query: ListProgressQuery,
  ) {
    return this.reader.listLogs(org, query);
  }

  @Post('memorization/logs')
  @OrgRoute()
  logMemorization(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Body(createZodValidationPipe(CreateMemorizationLogSchema))
    body: CreateMemorizationLogInput,
  ) {
    return this.writer.applyOrThrow(
      org,
      audit,
      asMutation('memorization.log', body),
      'ONLINE',
    );
  }

  @Post('memorization/logs/:id/void')
  @HttpCode(204)
  @OrgRoute()
  async voidLog(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) logId: string,
    @Body(createZodValidationPipe(VoidLogSchema)) body: VoidLogInput,
  ) {
    await this.writer.voidLog(org, audit, logId, body.reason);
  }

  @Get('memorization/tests')
  @OrgRoute()
  listTests(
    @CurrentOrg() org: OrgContext,
    @Query(createZodValidationPipe(ListProgressQuerySchema))
    query: ListProgressQuery,
  ) {
    return this.reader.listTests(org, query);
  }

  @Post('memorization/tests')
  @OrgRoute()
  recordTest(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Body(createZodValidationPipe(CreateTestSchema)) body: CreateTestInput,
  ) {
    return this.writer.recordTest(org, audit, body);
  }

  // Explanation pages

  @Get('material-logs')
  @OrgRoute()
  listMaterialLogs(
    @CurrentOrg() org: OrgContext,
    @Query(createZodValidationPipe(ListProgressQuerySchema))
    query: ListProgressQuery,
  ) {
    return this.reader.listMaterialLogs(org, query);
  }

  @Post('material-logs')
  @OrgRoute()
  logMaterial(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Body(createZodValidationPipe(CreateMaterialLogSchema))
    body: CreateMaterialLogInput,
  ) {
    return this.writer.applyOrThrow(
      org,
      audit,
      asMutation('material.log', body),
      'ONLINE',
    );
  }
}
