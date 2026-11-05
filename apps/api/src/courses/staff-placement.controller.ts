import { Controller, Get } from '@nestjs/common';
import {
  CurrentOrg,
  OrgRoute,
  type OrgContext,
} from '../auth/org-context.guard';
import { EnrollmentsService } from './enrollments.service';

@Controller()
export class StaffPlacementController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  @Get('staff/placement')
  @OrgRoute('courses.manage')
  board(@CurrentOrg() org: OrgContext) {
    return this.enrollments.placementBoard(org.organizationId);
  }
}
