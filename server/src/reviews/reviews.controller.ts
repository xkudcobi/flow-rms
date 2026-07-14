import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, ROLES } from '../auth/roles';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PATRON, ROLES.MUDUR)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list() {
    return this.reviews.list();
  }

  // Elle yenile (periyodik senkronizasyona ek).
  @Post('sync')
  sync() {
    return this.reviews.sync();
  }

  // Bildirim rozetini sıfırla (ekran görüldü).
  @Post('seen')
  seen() {
    return this.reviews.markSeen();
  }
}
