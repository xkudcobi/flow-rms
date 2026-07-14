import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Katlar / Salonlar ---
  listFloors() {
    return this.prisma.floor.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { tables: { orderBy: { name: 'asc' } } },
    });
  }

  createFloor(data: { name: string; sortOrder?: number }) {
    return this.prisma.floor.create({ data });
  }

  async updateFloor(id: string, data: { name?: string; sortOrder?: number }) {
    await this.getFloorOrThrow(id);
    return this.prisma.floor.update({ where: { id }, data });
  }

  async removeFloor(id: string) {
    await this.getFloorOrThrow(id);
    // Açık adisyonu olan katı silme.
    const openCount = await this.prisma.order.count({
      where: { status: 'ACIK', table: { floorId: id } },
    });
    if (openCount > 0)
      throw new BadRequestException(
        'Bu kat/salonda açık adisyon var. Önce hesapları kapatın.',
      );
    // Kat silinince bağlı masalar da silinir (kapalı adisyonların masa bağı kopar).
    await this.prisma.restaurantTable.deleteMany({ where: { floorId: id } });
    return this.prisma.floor.delete({ where: { id } });
  }

  // --- Masalar ---
  listTables() {
    return this.prisma.restaurantTable.findMany({
      orderBy: { name: 'asc' },
      include: { floor: true },
    });
  }

  createTable(data: {
    name: string;
    floorId: string;
    seats?: number;
    posX?: number;
    posY?: number;
  }) {
    return this.prisma.restaurantTable.create({ data });
  }

  async updateTable(
    id: string,
    data: {
      name?: string;
      floorId?: string;
      seats?: number;
      posX?: number;
      posY?: number;
      status?: string;
    },
  ) {
    await this.getTableOrThrow(id);
    return this.prisma.restaurantTable.update({ where: { id }, data });
  }

  // Masaya QR self-servis token'ı üretir (yoksa) ve döner.
  async ensureQrToken(id: string) {
    const t = await this.getTableOrThrow(id);
    if (t.qrToken) return { token: t.qrToken };
    const token = randomBytes(9).toString('base64url');
    await this.prisma.restaurantTable.update({
      where: { id },
      data: { qrToken: token },
    });
    return { token };
  }

  async removeTable(id: string) {
    await this.getTableOrThrow(id);
    const openCount = await this.prisma.order.count({
      where: { status: 'ACIK', tableId: id },
    });
    if (openCount > 0)
      throw new BadRequestException(
        'Bu masada açık adisyon var. Önce hesabı kapatın.',
      );
    return this.prisma.restaurantTable.delete({ where: { id } });
  }

  private async getFloorOrThrow(id: string) {
    const f = await this.prisma.floor.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('Kat/salon bulunamadı');
    return f;
  }

  private async getTableOrThrow(id: string) {
    const t = await this.prisma.restaurantTable.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Masa bulunamadı');
    return t;
  }
}
