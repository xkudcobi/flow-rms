import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtUser } from '../auth/jwt-auth.guard';

class AddItemDto {
  @IsString() productId: string;
  @IsOptional() @IsInt() @Min(1) quantity?: number;
  @IsOptional() @IsString() note?: string;
}
class AddItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddItemDto)
  items: AddItemDto[];
}
class UpdateItemDto {
  @IsOptional() @IsInt() @Min(1) quantity?: number;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() status?: string;
}
class TargetTableDto {
  @IsString() targetTableId: string;
}
class PaymentDto {
  @IsString() method: string;
  @IsNumber() @Min(0.01) amount: number;
  @IsOptional() @IsString() accountId?: string; // ACIK_HESAP için cari
}
class DiscountDto {
  @IsOptional() @IsString() type?: string | null; // null = iskonto kaldır
  @IsOptional() @IsNumber() value?: number;
  @IsOptional() @IsString() reason?: string;
}
class TipDto {
  @IsNumber() @Min(0) tip: number;
}
class CustomerLinkDto {
  @IsOptional() @IsString() customerId?: string | null;
}
class RedeemDto {
  @IsNumber() @Min(1) points: number;
}

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('active')
  active() {
    return this.orders.getActiveOrders();
  }

  // Mutfak ekranı (KDS) kuyruğu
  @Get('kds/queue')
  kdsQueue() {
    return this.orders.getKdsQueue();
  }

  @Get('table/:tableId')
  tableOrder(@Param('tableId') tableId: string) {
    return this.orders.getTableActiveOrder(tableId);
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.orders.getOrder(id);
  }

  // Masa adisyonunu aç (yoksa oluştur).
  @Post('table/:tableId/open')
  open(@Param('tableId') tableId: string, @CurrentUser() user: JwtUser) {
    return this.orders.openTableOrder(tableId, user.sub);
  }

  @Post(':id/items')
  addItems(
    @Param('id') id: string,
    @Body() dto: AddItemsDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.orders.addItems(id, dto.items, user.sub);
  }

  @Patch('items/:itemId')
  updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.orders.updateItem(itemId, dto, {
      userId: user.sub,
      userName: user.fullName,
    });
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.orders.cancelOrder(id, {
      userId: user.sub,
      userName: user.fullName,
    });
  }

  @Post(':id/move')
  move(@Param('id') id: string, @Body() dto: TargetTableDto) {
    return this.orders.moveOrder(id, dto.targetTableId);
  }

  @Post(':id/merge')
  merge(@Param('id') id: string, @Body() dto: TargetTableDto) {
    return this.orders.mergeOrder(id, dto.targetTableId);
  }

  // --- Ödeme & iskonto (M4) ---

  @Post(':id/payments')
  addPayment(
    @Param('id') id: string,
    @Body() dto: PaymentDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.orders.addPayment(
      id,
      dto.method,
      dto.amount,
      user.sub,
      dto.accountId,
    );
  }

  // İskonto/ikram yalnızca PATRON/MÜDÜR (yetki gerektirir).
  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Post(':id/discount')
  discount(
    @Param('id') id: string,
    @Body() dto: DiscountDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.orders.setDiscount(
      id,
      { type: dto.type ?? null, value: dto.value, reason: dto.reason },
      { userId: user.sub, userName: user.fullName },
    );
  }

  @Patch(':id/tip')
  setTip(@Param('id') id: string, @Body() dto: TipDto) {
    return this.orders.setTip(id, dto.tip);
  }

  @Patch(':id/customer')
  setCustomer(@Param('id') id: string, @Body() dto: CustomerLinkDto) {
    return this.orders.setCustomer(id, dto.customerId ?? null);
  }

  @Post(':id/redeem')
  redeem(
    @Param('id') id: string,
    @Body() dto: RedeemDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.orders.redeemPoints(id, dto.points, user.sub);
  }
}
