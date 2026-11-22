import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { JwtUser } from './jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { parseExtraPages } from './pages';

class LoginDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(3)
  password: string;
}

class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString() @MinLength(3) newPassword: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  // Giriş denemesi limiti: IP başına 5 dakikada 10 deneme.
  // Gerçek kullanıcı şifresini yanlış yazsa bile rahat rahat düzeltir; ama
  // sözlük saldırısı 5 dakikada 10 denemeye düşünce anlamsızlaşır.
  // Uzaktan erişimde bu, sistemi internete açan tek kapının kilididir.
  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.validateAndLogin(dto.username, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: JwtUser) {
    // Rol ve sayfa izinleri DB'den taze okunur (patron değişiklik yapmış
    // olabilir; token'a bakmak eski veriyi gösterirdi).
    const db = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { role: true, fullName: true, extraPages: true, active: true },
    });
    return {
      id: user.sub,
      username: user.username,
      fullName: db?.fullName ?? user.fullName,
      role: db?.role ?? user.role,
      extraPages: parseExtraPages(db?.extraPages),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@CurrentUser() user: JwtUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }
}
