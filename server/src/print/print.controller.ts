import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { PrintService } from './print.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class KitchenPrintDto {
  @IsOptional() @IsArray() @IsString({ each: true })
  itemIds?: string[];
}

@UseGuards(JwtAuthGuard)
@Controller('print')
export class PrintController {
  constructor(private readonly print: PrintService) {}

  // Bir siparişin (opsiyonel: belirli kalemlerin) mutfak fişini yazdır.
  // Yazıcı yoksa fişlerin metin önizlemesini döner.
  @Post('kitchen/:orderId')
  kitchen(@Param('orderId') orderId: string, @Body() dto: KitchenPrintDto) {
    return this.print.printKitchenForOrder(orderId, dto.itemIds);
  }

  // Müşteri adisyon (satış) fişi
  @Post('receipt/:orderId')
  receipt(@Param('orderId') orderId: string) {
    return this.print.printReceiptForOrder(orderId);
  }
}
