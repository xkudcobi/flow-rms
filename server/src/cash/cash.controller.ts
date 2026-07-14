import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CashService } from './cash.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtUser } from '../auth/jwt-auth.guard';

class OpenDto {
  @IsNumber() @Min(0) openingCash: number;
}
class CloseDto {
  @IsNumber() @Min(0) countedCash: number;
  @IsOptional() @IsString() note?: string;
}
class MovementDto {
  @IsString() type: string; // GIRIS | CIKIS
  @IsNumber() @Min(0.01) amount: number;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() description?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PATRON, ROLES.MUDUR, ROLES.KASIYER)
@Controller('cash')
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get('active')
  active() {
    return this.cash.getActive();
  }

  @Get('sessions')
  sessions(@Query('date') date?: string) {
    return this.cash.sessions(date);
  }

  @Post('open')
  open(@Body() dto: OpenDto, @CurrentUser() user: JwtUser) {
    return this.cash.open(dto.openingCash, user.sub);
  }

  @Post(':id/close')
  close(
    @Param('id') id: string,
    @Body() dto: CloseDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.cash.close(id, dto.countedCash, dto.note, user.sub);
  }

  @Post('movements')
  addMovement(@Body() dto: MovementDto, @CurrentUser() user: JwtUser) {
    return this.cash.addMovement(dto, user.sub);
  }
}
