import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ALL_ROLES } from '../auth/roles';

interface CreateUserInput {
  username: string;
  fullName: string;
  password: string;
  role: string;
}

interface UpdateUserInput {
  fullName?: string;
  password?: string;
  role?: string;
  active?: boolean;
}

const SAFE = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: SAFE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(input: CreateUserInput) {
    this.assertRole(input.role);
    const exists = await this.prisma.user.findUnique({
      where: { username: input.username },
    });
    if (exists) throw new BadRequestException('Bu kullanıcı adı zaten var');

    return this.prisma.user.create({
      data: {
        username: input.username,
        fullName: input.fullName,
        role: input.role,
        password: await AuthService.hashPassword(input.password),
      },
      select: SAFE,
    });
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
    return this.prisma.user.update({ where: { id }, data, select: SAFE });
  }

  async remove(id: string) {
    await this.getOrThrow(id);
    // Silmek yerine pasifleştir (adisyon/işlem geçmişi korunur).
    return this.prisma.user.update({
      where: { id },
      data: { active: false },
      select: SAFE,
    });
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
