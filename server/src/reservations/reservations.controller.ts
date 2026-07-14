import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { ReservationsService } from './reservations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtUser } from '../auth/jwt-auth.guard';

class ReservationDto {
  @IsOptional() @IsString() tableId?: string;
  @IsString() customerName: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsInt() partySize?: number;
  @IsString() reservedAt: string;
  @IsOptional() @IsString() note?: string;
}
class UpdateReservationDto {
  @IsOptional() @IsString() tableId?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsInt() partySize?: number;
  @IsOptional() @IsString() reservedAt?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() status?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  // Salon işaretlemesi için — tüm giriş yapmışlara açık.
  @Get('active')
  active() {
    return this.reservations.activeToday();
  }

  // Yönetim — PATRON/MÜDÜR/KASİYER.
  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR, ROLES.KASIYER)
  @Get()
  list(@Query('date') date?: string) {
    return this.reservations.list(date);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR, ROLES.KASIYER)
  @Post()
  create(@Body() dto: ReservationDto, @CurrentUser() user: JwtUser) {
    return this.reservations.create(dto, user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR, ROLES.KASIYER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReservationDto) {
    return this.reservations.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR, ROLES.KASIYER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reservations.remove(id);
  }
}
