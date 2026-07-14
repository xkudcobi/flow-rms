import { Controller, Get, UseGuards } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PATRON, ROLES.MUDUR)
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get()
  list() {
    return this.feedback.list();
  }
}
