import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PurchasesService } from './purchases.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtUser } from '../auth/jwt-auth.guard';

class PurchaseItemDto {
  @IsOptional() @IsString() stockItemId?: string;
  @IsString() name: string;
  @IsNumber() @Min(0.0001) quantity: number;
  @IsOptional() @IsString() unit?: string;
  @IsNumber() @Min(0) unitPrice: number;
  @IsOptional() @IsNumber() vatRate?: number;
}
class CreatePurchaseDto {
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() invoiceNo?: string;
  @IsOptional() @IsString() invoiceDate?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() paymentStatus?: string;
  @IsOptional() @IsString() paymentMethod?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];
}

// Alış/gider yalnızca PATRON/MÜDÜR.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PATRON, ROLES.MUDUR)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.purchases.list({ from, to, supplierId });
  }

  @Get('summary')
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.purchases.summary({ from, to });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.purchases.get(id);
  }

  @Post()
  create(@Body() dto: CreatePurchaseDto, @CurrentUser() user: JwtUser) {
    return this.purchases.create(dto, user.sub);
  }
}
