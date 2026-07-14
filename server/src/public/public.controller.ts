import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PublicService } from './public.service';

class PublicItemDto {
  @IsString() productId: string;
  @IsOptional() @IsInt() @Min(1) quantity?: number;
  @IsOptional() @IsString() note?: string;
}
class PublicOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicItemDto)
  items: PublicItemDto[];
}
class CallDto {
  @IsString() type: string; // GARSON | HESAP
}
class FeedbackDto {
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() comment?: string;
}

// AUTH YOK — QR self-servis. Erişim qrToken ile doğrulanır.
@Controller('public')
export class PublicController {
  constructor(private readonly pub: PublicService) {}

  @Get('menu')
  menu() {
    return this.pub.menu();
  }

  @Get('t/:token')
  table(@Param('token') token: string) {
    return this.pub.tableInfo(token);
  }

  @Post('t/:token/order')
  order(@Param('token') token: string, @Body() dto: PublicOrderDto) {
    return this.pub.order(token, dto.items);
  }

  @Post('t/:token/call')
  call(@Param('token') token: string, @Body() dto: CallDto) {
    return this.pub.call(token, dto.type);
  }

  @Post('t/:token/feedback')
  feedback(@Param('token') token: string, @Body() dto: FeedbackDto) {
    return this.pub.feedback(token, dto.rating, dto.comment);
  }
}
