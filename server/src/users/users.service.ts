import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ALL_ROLES } from '../auth/roles';
import { isPageKey } from '../auth/pages';

interface CreateUserInput {
  username: string;
  fullName: string;
  password: string;
  role: string;
  extraPages?: string[];
}

interface UpdateUserInput {
  fullName?: string;
  password?: string;
  role?: string;
  active?: boolean;
  extraPages?: string[];
}

const SAFE = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  active: true,
  extraPages: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const rows = await this.prisma.user.findMany({
      select: SAFE,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(withParsedPages);
  }

  async create(input: CreateUserInput) {
    this.assertRole(input.role);
    const exists = await this.prisma.user.findUnique({
      where: { username: input.username },
    });
    if (exists) throw new BadRequestException('Bu kullanıcı adı zaten var');

    const user = await this.prisma.user.create({
      data: {
        username: input.username,
        fullName: input.fullName,
        role: input.role,
        password: await AuthService.hashPassword(input.password),
        extraPages: serializePages(input.extraPages),
      },
      select: SAFE,
    });
    return withParsedPages(user);
  }

  async update(id: string, input: UpdateUserInput) {
    await this.getOrThrow(id);
    if (input.role) this.assertRole(input.role);

    const data: any = {
      fullName: input.fullName,
      role: input.role,
      active: input.active,
    };
    if (input.password) {
      data.password = await AuthService.hashPassword(input.password);
    }
    if (input.extraPages !== undefined) {
      data.extraPages = serializePages(input.extraPages);
    }
    const user = await this.prisma.user.update({ where: { id }, data, select: SAFE });
    return withParsedPages(user);
  }

  async remove(id: string) {
    await this.getOrThrow(id);
    // Silmek yerine pasifleştir (adisyon/işlem geçmişi korunur).
    const user = await this.prisma.user.update({
      where: { id },
      data: { active: false },
      select: SAFE,
    });
    return withParsedPages(user);
  }

  private async getOrThrow(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Kullanıcı bulunamadı');
    return u;
  }

  private assertRole(role: string) {
    if (!ALL_ROLES.includes(role as any)) {
      throw new BadRequestException('Geçersiz rol');
    }
  }
}

// extraPages'i geçerli sayfa anahtarlarına süzüp JSON string'e çevirir (DB için).
function serializePages(pages?: string[]): string | undefined {
  if (pages === undefined) return undefined;
  const valid = [...new Set(pages.filter((p) => isPageKey(p)))];
  return JSON.stringify(valid);
}

// DB satırındaki extraPages string'ini istemciye dizi olarak döndürür.
function withParsedPages<T extends { extraPages?: string | null }>(row: T) {
  let extraPages: string[] = [];
  if (row.extraPages) {
    try {
      const arr = JSON.parse(row.extraPages);
      if (Array.isArray(arr)) extraPages = arr.filter((x) => typeof x === 'string');
    } catch {
      // bozuk JSON → boş
    }
  }
  return { ...row, extraPages };
}
