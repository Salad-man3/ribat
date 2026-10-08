import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CreateMemberSchema,
  ListMembersQuerySchema,
  UpdateMemberSchema,
  type CreateMemberInput,
  type ListMembersQuery,
  type UpdateMemberInput,
} from '@ribat/shared';
import { CurrentOrg, OrgRoute, type OrgContext } from '../auth/org-context.guard';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { MembersService } from './members.service';

@Controller('members')
@OrgRoute('members.manage')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  list(
    @CurrentOrg() org: OrgContext,
    @Query(createZodValidationPipe(ListMembersQuerySchema)) query: ListMembersQuery,
  ) {
    return this.membersService.list(org.organizationId, query);
  }

  @Post()
  create(
    @CurrentOrg() org: OrgContext,
    @Body(createZodValidationPipe(CreateMemberSchema)) body: CreateMemberInput,
  ) {
    return this.membersService.create(org.organizationId, body);
  }

  @Get(':id')
  getById(
    @CurrentOrg() org: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.membersService.getById(org.organizationId, id);
  }

  @Patch(':id')
  update(
    @CurrentOrg() org: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(createZodValidationPipe(UpdateMemberSchema)) body: UpdateMemberInput,
  ) {
    return this.membersService.update(org.organizationId, id, body);
  }

  @Post(':id/archive')
  archive(
    @CurrentOrg() org: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.membersService.archive(org.organizationId, id);
  }
}
