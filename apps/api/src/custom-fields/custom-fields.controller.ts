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
import {
  CreateCustomFieldSchema,
  ListCustomFieldsQuerySchema,
  UpdateCustomFieldSchema,
  type CreateCustomFieldInput,
  type ListCustomFieldsQuery,
  type UpdateCustomFieldInput,
} from '@ribat/shared';
import { CurrentOrg, OrgRoute, type OrgContext } from '../auth/org-context.guard';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { CustomFieldsService } from './custom-fields.service';

const id = new ParseUUIDPipe();

@Controller('custom-fields')
export class CustomFieldsController {
  constructor(private readonly customFields: CustomFieldsService) {}

  @Get()
  @OrgRoute('organization.manage')
  list(
    @CurrentOrg() org: OrgContext,
    @Query(createZodValidationPipe(ListCustomFieldsQuerySchema))
    query: ListCustomFieldsQuery,
  ) {
    return this.customFields.list(org.organizationId, query);
  }

  @Post()
  @OrgRoute('organization.manage')
  create(
    @CurrentOrg() org: OrgContext,
    @Body(createZodValidationPipe(CreateCustomFieldSchema)) body: CreateCustomFieldInput,
  ) {
    return this.customFields.create(org.organizationId, body);
  }

  @Patch(':id')
  @OrgRoute('organization.manage')
  update(
    @CurrentOrg() org: OrgContext,
    @Param('id', id) fieldId: string,
    @Body(createZodValidationPipe(UpdateCustomFieldSchema)) body: UpdateCustomFieldInput,
  ) {
    return this.customFields.update(org.organizationId, fieldId, body);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @OrgRoute('organization.manage')
  archive(@CurrentOrg() org: OrgContext, @Param('id', id) fieldId: string) {
    return this.customFields.archive(org.organizationId, fieldId);
  }
}
