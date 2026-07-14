import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../orders/orders.gateway';

@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: OrdersGateway,
  ) {}

  listActive() {
    return this.prisma.waiterCall.findMany({
      where: { status: 'BEKLIYOR' },
      orderBy: { createdAt: 'asc' },
      include: { table: { select: { id: true, name: true } } },
    });
  }

  async markHandled(id: string) {
    const c = await this.prisma.waiterCall.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Çağrı bulunamadı');
    await this.prisma.waiterCall.update({
      where: { id },
      data: { status: 'KARSILANDI' },
    });
    this.gateway.emitCallsUpdate();
    return { ok: true };
  }
}
