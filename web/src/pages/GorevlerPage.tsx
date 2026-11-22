import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Modal from '../components/Modal';
import { Button, Field, Input, Select } from '../components/ui';
import { CheckCircle2, Circle, Trash2, Users, RefreshCw } from 'lucide-react';

interface TaskRow {
  id: string;
  title: string;
  description?: string | null;
  assigneeType: 'USER' | 'GROUP';
  assignee: { type: string; id?: string | null; name?: string | null };
  dueDate?: string | null;
  status: string;
  recurrence?: { freq: string; days?: number[] } | null;
  createdBy?: string;
  completedAt?: string | null;
}
interface GroupRow {
  id: string;
  name: string;
  active: boolean;
  members: { userId: string; fullName: string; role: string }[];
}
interface UserRow {
  id: string;
  fullName: string;
  role: string;
  active: boolean;
}
interface Template {
  id: string;
  title: string;
  description?: string | null;
  defaultAssigneeType?: string | null;
  defaultAssigneeId?: string | null;
  recurrence?: string | null;
  useCount: number;
  pinned: boolean;
}

const DAY_LABELS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

function recurrenceLabel(r?: { freq: string; days?: number[] } | null): string {
  if (!r) return '';
  if (r.freq === 'daily') return 'Her gün';
  if (r.freq === 'weekly') return 'Haftalık: ' + (r.days ?? []).map((d) => DAY_LABELS[d]).join(', ');
  return '';
}

export default function GorevlerPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'PATRON' || user?.role === 'MUDUR';
  const [tab, setTab] = useState<'mine' | 'all' | 'groups'>('mine');
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [error, setError] = useState('');
  const [taskModal, setTaskModal] = useState(false);
  const [groupModal, setGroupModal] = useState<GroupRow | 'new' | null>(null);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

  async function loadTasks(scope: 'mine' | 'all') {
    try {
      setTasks(await api.get<TaskRow[]>(`/tasks${scope === 'all' ? '?scope=all' : ''}`));
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function loadGroups() {
    try {
      setGroups(await api.get<GroupRow[]>('/tasks/groups'));
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function loadUsers() {
    try {
      setUsers(await api.get<UserRow[]>('/users'));
    } catch {
      /* yönetici değilse atla */
    }
  }

  useEffect(() => {
    if (tab === 'groups') loadGroups();
    else loadTasks(tab);
  }, [tab]);
  useEffect(() => {
    if (isManager) loadUsers();
  }, [isManager]);

  async function complete(id: string) {
    try {
      await api.patch(`/tasks/${id}/complete`, {});
      loadTasks(tab === 'all' ? 'all' : 'mine');
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function removeTask(id: string) {
    try {
      await api.delete(`/tasks/${id}`);
      loadTasks(tab === 'all' ? 'all' : 'mine');
    } catch (e: any) {
      setError(e.message);
    }
  }

  const openTasks = tasks.filter((t) => t.status === 'ACIK');
  const doneTasks = tasks.filter((t) => t.status === 'TAMAMLANDI');

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">Görevler</h1>
        {isManager && tab !== 'groups' && (
          <Button onClick={() => setTaskModal(true)}>+ Görev</Button>
        )}
        {isManager && tab === 'groups' && (
          <Button onClick={() => setGroupModal('new')}>+ Grup</Button>
        )}
      </div>

      {/* Sekmeler */}
      <div className="mb-4 flex gap-1 border-b border-line">
        <TabBtn active={tab === 'mine'} onClick={() => setTab('mine')}>
          Görevlerim
        </TabBtn>
        {isManager && (
          <>
            <TabBtn active={tab === 'all'} onClick={() => setTab('all')}>
              Tüm Görevler
            </TabBtn>
            <TabBtn active={tab === 'groups'} onClick={() => setTab('groups')}>
              Personel Grupları
            </TabBtn>
          </>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {tab === 'groups' ? (
        <GroupList
          groups={groups}
          onEdit={(g) => setGroupModal(g)}
          onRemove={async (id) => {
            await api.delete(`/tasks/groups/${id}`);
            loadGroups();
          }}
        />
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              Açık ({openTasks.length})
            </h2>
            {openTasks.length === 0 ? (
              <p className="text-sm text-faint">Açık görev yok.</p>
            ) : (
              <div className="space-y-2">
                {openTasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    canRemove={isManager}
                    onComplete={() => complete(t.id)}
                    onRemove={() => removeTask(t.id)}
                  />
                ))}
              </div>
            )}
          </section>
          {doneTasks.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                Tamamlanan ({doneTasks.length})
              </h2>
              <div className="space-y-2 opacity-60">
                {doneTasks.slice(0, 30).map((t) => (
                  <TaskCard key={t.id} task={t} done />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {taskModal && (
        <TaskForm
          users={users.filter((u) => u.active)}
          groups={groups.length ? groups : undefined}
          onNeedGroups={loadGroups}
          onClose={() => setTaskModal(false)}
          onSaved={() => {
            setTaskModal(false);
            setTab((cur) => cur);
            loadTasks(tab === 'all' ? 'all' : 'mine');
          }}
        />
      )}
      {groupModal && (
        <GroupForm
          value={groupModal === 'new' ? null : groupModal}
          users={users.filter((u) => u.active)}
          onClose={() => setGroupModal(null)}
          onSaved={() => {
            setGroupModal(null);
            loadGroups();
          }}
        />
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-brand text-brand'
          : 'border-transparent text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function TaskCard({
  task,
  done,
  canRemove,
  onComplete,
  onRemove,
}: {
  task: TaskRow;
  done?: boolean;
  canRemove?: boolean;
  onComplete?: () => void;
  onRemove?: () => void;
}) {
  const overdue =
    !done && task.dueDate && new Date(task.dueDate).getTime() < Date.now();
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-card p-3">
      <button
        onClick={onComplete}
        disabled={done || !onComplete}
        className={done ? 'text-success' : 'text-faint hover:text-brand'}
        title={done ? 'Tamamlandı' : 'Tamamla'}
      >
        {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`font-medium text-ink ${done ? 'line-through' : ''}`}>
          {task.title}
        </div>
        {task.description && (
          <div className="text-sm text-muted">{task.description}</div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-faint">
          <span className="inline-flex items-center gap-1 rounded bg-surface-low px-1.5 py-0.5">
            {task.assigneeType === 'GROUP' ? <Users size={12} /> : null}
            {task.assignee?.name ?? '—'}
          </span>
          {task.dueDate && (
            <span className={overdue ? 'font-medium text-red-600' : ''}>
              {new Date(task.dueDate).toLocaleDateString('tr-TR')}
              {overdue ? ' · gecikti' : ''}
            </span>
          )}
          {task.recurrence && (
            <span className="inline-flex items-center gap-1 text-brand">
              <RefreshCw size={11} />
              {recurrenceLabel(task.recurrence)}
            </span>
          )}
        </div>
      </div>
      {canRemove && onRemove && (
        <button
          onClick={onRemove}
          className="text-faint hover:text-red-500"
          title="Sil / iptal et"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

function GroupList({
  groups,
  onEdit,
  onRemove,
}: {
  groups: GroupRow[];
  onEdit: (g: GroupRow) => void;
  onRemove: (id: string) => void;
}) {
  if (groups.length === 0)
    return <p className="text-sm text-faint">Henüz grup yok. "+ Grup" ile ekleyin.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => (
        <div key={g.id} className="rounded-lg border border-line bg-surface-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-ink">
              <Users size={16} className="text-brand" />
              {g.name}
            </div>
            <div className="flex gap-2 text-xs">
              <button onClick={() => onEdit(g)} className="text-muted hover:text-brand">
                düzenle
              </button>
              <button onClick={() => onRemove(g.id)} className="text-faint hover:text-red-500">
                sil
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {g.members.length === 0 ? (
              <span className="text-xs text-faint">Üye yok</span>
            ) : (
              g.members.map((m) => (
                <span
                  key={m.userId}
                  className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand"
                >
                  {m.fullName}
                </span>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskForm({
  users,
  groups,
  onNeedGroups,
  onClose,
  onSaved,
}: {
  users: UserRow[];
  groups?: GroupRow[];
  onNeedGroups: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeType, setAssigneeType] = useState<'USER' | 'GROUP'>('USER');
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [assigneeGroupId, setAssigneeGroupId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [freq, setFreq] = useState<'none' | 'daily' | 'weekly'>('none');
  const [weekDays, setWeekDays] = useState<number[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    onNeedGroups();
    api.get<Template[]>('/tasks/templates/frequent').then(setTemplates).catch(() => {});
  }, []);

  function applyTemplate(t: Template) {
    setTitle(t.title);
    setDescription(t.description || '');
    if (t.recurrence) {
      try {
        const r = JSON.parse(t.recurrence);
        if (r.freq === 'daily') setFreq('daily');
        else if (r.freq === 'weekly') {
          setFreq('weekly');
          setWeekDays(r.days || []);
        }
      } catch {
        /* yok say */
      }
    }
    if (t.defaultAssigneeType === 'GROUP' && t.defaultAssigneeId) {
      setAssigneeType('GROUP');
      setAssigneeGroupId(t.defaultAssigneeId);
    } else if (t.defaultAssigneeType === 'USER' && t.defaultAssigneeId) {
      setAssigneeType('USER');
      setAssigneeUserId(t.defaultAssigneeId);
    }
  }

  function toggleDay(d: number) {
    setWeekDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }

  const recurrence =
    freq === 'daily'
      ? { freq: 'daily' }
      : freq === 'weekly' && weekDays.length
        ? { freq: 'weekly', days: weekDays }
        : null;

  const valid =
    title.trim() &&
    (assigneeType === 'USER' ? assigneeUserId : assigneeGroupId) &&
    (freq !== 'weekly' || weekDays.length > 0);

  async function save() {
    setBusy(true);
    setErr('');
    try {
      await api.post('/tasks', {
        title,
        description,
        assigneeType,
        assigneeUserId: assigneeType === 'USER' ? assigneeUserId : undefined,
        assigneeGroupId: assigneeType === 'GROUP' ? assigneeGroupId : undefined,
        dueDate: dueDate || undefined,
        recurrence,
        pinTemplate: !!recurrence,
      });
      onSaved();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Yeni Görev"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={save} disabled={busy || !valid}>
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </>
      }
    >
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}

      {templates.length > 0 && (
        <Field label="Sık kullanılan görevlerden seç">
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-brand hover:text-brand"
              >
                {t.title}
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field label="Başlık">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </Field>
      <Field label="Açıklama (isteğe bağlı)">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Atama Türü">
          <Select
            value={assigneeType}
            onChange={(e) => setAssigneeType(e.target.value as 'USER' | 'GROUP')}
          >
            <option value="USER">Kişi</option>
            <option value="GROUP">Grup</option>
          </Select>
        </Field>
        {assigneeType === 'USER' ? (
          <Field label="Kişi">
            <Select value={assigneeUserId} onChange={(e) => setAssigneeUserId(e.target.value)}>
              <option value="">Seç…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.role})
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Grup">
            <Select value={assigneeGroupId} onChange={(e) => setAssigneeGroupId(e.target.value)}>
              <option value="">Seç…</option>
              {(groups ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      <Field label="Bitiş Tarihi (isteğe bağlı)">
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </Field>

      <Field label="Tekrar (kalıcı görev)">
        <Select value={freq} onChange={(e) => setFreq(e.target.value as any)}>
          <option value="none">Tekrarsız (tek seferlik)</option>
          <option value="daily">Her gün</option>
          <option value="weekly">Haftanın belirli günleri</option>
        </Select>
      </Field>
      {freq === 'weekly' && (
        <div className="mb-2 flex flex-wrap gap-1">
          {DAY_LABELS.map((lbl, d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={`rounded px-2 py-1 text-xs ${
                weekDays.includes(d)
                  ? 'bg-brand text-white'
                  : 'bg-surface-low text-muted hover:text-ink'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      )}
      {recurrence && (
        <p className="text-xs text-brand">
          Bu görev tekrarlayan olarak sabitlenir; tamamlandıkça yenisi otomatik oluşur.
        </p>
      )}
    </Modal>
  );
}

function GroupForm({
  value,
  users,
  onClose,
  onSaved,
}: {
  value: GroupRow | null;
  users: UserRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(value?.name || '');
  const [memberIds, setMemberIds] = useState<string[]>(
    value?.members.map((m) => m.userId) || [],
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function toggle(id: string) {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function save() {
    setBusy(true);
    setErr('');
    try {
      const body = { name, memberUserIds: memberIds };
      if (value) await api.patch(`/tasks/groups/${value.id}`, body);
      else await api.post('/tasks/groups', body);
      onSaved();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={value ? 'Grup Düzenle' : 'Yeni Grup'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={save} disabled={busy || !name.trim()}>
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </>
      }
    >
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <Field label="Grup Adı">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Üyeler">
        <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-line bg-surface-low p-2 sm:grid-cols-2">
          {users.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={memberIds.includes(u.id)}
                onChange={() => toggle(u.id)}
                className="accent-brand"
              />
              <span>
                {u.fullName} <span className="text-faint">({u.role})</span>
              </span>
            </label>
          ))}
        </div>
      </Field>
    </Modal>
  );
}
