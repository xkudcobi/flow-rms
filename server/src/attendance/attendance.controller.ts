import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard, JwtUser } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  // Personel QR okutunca: giriş/çıkış (toggle). Kendi oturumuyla.
  @Post('clock')
  clock(@CurrentUser() user: JwtUser) {
    return this.attendance.clock(user.sub, user.fullName, 'QR');
  }

  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.attendance.me(user.sub);
  }

  // Yönetici raporu.
  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Get()
  report(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
  ) {
    return this.attendance.report({ from, to, userId });
  }
}
