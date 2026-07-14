import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { EInvoiceService } from './einvoice.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';

class CreateInvoiceDto {
  @IsOptional() @IsIn(['EFATURA', 'EARSIV']) docType?: 'EFATURA' | 'EARSIV';
  @IsOptional() @IsString() accountId?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('einvoice')
export class EInvoiceController {
  constructor(private readonly einvoice: EInvoiceService) {}

  @Get('status')
  status() {
    return { provider: this.einvoice.providerName };
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Get()
  list() {
    return this.einvoice.list();
  }

  @Post('from-order/:orderId')
  create(@Param('orderId') orderId: string, @Body() dto: CreateInvoiceDto) {
    return this.einvoice.createFromOrder(
      orderId,
      dto.docType ?? 'EARSIV',
      dto.accountId,
    );
  }
}
