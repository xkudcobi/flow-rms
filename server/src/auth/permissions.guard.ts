import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { PageKey, canAccessPage, parseExtraPages } from './pages';

export const REQUIRE_PAGE_KEY = 'require_page';

// Bir handler/controller'a erişimi sayfa anahtarına göre kısıtlar. RolesGuard'dan
// farkı: rol varsayılan erişimi YOKSA bile, patron o kullanıcıya kişiye özel
// erişim (User.extraPages) tanımladıysa geçişe izin verir.
// Kullanım: @UseGuards(JwtAuthGuard, PermissionsGuard) + @RequirePage('stok')
export const RequirePage = (page: PageKey) =>
  SetMetadata(REQUIRE_PAGE_KEY, page);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const page = this.reflector.getAllAndOverride<PageKey>(REQUIRE_PAGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!page) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new ForbiddenException('Bu işlem için yetkiniz yok');

    // extraPages taze DB'den okunur: patron izni değiştirince kullanıcının
    // yeniden giriş yapması gerekmez.
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { extraPages: true },
    });
    const extra = parseExtraPages(dbUser?.extraPages);

    if (!canAccessPage(user.role, extra, page)) {
      throw new ForbiddenException('Bu işlem için yetkiniz yok');
    }
    return true;
  }
}
