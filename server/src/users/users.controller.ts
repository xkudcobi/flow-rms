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
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';
import { PAGE_ROLES, grantablePages } from '../auth/pages';

class CreateUserDto {
  @IsString() username: string;
  @IsString() fullName: string;
  @IsString() @MinLength(3) password: string;
  @IsString() role: string;
  @IsOptional() @IsArray() @IsString({ each: true }) extraPages?: string[];
}

class UpdateUserDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() @MinLength(3) password?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) extraPages?: string[];
}

// Kullanıcı yönetimi yalnızca PATRON ve MÜDÜR.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PATRON, ROLES.MUDUR)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  findAll() {
    return this.users.findAll();
  }

  // Kişiye özel verilebilecek sayfalar ve rol varsayılanları — UI izin editörü için.
  @Get('pages')
  pages() {
    return { grantable: grantablePages(), roleDefaults: PAGE_ROLES };
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.users.remove(id);
  }
}
