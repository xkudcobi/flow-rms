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
import { PermissionsGuard, RequirePage } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtUser } from '../auth/jwt-auth.guard';

class PurchaseItemDto {
  @IsOptional() @IsString() stockItemId?: string;
  @IsString() name: string;
  @IsNumber() @Min(0.0001) quantity: number;
  @IsOptional() @IsString() unit?: string;
  @IsNumber() @Min(0) unitPrice: number;
  @IsOptional() @IsNumber() vatRate?: number;
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsString() expiryDate?: string;
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

// Alış/gider: rol varsayılanı PATRON/MÜDÜR; ayrıca patronun "alislar" sayfa izni
// verdiği kullanıcılar da erişebilir (PermissionsGuard + @RequirePage).
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePage('alislar')
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
