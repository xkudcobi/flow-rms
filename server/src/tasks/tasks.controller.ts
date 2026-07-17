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
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { TasksService } from './tasks.service';
import { JwtAuthGuard, JwtUser } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';
import { CurrentUser } from '../auth/current-user.decorator';

class GroupDto {
  @IsString() name: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) memberUserIds?: string[];
}

class CreateTaskDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsIn(['USER', 'GROUP']) assigneeType: 'USER' | 'GROUP';
  @IsOptional() @IsString() assigneeUserId?: string;
  @IsOptional() @IsString() assigneeGroupId?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() recurrence?: any;
  @IsOptional() @IsBoolean() pinTemplate?: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  // --- Gruplar (yalnız yönetici) ---
  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Get('groups')
  listGroups() {
    return this.tasks.listGroups();
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Post('groups')
  createGroup(@Body() dto: GroupDto) {
    return this.tasks.createGroup(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Patch('groups/:id')
  updateGroup(@Param('id') id: string, @Body() dto: GroupDto) {
    return this.tasks.updateGroup(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Delete('groups/:id')
  removeGroup(@Param('id') id: string) {
    return this.tasks.removeGroup(id);
  }

  // --- Şablonlar (yalnız yönetici — görev oluşturma formunda kullanılır) ---
  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Get('templates')
  templates() {
    return this.tasks.listTemplates();
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Get('templates/frequent')
  frequent() {
    return this.tasks.frequentTemplates();
  }

  // --- Görevler ---
  // scope=all yalnız yönetici; varsayılan 'mine' (herkes kendi görevlerini görür).
  @Get()
  list(@CurrentUser() user: JwtUser, @Query('scope') scope?: string) {
    const isManager = user.role === ROLES.PATRON || user.role === ROLES.MUDUR;
    const eff: 'all' | 'mine' = scope === 'all' && isManager ? 'all' : 'mine';
    return this.tasks.listTasks(eff, user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: JwtUser) {
    return this.tasks.createTask(dto, user.sub);
  }

  // Görevi tamamlama — atanan kişi de yapabilsin (herhangi bir giriş yapmış kullanıcı).
  @Patch(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.tasks.completeTask(id, user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasks.removeTask(id);
  }
}
