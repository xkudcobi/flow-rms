import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FiscalService } from './fiscal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';

@UseGuards(JwtAuthGuard)
@Controller('fiscal')
export class FiscalController {
  constructor(private readonly fiscal: FiscalService) {}

  @Get('status')
  status() {
    return { provider: this.fiscal.providerName };
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Get('receipts')
  list() {
    return this.fiscal.list();
  }

  @Post('receipt/:orderId')
  issue(@Param('orderId') orderId: string) {
    return this.fiscal.issueForOrder(orderId);
  }
}
