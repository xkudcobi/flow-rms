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
import { IsOptional, IsString } from 'class-validator';
import { CrmService } from './crm.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';

class CustomerDto {
  @IsString() name: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() birthday?: string; // YYYY-MM-DD
  @IsOptional() @IsString() note?: string;
}
class UpdateCustomerDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() birthday?: string;
  @IsOptional() @IsString() note?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PATRON, ROLES.MUDUR, ROLES.KASIYER)
@Controller('crm')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.crm.list(search);
  }

  @Get('birthdays')
  birthdays() {
    return this.crm.birthdays();
  }

  @Get('top')
  top() {
    return this.crm.top();
  }

  @Get('by-phone')
  byPhone(@Query('phone') phone: string) {
    return this.crm.findByPhone(phone);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.crm.get(id);
  }

  @Post()
  create(@Body() dto: CustomerDto) {
    return this.crm.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.crm.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.crm.remove(id);
  }
}
