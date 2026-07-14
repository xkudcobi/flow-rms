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
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { AccountsService } from './accounts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtUser } from '../auth/jwt-auth.guard';

class AccountDto {
  @IsString() name: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() taxNumber?: string;
  @IsOptional() @IsString() taxOffice?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() iban?: string;
}
class TransactionDto {
  @IsString() type: string; // BORC | ALACAK | ALIS | ODEME
  @IsNumber() @Min(0.01) amount: number;
  @IsOptional() @IsString() description?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PATRON, ROLES.MUDUR, ROLES.KASIYER)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list(@Query('type') type?: string) {
    return this.accounts.list(type);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.accounts.detail(id);
  }

  @Post()
  create(@Body() dto: AccountDto) {
    return this.accounts.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: AccountDto) {
    return this.accounts.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.accounts.remove(id);
  }

  @Post(':id/transactions')
  addTransaction(
    @Param('id') id: string,
    @Body() dto: TransactionDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.accounts.addTransaction(id, dto, user.sub);
  }
}
