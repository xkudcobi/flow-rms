import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { parseExtraPages } from './pages';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async validateAndLogin(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !user.active) {
      throw new UnauthorizedException('Kullanıcı adı veya şifre hatalı');
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new UnauthorizedException('Kullanıcı adı veya şifre hatalı');
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
    };
    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        extraPages: parseExtraPages(user.extraPages),
      },
    };
  }

  // Giriş yapmış kullanıcı, kendi eski şifresini doğrulayarak yenisini belirler.
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Kullanıcı bulunamadı');
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) throw new BadRequestException('Mevcut şifre hatalı');
    if (newPassword.length < 3) {
      throw new BadRequestException('Yeni şifre en az 3 karakter olmalı');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: await AuthService.hashPassword(newPassword) },
    });
    return { ok: true };
  }

  static async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }
}
