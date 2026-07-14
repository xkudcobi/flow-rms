import { Controller, Get, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard, JwtUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role } from '../auth/roles';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // Kullanıcının rolüne göre güncel bildirimler + nav rozet sayıları.
  @Get()
  snapshot(@CurrentUser() user: JwtUser) {
    return this.notifications.snapshot(user.role as Role);
  }
}
