import { BadRequestException, Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { InsightsService } from './insights.service';
import { SettingsService } from '../settings/settings.service';
import { AiActionsService, ActionActor } from './ai-actions.service';
import { Role } from '../auth/roles';

const round2 = (n: number) => Math.round(n * 100) / 100;

function orderNet(o: {
  items: { unitPrice: number; quantity: number; status: string }[];
  discountType: string | null;
  discountValue: number;
}): number {
  const itemsTotal = o.items
    .filter((i) => i.status !== 'IPTAL')
    .reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  let disc = 0;
  if (o.discountType === 'YUZDE') disc = (itemsTotal * o.discountValue) / 100;
  else if (o.discountType === 'TUTAR') disc = o.discountValue;
  disc = Math.min(disc, itemsTotal);
  return itemsTotal - disc;
}

// Opsiyonel local LLM (Ollama). Kurulu değilse asistan devre dışı; öngörüler
// motoru (InsightsService) yine çalışır. Tak-çalıştır: ÖKC/e-Fatura deseni.
// env: AI_PROVIDER=ollama|none, AI_URL=http://localhost:11434, AI_MODEL=llama3.2
@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: InsightsService,
    private readonly settings: SettingsService,
    private readonly actions: AiActionsService,
  ) {}

  private get provider() {
    return (process.env.AI_PROVIDER || 'none').toLowerCase();
  }
  private get url() {
    return process.env.AI_URL || 'http://localhost:11434';
  }
  private get model() {
    return process.env.AI_MODEL || 'llama3.2';
  }

  async status() {
    if (this.provider !== 'ollama')
      return { enabled: false, reason: 'AI_PROVIDER ayarlı değil (opsiyonel).' };
    // Ollama'ya erişilebiliyor mu?
    try {
      const res = await this.fetchTimeout(`${this.url}/api/tags`, undefined, 2000);
      if (!res.ok) return { enabled: false, reason: `Ollama yanıt vermedi (${res.status}).` };
      return { enabled: true, model: this.model, url: this.url };
    } catch {
      return {
        enabled: false,
        reason: `Ollama'ya bağlanılamadı (${this.url}). Kurulu ve çalışıyor mu?`,
      };
    }
  }

  // Doğal dil soru → veri + işletme bağlamı + rol/sayfaya özel işlem listesiyle
  // Ollama'ya sorulur. Dönüş: metin yanıtı VEYA (kullanıcı işlem istediyse ve
  // yetkisi varsa) onay bekleyen işlem önerisi.
  async ask(question: string, opts?: { page?: string; role?: Role }) {
    if (!question?.trim()) throw new BadRequestException('Soru boş olamaz');
    const st = await this.status();
    if (!st.enabled)
      throw new BadRequestException(
        st.reason || 'AI asistan devre dışı (Ollama kurulu değil).',
      );

    const page = opts?.page || '';
    const role = opts?.role;
    const [context, graph] = await Promise.all([
      this.buildContext(),
      this.graphContext(question),
    ]);
    const actionsText = role
      ? this.actions.describeFor(page, role)
      : '(işlem yok)';

    const prompt = `Sen FLOW adlı restoran yönetim sisteminin Türkçe iş asistanısın. Kullanıcı şu an "${page || 'genel'}" ekranında.

KURALLAR:
- Kullanıcı bir İŞLEM yapmak istiyorsa (ekle, sil, birleştir, değiştir gibi) ve bu işlem aşağıdaki listede varsa, SADECE tek satır JSON döndür: {"action":"<id>","params":{...},"summary":"<Türkçe kısa onay cümlesi>"} — başka hiçbir metin yazma.
- Aksi halde soruyu GERÇEK verilerle kısa, net, Türkçe yanıtla. Rakamları ₺ ile ver. Veride olmayan şeyi uydurma, "bu veri elimde yok" de.

=== BU EKRANDA YAPABİLECEĞİN İŞLEMLER (rolüne göre) ===
${actionsText}

=== İŞLETME VERİSİ ===
${context}
${graph}
=== SORU ===
${question}

=== YANIT ===`;

    const raw = await this.generate(prompt);

    // İşlem önerisi mi (JSON) yoksa metin mi?
    const parsed = this.extractAction(raw);
    if (parsed?.action) {
      if (!role)
        return { type: 'text', answer: 'Bu işlem için oturum bilgisi eksik.' };
      const chk = this.actions.check(parsed.action, role);
      if (!chk.ok)
        return {
          type: 'text',
          answer: `${chk.reason} (Talep edilen işlem: ${parsed.action})`,
        };
      return {
        type: 'action',
        actionId: parsed.action,
        params: parsed.params || {},
        summary:
          parsed.summary || 'Bu işlem uygulanacak. Onaylıyor musunuz?',
      };
    }
    return { type: 'text', answer: raw };
  }

  // Onaylanan işlemi yürüt (rol kontrolü AiActionsService içinde tekrar yapılır).
  async act(actionId: string, params: any, actor: ActionActor) {
    return this.actions.execute(actionId, params, actor);
  }

  // Google yorumları + iç geri bildirimleri AI ile özetle (şikayet/memnuniyet/öneri).
  async reviewSummary() {
    const st = await this.status();
    if (!st.enabled) return { enabled: false, reason: st.reason };

    const [google, feedback] = await Promise.all([
      this.prisma.googleReview.findMany({ orderBy: { time: 'desc' }, take: 40 }),
      this.prisma.feedback.findMany({
        where: { comment: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
    ]);
    const lines: string[] = [];
    for (const r of google)
      lines.push(`[Google ${r.rating}/5] ${r.author}: ${r.text}`);
    for (const f of feedback)
      lines.push(`[QR ${f.rating}/5] ${f.comment}`);

    if (lines.length === 0)
      return { enabled: true, empty: true, answer: 'Henüz özetlenecek yorum yok.' };

    const prompt = `Sen bir restoran müşteri deneyimi analistisin. Aşağıdaki gerçek müşteri yorumlarını Türkçe analiz et ve ŞU BAŞLIKLARLA kısa, madde madde özetle:
1. 😊 Memnun kalınan konular (en çok övülenler)
2. 😞 Şikayetler / tekrar eden sorunlar
3. 💡 Somut iyileştirme önerileri (2-3 madde)
Genel bir hava cümlesiyle bitir. Uydurma, sadece yorumlara dayan.

=== YORUMLAR (${lines.length} adet) ===
${lines.join('\n')}

=== ANALİZ ===`;
    const answer = await this.generate(prompt);
    return { enabled: true, count: lines.length, answer };
  }

  // Ollama'dan düz metin üretimi.
  private async generate(prompt: string): Promise<string> {
    try {
      const res = await this.fetchTimeout(
        `${this.url}/api/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: this.model, prompt, stream: false }),
        },
        60000,
      );
      if (!res.ok)
        throw new BadRequestException(`Ollama hata döndü (${res.status})`);
      const data: any = await res.json();
      return (data.response || '').trim();
    } catch (e: any) {
      throw new BadRequestException(
        `Asistana ulaşılamadı: ${e.message || 'bilinmeyen hata'}`,
      );
    }
  }

  // Yanıttan işlem JSON'u çıkar (varsa). Model bazen metne gömer; ilk {...} bloğunu dener.
  private extractAction(
    raw: string,
  ): { action: string; params?: any; summary?: string } | null {
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first === -1 || last <= first) return null;
    const slice = raw.slice(first, last + 1);
    try {
      const obj = JSON.parse(slice);
      if (obj && typeof obj.action === 'string') return obj;
    } catch {
      /* JSON değil → metin yanıtı */
    }
    return null;
  }

  // Graph-RAG: birleşik kod+veri grafiğinden (merged-graph.json) soruyla ilgili
  // alt-grafiği çeker. GRAPH_MEMORY kapalıysa veya grafik yoksa boş döner —
  // asistan yine düz (SQL bağlamıyla) çalışır. Asla ana akışı bloklamaz.
  private async graphContext(question: string): Promise<string> {
    if ((process.env.GRAPH_MEMORY || '').toLowerCase() !== 'on') return '';
    const outDir =
      process.env.GRAPH_OUT_DIR || join(process.cwd(), '..', 'graphify-out');
    const merged = join(outDir, 'merged-graph.json');
    try {
      // GÜVENLİK: kabuk YOK — execFile ile argüman dizisi. Kullanıcı sorusu (question)
      // asla shell'e girmez, dolayısıyla komut enjeksiyonu mümkün değildir.
      const out = await this.runGraphify(
        ['query', question, '--graph', merged],
        5000,
      );
      const trimmed = (out || '').trim();
      return trimmed
        ? `\n=== İLİŞKİ GRAFİĞİ (Graph-RAG · kod+veri hafızası) ===\n${trimmed.slice(0, 1500)}\n`
        : '';
    } catch {
      return '';
    }
  }

  // Graphify CLI'yi güvenli çalıştır: execFile (shell yok) + zaman aşımı; hata → boş string.
  private runGraphify(args: string[], ms: number): Promise<string> {
    const bin = process.env.GRAPHIFY_BIN || 'graphify';
    return new Promise((resolve) => {
      execFile(
        bin,
        args,
        { timeout: ms, windowsHide: true, shell: false },
        (err, stdout) => {
          resolve(err ? '' : stdout || '');
        },
      );
    });
  }

  // Ollama'ya gönderilecek kompakt Türkçe veri özeti.
  private async buildContext(): Promise<string> {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayOrders, monthOrders, ov, cfg] = await Promise.all([
      this.prisma.order.findMany({
        where: { status: 'KAPANDI', closedAt: { gte: dayStart } },
        include: { items: true, payments: true },
      }),
      this.prisma.order.findMany({
        where: { status: 'KAPANDI', closedAt: { gte: monthStart } },
        include: { items: true },
      }),
      this.insights.overview(),
      this.settings.get(),
    ]);

    const GUN = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    const openDays = (cfg.openDays || '')
      .split(',')
      .map((d) => GUN[Number(d)] || '')
      .filter(Boolean)
      .join(', ');
    const hoursLabel = `${String(cfg.openHour).padStart(2, '0')}:00–${String(cfg.closeHour % 24).padStart(2, '0')}:00`;

    const todayRev = round2(todayOrders.reduce((s, o) => s + orderNet(o), 0));
    const monthRev = round2(monthOrders.reduce((s, o) => s + orderNet(o), 0));

    // Bu ay en çok satan ürünler.
    const prodMap = new Map<string, { qty: number; rev: number }>();
    for (const o of monthOrders)
      for (const it of o.items) {
        if (it.status === 'IPTAL') continue;
        const c = prodMap.get(it.nameSnapshot) || { qty: 0, rev: 0 };
        c.qty += it.quantity;
        c.rev += it.unitPrice * it.quantity;
        prodMap.set(it.nameSnapshot, c);
      }
    const topProducts = [...prodMap.entries()]
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 5)
      .map(([n, v]) => `${n}: ${v.qty} adet / ${round2(v.rev)}₺`)
      .join('; ');

    const lines = [
      cfg.businessName ? `İşletme: ${cfg.businessName}.` : '',
      `Çalışma saatleri: ${hoursLabel}${openDays ? ` • Açık günler: ${openDays}` : ''}.`,
      cfg.note ? `İşletme notu: ${cfg.note}` : '',
      `Bugün: ${todayOrders.length} adisyon, ciro ${todayRev}₺.`,
      `Bu ay (${monthStart.toLocaleDateString('tr-TR')}'den beri): ${monthOrders.length} adisyon, ciro ${monthRev}₺.`,
      `Son 8 hafta: ${ov.orderCount} adisyon, toplam ${ov.totalRev}₺, günlük ort. ${ov.avgPerDay}₺.`,
      ov.bestWeekday ? `En yoğun gün: ${ov.bestWeekday}.` : '',
      `Yarın tahmini ciro: ${ov.forecast[0]?.forecast ?? 0}₺ (${ov.forecast[0]?.label}).`,
      topProducts ? `Bu ay en çok satanlar: ${topProducts}.` : '',
      ov.suggestions.length
        ? `Öneriler: ${ov.suggestions.map((s) => s.title).join('; ')}.`
        : '',
    ].filter(Boolean);
    return lines.join('\n');
  }

  private async fetchTimeout(
    url: string,
    init: RequestInit | undefined,
    ms: number,
  ): Promise<Response> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  }
}
