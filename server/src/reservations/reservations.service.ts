import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function dayRange(dateStr?: string) {
  const base = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

interface ReservationInput {
  tableId?: string;
  customerName: string;
  phone?: string;
  partySize?: number;
  reservedAt: string;
  note?: string;
}

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Bir günün rezervasyonları (varsayılan bugün).
  list(dateStr?: string) {
    const { start, end } = dayRange(dateStr);
    return this.prisma.reservation.findMany({
      where: { reservedAt: { gte: start, lt: end } },
      orderBy: { reservedAt: 'asc' },
      include: { table: true },
    });
  }

  // Salon için: bugünün bekleyen rezervasyonları (masa işaretlemek üzere).
  activeToday() {
    const { start, end } = dayRange();
    return this.prisma.reservation.findMany({
      where: {
        status: 'BEKLIYOR',
        reservedAt: { gte: start, lt: end },
        tableId: { not: null },
      },
      orderBy: { reservedAt: 'asc' },
      select: {
        id: true,
        tableId: true,
        customerName: true,
        partySize: true,
        reservedAt: true,
      },
    });
  }

  create(input: ReservationInput, userId?: string) {
    if (!input.customerName?.trim())
      throw new BadRequestException('Müşteri adı gerekli');
    if (!input.reservedAt) throw new BadRequestException('Saat gerekli');
    return this.prisma.reservation.create({
      data: {
        tableId: input.tableId || null,
        customerName: input.customerName,
        phone: input.phone,
        partySize: input.partySize && input.partySize > 0 ? input.partySize : 2,
        reservedAt: new Date(input.reservedAt),
        note: input.note,
        createdById: userId,
      },
      include: { table: true },
    });
  }

  async update(
    id: string,
    data: Partial<ReservationInput> & { status?: string },
  ) {
    await this.getOrThrow(id);
    if (data.status && !['BEKLIYOR', 'GELDI', 'IPTAL', 'GELMEDI'].includes(data.status))
      throw new BadRequestException('Geçersiz durum');
    return this.prisma.reservation.update({
      where: { id },
      data: {
        tableId: data.tableId,
        customerName: data.customerName,
        phone: data.phone,
        partySize: data.partySize,
        reservedAt: data.reservedAt ? new Date(data.reservedAt) : undefined,
        note: data.note,
        status: data.status,
      },
      include: { table: true },
    });
  }

  async remove(id: string) {
    await this.getOrThrow(id);
    return this.prisma.reservation.update({
      where: { id },
      data: { status: 'IPTAL' },
    });
  }

  private async getOrThrow(id: string) {
    const r = await this.prisma.reservation.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Rezervasyon bulunamadı');
    return r;
  }
}
