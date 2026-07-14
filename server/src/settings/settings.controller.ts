import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';

class UpdateSettingsDto {
  @IsOptional() @IsString() businessName?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(23) openHour?: number;
  @IsOptional() @IsInt() @Min(1) @Max(28) closeHour?: number;
  @IsOptional() @IsString() openDays?: string;
  @IsOptional() @IsString() address?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsString() note?: string | null;
}

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  // Okuma: tüm giriş yapmışlar (asistan/öngörü bağlamı + görüntüleme).
  @Get()
  get() {
    return this.settings.get();
  }

  // Yazma: yalnız PATRON/MÜDÜR.
  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Put()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }
}
