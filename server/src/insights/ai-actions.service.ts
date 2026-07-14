import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TablesService } from '../tables/tables.service';
import { OrdersService } from '../orders/orders.service';
import { Role, ROLES } from '../auth/roles';

export interface ActionActor {
  userId: string;
  role: Role;
}

interface ActionDef {
  id: string;
  roles: Role[]; // bu işlemi yapabilecek roller
  pages: string[]; // hangi sayfalarda önerilir ('*' = her yerde)
  // Modele verilecek açıklama + parametreler.
  desc: string;
  execute: (params: any, actor: ActionActor) => Promise<{ message: string }>;
}

// Türkçe küçük harf + sadeleştirme (eşleştirme için).
const norm = (s: string) =>
  (s || '')
    .toLocaleLowerCase('tr')
    .replace('i̇', 'i')
    .trim();

@Injectable()
export class AiActionsService {
  private readonly actions: ActionDef[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly tables: TablesService,
    private readonly orders: OrdersService,
  ) {
    this.actions = this.buildCatalog();
  }

  // Modele verilecek "yapılabilir işlemler" metni (sayfaya göre — TÜM işlemler,
  // rol notuyla). Rol kısıtı check()/execute() içinde uygulanır ki model yanlış
  // işlem önerse bile kullanıcı net "yetkiniz yok" yanıtı alsın.
  describeFor(page: string, role: Role): string {
    const list = this.actions.filter(
      (a) => a.pages.includes('*') || a.pages.includes(page),
    );
    if (!list.length) return '(Bu sayfada tanımlı işlem yok — yalnız soruları yanıtla.)';
    return list
      .map((a) => {
        const allowed = a.roles.includes(role) ? '' : ' [bu kullanıcının yetkisi YOK]';
        return `- ${a.id}: ${a.desc}${allowed}`;
      })
      .join('\n');
  }

  // İşlem role uygun mu + tanımlı mı? (Öneri aşamasında kontrol.)
  check(actionId: string, role: Role): { ok: boolean; reason?: string } {
    const def = this.actions.find((a) => a.id === actionId);
    if (!def) return { ok: false, reason: 'Böyle bir işlem yok.' };
    if (!def.roles.includes(role))
      return { ok: false, reason: 'Bu işlem için yetkiniz yok.' };
    return { ok: true };
  }

  // Onaylanan işlemi yürüt (rol tekrar burada kontrol edilir — güvenlik sınırı).
  async execute(actionId: string, params: any, actor: ActionActor) {
    const def = this.actions.find((a) => a.id === actionId);
    if (!def) throw new BadRequestException('Böyle bir işlem yok.');
    if (!def.roles.includes(actor.role))
      throw new ForbiddenException('Bu işlem için yetkiniz yok.');
    return def.execute(params || {}, actor);
  }

  // --- yardımcılar ---

  private async resolveFloor(name: string) {
    const floors = await this.prisma.floor.findMany();
    const n = norm(name);
    return (
      floors.find((f) => norm(f.name) === n) ||
      floors.find((f) => norm(f.name).includes(n) || n.includes(norm(f.name)))
    );
  }

  private async resolveTable(name: string) {
    const tables = await this.prisma.restaurantTable.findMany();
    const n = norm(name);
    const digits = (n.match(/\d+/) || [])[0];
    return (
      tables.find((t) => norm(t.name) === n) ||
      (digits ? tables.find((t) => (norm(t.name).match(/\d+/) || [])[0] === digits) : undefined)
    );
  }

  private buildCatalog(): ActionDef[] {
    return [
      {
        id: 'add_floor',
        roles: [ROLES.PATRON, ROLES.MUDUR],
        pages: ['salon'],
        desc: 'Yeni kat/salon ekler. params: { name: string }',
        execute: async (p) => {
          const name = String(p.name || '').trim();
          if (!name) throw new BadRequestException('Kat adı gerekli');
          await this.tables.createFloor({ name });
          return { message: `"${name}" katı eklendi.` };
        },
      },
      {
        id: 'add_tables',
        roles: [ROLES.PATRON, ROLES.MUDUR],
        pages: ['salon'],
        desc: 'Belirtilen kata masa ekler. params: { floorName: string, count: number, seats?: number }',
        execute: async (p) => {
          const count = Math.max(1, Math.min(50, Number(p.count) || 1));
          const seats = p.seats ? Math.max(1, Math.min(30, Number(p.seats))) : 4;
          let floor = await this.resolveFloor(String(p.floorName || ''));
          if (!floor) {
            // Kat yoksa ve isim verildiyse oluştur.
            const name = String(p.floorName || '').trim();
            if (!name) throw new BadRequestException('Hangi kata? Kat adı gerekli.');
            floor = await this.tables.createFloor({ name });
          }
          // Sıradaki masa numaraları (mevcut en büyük sayısal addan devam).
          const all = await this.prisma.restaurantTable.findMany();
          let maxNum = 0;
          for (const t of all) {
            const m = (t.name.match(/\d+/) || [])[0];
            if (m) maxNum = Math.max(maxNum, Number(m));
          }
          const created: string[] = [];
          for (let i = 0; i < count; i++) {
            const name = String(maxNum + 1 + i);
            await this.tables.createTable({ name, floorId: floor.id, seats });
            created.push(name);
          }
          return {
            message: `${floor.name} katına ${count} masa eklendi (${created.join(', ')}).`,
          };
        },
      },
      {
        id: 'merge_tables',
        roles: [ROLES.PATRON, ROLES.MUDUR, ROLES.KASIYER],
        pages: ['salon'],
        desc: 'İki masayı birleştirir. params: { tableA: string, tableB: string }',
        execute: async (p) => {
          const a = await this.resolveTable(String(p.tableA || ''));
          const b = await this.resolveTable(String(p.tableB || ''));
          if (!a || !b) throw new BadRequestException('Masalardan biri bulunamadı.');
          if (a.id === b.id) throw new BadRequestException('Aynı masa seçilemez.');
          const [ordA, ordB] = await Promise.all([
            this.prisma.order.findFirst({ where: { tableId: a.id, status: 'ACIK' } }),
            this.prisma.order.findFirst({ where: { tableId: b.id, status: 'ACIK' } }),
          ]);
          if (!ordA && !ordB)
            throw new BadRequestException(
              'Birleştirilecek açık adisyon yok. Önce en az bir masada sipariş açılmalı.',
            );
          // Kaynağı hedefe taşı: açık adisyonu olan → diğerine.
          if (ordA) await this.orders.mergeOrder(ordA.id, b.id);
          else await this.orders.mergeOrder(ordB!.id, a.id);
          return { message: `Masa ${a.name} ve ${b.name} birleştirildi.` };
        },
      },
    ];
  }
}
