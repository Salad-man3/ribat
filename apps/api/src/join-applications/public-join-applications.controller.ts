import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  CreateJoinApplicationSchema,
  PublicJoinApplicationCreatedSchema,
  PublicOrganizationJoinInfoSchema,
  type CreateJoinApplicationInput,
  type PublicJoinApplicationCreated,
  type PublicOrganizationJoinInfo,
} from '@ribat/shared';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { JoinApplicationsService } from './join-applications.service';

@Controller('public/organizations')
export class PublicJoinApplicationsController {
  constructor(private readonly joinApplications: JoinApplicationsService) {}

  @Get(':slug/join')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async joinPage(@Param('slug') slug: string): Promise<PublicOrganizationJoinInfo> {
    const { info } = await this.joinApplications.resolvePublicOrg(slug);
    return PublicOrganizationJoinInfoSchema.parse(info);
  }

  @Post(':slug/join-applications')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async apply(
    @Param('slug') slug: string,
    @Body(createZodValidationPipe(CreateJoinApplicationSchema)) body: CreateJoinApplicationInput,
  ): Promise<PublicJoinApplicationCreated> {
    const { organizationId } = await this.joinApplications.resolvePublicOrg(slug);
    const created = await this.joinApplications.createPublic(organizationId, body);
    return PublicJoinApplicationCreatedSchema.parse({ id: created.id });
  }
}
