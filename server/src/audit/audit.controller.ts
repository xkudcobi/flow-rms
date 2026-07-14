import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PATRON, ROLES.MUDUR)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query('date') date?: string, @Query('action') action?: string) {
    return this.audit.list(date, action);
  }

  @Get('summary')
  summary(@Query('date') date?: string) {
    return this.audit.summary(date);
  }
}
