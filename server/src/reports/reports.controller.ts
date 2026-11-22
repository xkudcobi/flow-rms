import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';

// Raporlar yalnızca PATRON/MÜDÜR.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PATRON, ROLES.MUDUR)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('day')
  day(@Query('date') date?: string) {
    return this.reports.daySummary(date);
  }

  @Get('dashboard')
  dashboard(@Query('date') date?: string) {
    return this.reports.dashboard(date);
  }

  // Günün tüm adisyonları (masa bazında ne alındı, kapanış sonrası dahil)
  @Get('orders')
  orders(@Query('date') date?: string) {
    return this.reports.dayOrders(date);
  }

  // Maliyet raporları (tarih aralığı): saf ürün/stok + toplam işletme maliyeti.
  @Get('cost')
  cost(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.costReport(from, to);
  }
}
