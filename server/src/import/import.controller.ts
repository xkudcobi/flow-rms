import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { ImportService } from './import.service';
import { JwtAuthGuard, JwtUser } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';
import { CurrentUser } from '../auth/current-user.decorator';

class ImportDto {
  @IsString() csv: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PATRON, ROLES.MUDUR)
@Controller('import')
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  // type: products | customers | stock | sales
  @Post(':type')
  run(
    @Param('type') type: string,
    @Body() dto: ImportDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.imports.run(type, dto.csv, user.sub);
  }
}
