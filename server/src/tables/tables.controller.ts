import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { TablesService } from './tables.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';

class FloorDto {
  @IsString() name: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

class CreateTableDto {
  @IsString() name: string;
  @IsString() floorId: string;
  @IsOptional() @IsInt() seats?: number;
  @IsOptional() @IsInt() posX?: number;
  @IsOptional() @IsInt() posY?: number;
  @IsOptional() @IsString() status?: string;
}

// Güncellemede tüm alanlar opsiyonel (ör. sürükle-bırak yalnız posX/posY,
// adisyon akışı yalnız status gönderir).
class UpdateTableDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() floorId?: string;
  @IsOptional() @IsInt() seats?: number;
  @IsOptional() @IsInt() posX?: number;
  @IsOptional() @IsInt() posY?: number;
  @IsOptional() @IsString() status?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('tables')
export class TablesController {
  constructor(private readonly tables: TablesService) {}

  // Okuma: tüm giriş yapmış kullanıcılar (salon planı için).
  @Get('floors')
  listFloors() {
    return this.tables.listFloors();
  }

  @Get()
  listTables() {
    return this.tables.listTables();
  }

  // Masanın QR self-servis token'ı (yoksa üretir).
  @Get(':id/qr')
  qr(@Param('id') id: string) {
    return this.tables.ensureQrToken(id);
  }

  // Yazma: PATRON / MÜDÜR (salon düzeni). Masa status güncellemesi adisyon
  // akışında (M2) ayrıca ele alınacak.
  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Post('floors')
  createFloor(@Body() dto: FloorDto) {
    return this.tables.createFloor(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Patch('floors/:id')
  updateFloor(@Param('id') id: string, @Body() dto: FloorDto) {
    return this.tables.updateFloor(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Delete('floors/:id')
  removeFloor(@Param('id') id: string) {
    return this.tables.removeFloor(id);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Post()
  createTable(@Body() dto: CreateTableDto) {
    return this.tables.createTable(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Patch(':id')
  updateTable(@Param('id') id: string, @Body() dto: UpdateTableDto) {
    return this.tables.updateTable(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Delete(':id')
  removeTable(@Param('id') id: string) {
    return this.tables.removeTable(id);
  }
}
