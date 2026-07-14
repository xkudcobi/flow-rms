import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { InsightsService } from './insights.service';
import { AiService } from './ai.service';
import { JwtAuthGuard, JwtUser } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES, Role } from '../auth/roles';
import { CurrentUser } from '../auth/current-user.decorator';

class AskDto {
  @IsString() question: string;
  @IsOptional() @IsString() page?: string;
}
class ActDto {
  @IsString() actionId: string;
  @IsOptional() @IsObject() params?: Record<string, any>;
}

@UseGuards(JwtAuthGuard)
@Controller('insights')
export class InsightsController {
  constructor(
    private readonly insights: InsightsService,
    private readonly ai: AiService,
  ) {}

  // Öngörü paketi: yalnız yönetim (özet/tahmin/öneri).
  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Get()
  overview() {
    return this.insights.overview();
  }

  // AI durum + sohbet: tüm giriş yapmış roller (asistan her ekranda).
  @Get('ai/status')
  aiStatus() {
    return this.ai.status();
  }

  // Yorum/geri bildirim AI özeti (yalnız yönetim).
  @UseGuards(RolesGuard)
  @Roles(ROLES.PATRON, ROLES.MUDUR)
  @Get('ai/review-summary')
  reviewSummary() {
    return this.ai.reviewSummary();
  }

  @Post('ai/ask')
  ask(@Body() dto: AskDto, @CurrentUser() user: JwtUser) {
    return this.ai.ask(dto.question, {
      page: dto.page,
      role: user.role as Role,
    });
  }

  // Onaylanan işlemi yürüt — rol kontrolü serviste tekrar yapılır (güvenlik).
  @Post('ai/act')
  act(@Body() dto: ActDto, @CurrentUser() user: JwtUser) {
    return this.ai.act(dto.actionId, dto.params || {}, {
      userId: user.sub,
      role: user.role as Role,
    });
  }
}
