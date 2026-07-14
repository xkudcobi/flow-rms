import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';

class ShiftDto {
  @IsString() userId: string;
  @IsString() date: string; // YYYY-MM-DD
  @IsString() startTime: string; // "09:00"
  @IsString() endTime: string; // "17:00"
  @IsOptional() @IsString() note?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PATRON, ROLES.MUDUR)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Get()
  list(@Query('start') start?: string) {
    return this.shifts.list(start);
  }

  @Get('performance')
  performance(@Query('from') from?: string, @Query('to') to?: string) {
    return this.shifts.performance(from, to);
  }

  @Post()
  create(@Body() dto: ShiftDto) {
    return this.shifts.create(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.shifts.remove(id);
  }
}
