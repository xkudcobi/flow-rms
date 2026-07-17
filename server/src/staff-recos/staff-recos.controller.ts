import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { StaffRecosService } from './staff-recos.service';
import { JwtAuthGuard, JwtUser } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';
import { CurrentUser } from '../auth/current-user.decorator';

class ManualDto {
  @IsIn(['ROLE', 'USER', 'GROUP']) targetType: 'ROLE' | 'USER' | 'GROUP';
  @IsOptional() @IsString() targetRole?: string;
  @IsOptional() @IsString() targetUserId?: string;
  @IsOptional() @IsString() targetGroupId?: string;
  @IsString() title: string;
  @IsString() body: string;
  @IsOptional() @IsString() severity?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('staff-recos')
export class StaffRecosController {
  constructor(private readonly recos: StaffRecosService) {}

  // Personel: kendine hedefli onaylı tavsiyeler.
  @Get('mine')
  mine(@CurrentUser() user: JwtUser) {
    return this.recos.listForUser(user.sub, user.role);
  }

  @Patch(':id/seen')
  seen(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.recos.markSeen(id, user.sub);
  }

  // --- Yönetici ---
  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Get()
  list(@Query('status') status?: string) {
    return this.recos.listForManager(status);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Post('generate')
  generate() {
    return this.recos.generate();
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Post()
  create(@Body() dto: ManualDto, @CurrentUser() user: JwtUser) {
    return this.recos.createManual(dto, user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Patch(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.recos.approve(id, user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Patch(':id/reject')
  reject(@Param('id') id: string) {
    return this.recos.reject(id);
  }
}
