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
import { OrganizationId } from '../common/decorators/organization-id.decorator';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { MembersService } from './members.service';

@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  list(
    @OrganizationId() organizationId: string,
    @Query(createZodValidationPipe(ListMembersQuerySchema)) query: ListMembersQuery,
  ) {
    return this.membersService.list(organizationId, query);
  }

  @Post()
  create(
    @OrganizationId() organizationId: string,
    @Body(createZodValidationPipe(CreateMemberSchema)) body: CreateMemberInput,
  ) {
    return this.membersService.create(organizationId, body);
  }

  @Get(':id')
  getById(
    @OrganizationId() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.membersService.getById(organizationId, id);
  }

  @Patch(':id')
  update(
    @OrganizationId() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(createZodValidationPipe(UpdateMemberSchema)) body: UpdateMemberInput,
  ) {
    return this.membersService.update(organizationId, id, body);
  }

  @Post(':id/archive')
  archive(
    @OrganizationId() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.membersService.archive(organizationId, id);
  }
}