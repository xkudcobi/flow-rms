import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface GroupInput {
  name: string;
  active?: boolean;
  memberUserIds?: string[];
}

interface TaskInput {
  title: string;
  description?: string;
  assigneeType: 'USER' | 'GROUP';
  assigneeUserId?: string;
  assigneeGroupId?: string;
  dueDate?: string;
  // Tekrar kuralı: null | {freq:'daily'} | {freq:'weekly',days:[1,3]}
  recurrence?: Recurrence | null;
  // Bu görevi kalıcı (sık kullanılan) şablon olarak sabitle.
  pinTemplate?: boolean;
}

type Recurrence =
  | { freq: 'daily' }
  | { freq: 'weekly'; days: number[] };

// Sık kullanılan şablon eşiği: bu kadar kez eklenen başlık "önerilenler"e çıkar.
const FREQUENT_THRESHOLD = 3;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Personel grupları -----------------------------------------------------

  async listGroups() {
    const groups = await this.prisma.staffGroup.findMany({
      where: { active: true },
      include: { members: { include: { user: { select: { id: true, fullName: true, role: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      active: g.active,
      members: g.members.map((m) => ({
        userId: m.userId,
        fullName: m.user.fullName,
        role: m.user.role,
      })),
    }));
  }

  async createGroup(input: GroupInput) {
    if (!input.name?.trim()) throw new BadRequestException('Grup adı gerekli');
    const group = await this.prisma.staffGroup.create({ data: { name: input.name.trim() } });
    if (input.memberUserIds?.length) {
      await this.setMembers(group.id, input.memberUserIds);
    }
    return this.getGroup(group.id);
  }

  async updateGroup(id: string, input: GroupInput) {
    await this.getGroupOrThrow(id);
    await this.prisma.staffGroup.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        active: input.active,
      },
    });
    if (input.memberUserIds) {
      await this.setMembers(id, input.memberUserIds);
    }
    return this.getGroup(id);
  }

  async removeGroup(id: string) {
    await this.getGroupOrThrow(id);
    // Görevlerde referansı olabilir; silmek yerine pasifleştir.
    await this.prisma.staffGroup.update({ where: { id }, data: { active: false } });
    return { ok: true };
  }

  private async setMembers(groupId: string, userIds: string[]) {
    const unique = [...new Set(userIds)];
    await this.prisma.staffGroupMember.deleteMany({ where: { groupId } });
    if (unique.length) {
      await this.prisma.staffGroupMember.createMany({
        data: unique.map((userId) => ({ groupId, userId })),
      });
    }
  }

  private async getGroup(id: string) {
    const list = await this.listGroups();
    const found = list.find((g) => g.id === id);
    if (found) return found;
    // pasif grup da dönebilsin
    const g = await this.prisma.staffGroup.findUnique({
      where: { id },
      include: { members: { include: { user: { select: { id: true, fullName: true, role: true } } } } },
    });
    if (!g) throw new NotFoundException('Grup bulunamadı');
    return {
      id: g.id,
      name: g.name,
      active: g.active,
      members: g.members.map((m) => ({ userId: m.userId, fullName: m.user.fullName, role: m.user.role })),
    };
  }

  private async getGroupOrThrow(id: string) {
    const g = await this.prisma.staffGroup.findUnique({ where: { id } });
    if (!g) throw new NotFoundException('Grup bulunamadı');
    return g;
  }

  // --- Görevler --------------------------------------------------------------

  // scope 'all': tüm görevler (yönetici). 'mine': kullanıcının kendi + üyesi
  // olduğu grupların görevleri.
  async listTasks(scope: 'all' | 'mine', userId: string) {
    let where: any = {};
    if (scope === 'mine') {
      const groupIds = (
        await this.prisma.staffGroupMember.findMany({
          where: { userId },
          select: { groupId: true },
        })
      ).map((m) => m.groupId);
      where = {
        OR: [
          { assigneeUserId: userId },
          groupIds.length ? { assigneeGroupId: { in: groupIds } } : undefined,
        ].filter(Boolean),
      };
    }
    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        assigneeUser: { select: { id: true, fullName: true } },
        assigneeGroup: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      assigneeType: t.assigneeType,
      assignee:
        t.assigneeType === 'GROUP'
          ? { type: 'GROUP', id: t.assigneeGroupId, name: t.assigneeGroup?.name }
          : { type: 'USER', id: t.assigneeUserId, name: t.assigneeUser?.fullName },
      dueDate: t.dueDate,
      status: t.status,
      recurrence: parseRecurrence(t.recurrence),
      createdBy: t.createdBy?.fullName,
      completedAt: t.completedAt,
      createdAt: t.createdAt,
    }));
  }

  async createTask(input: TaskInput, createdById: string) {
    if (!input.title?.trim()) throw new BadRequestException('Görev başlığı gerekli');
    if (input.assigneeType === 'USER' && !input.assigneeUserId) {
      throw new BadRequestException('Atanacak kullanıcı seçilmeli');
    }
    if (input.assigneeType === 'GROUP' && !input.assigneeGroupId) {
      throw new BadRequestException('Atanacak grup seçilmeli');
    }
    const recurrence = normalizeRecurrence(input.recurrence);

    const task = await this.prisma.task.create({
      data: {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        assigneeType: input.assigneeType,
        assigneeUserId: input.assigneeType === 'USER' ? input.assigneeUserId : null,
        assigneeGroupId: input.assigneeType === 'GROUP' ? input.assigneeGroupId : null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        recurrence: recurrence ? JSON.stringify(recurrence) : null,
        createdById,
      },
    });

    // Şablon istatistiği: aynı başlık ne sıklıkla ekleniyor? (tekrar yazmaya
    // gerek kalmasın diye "önerilenler" listesini besler.)
    await this.bumpTemplate(input, recurrence);

    return task;
  }

  async completeTask(id: string, userId: string) {
    const t = await this.prisma.task.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Görev bulunamadı');
    if (t.status === 'TAMAMLANDI') return t;

    const done = await this.prisma.task.update({
      where: { id },
      data: { status: 'TAMAMLANDI', completedById: userId, completedAt: new Date() },
    });

    // Tekrarlayan görevse bir sonraki örneği oluştur.
    const rec = parseRecurrence(t.recurrence);
    if (rec) {
      const next = nextDueDate(rec, t.dueDate ?? new Date());
      await this.prisma.task.create({
        data: {
          title: t.title,
          description: t.description,
          assigneeType: t.assigneeType,
          assigneeUserId: t.assigneeUserId,
          assigneeGroupId: t.assigneeGroupId,
          dueDate: next,
          recurrence: t.recurrence,
          templateId: t.templateId,
          createdById: t.createdById,
        },
      });
    }
    return done;
  }

  async removeTask(id: string) {
    const t = await this.prisma.task.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Görev bulunamadı');
    await this.prisma.task.update({ where: { id }, data: { status: 'IPTAL' } });
    return { ok: true };
  }

  // --- Şablonlar (sık kullanılan görevler) -----------------------------------

  async listTemplates() {
    return this.prisma.taskTemplate.findMany({
      orderBy: [{ pinned: 'desc' }, { useCount: 'desc' }, { title: 'asc' }],
    });
  }

  // "Önerilenler": sabitlenmiş VEYA sık eklenmiş şablonlar.
  async frequentTemplates() {
    return this.prisma.taskTemplate.findMany({
      where: { OR: [{ pinned: true }, { useCount: { gte: FREQUENT_THRESHOLD } }] },
      orderBy: [{ pinned: 'desc' }, { useCount: 'desc' }],
      take: 20,
    });
  }

  private async bumpTemplate(input: TaskInput, recurrence: Recurrence | null) {
    const title = input.title.trim();
    const existing = await this.prisma.taskTemplate.findUnique({ where: { title } });
    if (existing) {
      await this.prisma.taskTemplate.update({
        where: { title },
        data: {
          useCount: { increment: 1 },
          // Kullanıcı kalıcı işaretlediyse veya tekrarlayan yaptıysa sabitle.
          pinned: existing.pinned || !!input.pinTemplate || !!recurrence,
          recurrence: recurrence ? JSON.stringify(recurrence) : existing.recurrence,
        },
      });
    } else {
      await this.prisma.taskTemplate.create({
        data: {
          title,
          description: input.description?.trim() || null,
          defaultAssigneeType: input.assigneeType,
          defaultAssigneeId:
            input.assigneeType === 'GROUP' ? input.assigneeGroupId : input.assigneeUserId,
          recurrence: recurrence ? JSON.stringify(recurrence) : null,
          useCount: 1,
          pinned: !!input.pinTemplate || !!recurrence,
        },
      });
    }
  }
}

// --- Yardımcılar -------------------------------------------------------------

function parseRecurrence(raw: string | null): Recurrence | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw);
    return normalizeRecurrence(r);
  } catch {
    return null;
  }
}

function normalizeRecurrence(r: Recurrence | null | undefined): Recurrence | null {
  if (!r || typeof r !== 'object') return null;
  if (r.freq === 'daily') return { freq: 'daily' };
  if (r.freq === 'weekly') {
    const days = Array.isArray((r as any).days)
      ? (r as any).days.filter((d: any) => Number.isInteger(d) && d >= 0 && d <= 6)
      : [];
    if (!days.length) return null;
    return { freq: 'weekly', days };
  }
  return null;
}

// Tekrar kuralına göre bir sonraki vade tarihi (referanstan sonraki ilk uygun gün).
function nextDueDate(rec: Recurrence, from: Date): Date {
  const base = new Date(from);
  if (rec.freq === 'daily') {
    base.setDate(base.getDate() + 1);
    return base;
  }
  // weekly: from'dan sonraki, days içinde yer alan ilk gün.
  for (let i = 1; i <= 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    if (rec.days.includes(d.getDay())) return d;
  }
  base.setDate(base.getDate() + 7);
  return base;
}
