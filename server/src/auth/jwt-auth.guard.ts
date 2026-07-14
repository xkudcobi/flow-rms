import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface JwtUser {
  sub: string;
  username: string;
  role: string;
  fullName: string;
}

// Authorization: Bearer <token> başlığını doğrular ve request.user'a kullanıcıyı koyar.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token bulunamadı');
    }
    const token = auth.slice(7);
    try {
      const payload = await this.jwt.verifyAsync<JwtUser>(token);
      (req as any).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş token');
    }
  }
}
