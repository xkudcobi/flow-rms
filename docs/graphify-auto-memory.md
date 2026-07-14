# Graphify Oto-Hafıza Mimarisi (Incremental Update + Graph-RAG)

> Amaç: Graphify'ın (a) kod mimarisindeki değişiklikleri ve (b) sisteme giren canlı
> veriler arasındaki yeni ilişkileri, manuel komut gerekmeden, otomatik takip edip
> hafızasını (birleşik grafiği) kendi kendine güncellemesi; AiService'in bu grafiği
> Graph-RAG olarak kullanması.

> **Uygulama notu (kurulum tamamlandı):** `data-graph.json` networkx `node_link`
> formatında yazılır (`{directed, multigraph, graph, nodes:[{id,label,file_type,_origin}],
> links:[{source,target,relation,weight,confidence}]}`) — `graphify merge-graphs`
> tam olarak bunu bekler. Aşağıdaki `from/to` şeması kavramsal gösterimdir; gerçek
> yazıcı `server/src/graph-memory/graph-memory.service.ts` içindedir.

## 0. Temel İlke

Graphify KOD'u indeksler, çalışma-zamanı satırlarını değil. Dolayısıyla iki ayrı
"şerit" (lane) kurup sonunda `graphify merge-graphs` ile birleştiriyoruz:

```
  ┌─ Şerit A: KOD grafiği  ──────────┐
  │  git hook / watch → graphify      │
  │  update .  →  code-graph.json     │
  └───────────────────────────────────┤
                                       ├──► merge-graphs ──► merged-graph.json ──► AiService (Graph-RAG)
  ┌─ Şerit B: VERİ grafiği ──────────┤
  │  PrismaService $extends → edge     │
  │  event → debounce flush →          │
  │  data-graph.json                   │
  └───────────────────────────────────┘
```

## 1. Şerit A — Kod Mimarisi Otomatik Takibi (native, LLM'siz)

İki seçenek; **ikisini birden** öneririm (dev'de watch, commit'te hook):

- **Geliştirme sırasında:** `graphify watch .` bir arka plan süreci olarak; dosya
  değişince `code-graph`'i anında yeniden kurar.
- **Kalıcı/garanti:** git `post-commit` + `post-merge` hook → `graphify update .`
  Kurulum: `graphify hook install` (repo köküne git hook yazar). `--force`
  refaktörden sonra düğüm azalsa bile yazması için.

`update` LLM/token gerektirmez, hızlıdır (bu repoda ~150 dosya < birkaç sn).

## 2. Şerit B — Canlı Veri İlişkileri Otomatik Takibi (custom)

### 2.1 KRİTİK tasarım kararı: satır değil, TİP+ağırlık

Her siparişi ayrı düğüm yaparsak grafik binlerce düğümle patlar ve anlamsızlaşır.
Bunun yerine **varlık-tipi düzeyinde ilişkileri, ağırlıklı (kaç kez gözlendi)**
öğreniyoruz. Örnek öğrenilen kenarlar:

```
Order      --consumes-->  StockItem     (weight: gözlem sayısı, via RecipeItem)
Order      --placedBy-->  Customer      (weight)
Customer   --wrote-->     Review        (weight)
Product    --depletes-->  StockItem     (weight, hangi ürün hangi stoğu eritti)
```

İsteğe bağlı: sadece "kayda değer" örnek düğümler (en çok harcayan 20 müşteri,
anomali siparişler) capli tutulur — geri kalan hepsi tip-kenarına ağırlık ekler.

### 2.2 Emitter: PrismaService `$extends` (query extension)

`PrismaService` içine, ilgili modellerin `create/update` işlemlerini yakalayan bir
extension eklenir. Yan etki asla ana işlemi bloklamaz / patlatmaz (fire-and-forget).

```ts
// server/src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { GraphMemoryService } from '../graph-memory/graph-memory.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // GraphMemory forwardRef ile enjekte edilir (döngüsel bağımlılığı kırmak için)
  constructor(private readonly graphMem: GraphMemoryService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.graphMem.flush();      // kapanmadan önce son buffer'ı yaz
    await this.$disconnect();
  }

  // İlişki öğrenmenin devreye girdiği yer. $extends yeni bir client döndürür;
  // uygulama bu genişletilmiş client'ı kullanır (aşağıdaki notlara bak).
  withMemory() {
    return this.$extends({
      query: {
        order: {
          async create({ args, query }) {
            const res = await query(args);
            // Ana işlem bitti → yan etki (asla await'i bloklamaz)
            void PrismaService.emitOrder(res);
            return res;
          },
        },
        payment: {
          async create({ args, query }) {
            const res = await query(args);
            void PrismaService.emitPayment(res);
            return res;
          },
        },
        feedback: {
          async create({ args, query }) {
            const res = await query(args);
            void PrismaService.emitReview(res);
            return res;
          },
        },
        stockMovement: {
          async create({ args, query }) {
            const res = await query(args);
            void PrismaService.emitStock(res);
            return res;
          },
        },
      },
    });
  }

  // Not: static yerine pratikte graphMem örneğine erişmek için closure/instance
  // kullanılır; burada mantık gösterimi için sadeleştirildi.
}
```

> Alternatif (daha az invaziv): domain SERVICE'lerinde (`OrdersService.close`,
> `StockService.move`, `FeedbackService.create`) tek satırlık
> `this.graphMem.observe(...)` çağrısı. Prisma extension global ve otomatiktir ama
> genişletilmiş client'ın DI'a doğru bağlanmasını ister; service-level çağrı daha
> açık ve test edilebilir. İkisinden birini seç — öneri: **service-level**, çünkü
> hangi işin "kapanmış sipariş" olduğunu (ki asıl öğrenmek istediğimiz o) service
> zaten bilir.

### 2.3 GraphMemoryService — biriktir, debounce'la, yaz, birleştir

```ts
// server/src/graph-memory/graph-memory.service.ts
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';

type Edge = { from: string; to: string; rel: string };

@Injectable()
export class GraphMemoryService implements OnModuleDestroy {
  private readonly log = new Logger('GraphMemory');
  private readonly enabled = process.env.GRAPH_MEMORY === 'on';
  private readonly outDir = join(process.cwd(), '..', 'graphify-out');
  private readonly dataGraph = join(this.outDir, 'data-graph.json');

  // rel-kenarları ağırlıkla biriktir: "Order|consumes|StockItem" -> weight
  private weights = new Map<string, number>();
  private dirty = false;
  private timer?: NodeJS.Timeout;

  /** Domain olaylarından çağrılır. Asla throw etmez, ana akışı bloklamaz. */
  observe(edges: Edge[]) {
    if (!this.enabled) return;
    for (const e of edges) {
      const k = `${e.from}|${e.rel}|${e.to}`;
      this.weights.set(k, (this.weights.get(k) ?? 0) + 1);
    }
    this.dirty = true;
    this.scheduleFlush();
  }

  /** Yazımları topaklar: 30 sn'de bir en fazla bir disk+merge (debounce). */
  private scheduleFlush() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, 30_000);
  }

  async flush() {
    if (!this.dirty) return;
    this.dirty = false;
    try {
      const nodes = new Map<string, any>();
      const edges: any[] = [];
      for (const [k, w] of this.weights) {
        const [from, rel, to] = k.split('|');
        nodes.set(from, { id: from, type: 'data-entity' });
        nodes.set(to, { id: to, type: 'data-entity' });
        edges.push({ from, to, type: rel, weight: w, provenance: 'runtime' });
      }
      const graph = { directed: true, nodes: [...nodes.values()], edges };
      await fs.writeFile(this.dataGraph, JSON.stringify(graph, null, 2));
      this.mergeIntoMemory();   // code-graph + data-graph → merged-graph
    } catch (e: any) {
      this.log.warn(`graph flush atlandı: ${e.message}`);  // hata ana sistemi etkilemez
    }
  }

  /** Kod grafiği ile veri grafiğini birleştir (Graphify CLI). */
  private mergeIntoMemory() {
    const cmd = `graphify merge-graphs "${join(this.outDir, 'graph.json')}" "${this.dataGraph}" --out "${join(this.outDir, 'merged-graph.json')}"`;
    exec(cmd, (err) => err && this.log.warn(`merge atlandı: ${err.message}`));
  }

  async onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
    await this.flush();
  }
}
```

Örnek observe çağrısı (OrdersService.close içinde):

```ts
this.graphMem.observe([
  { from: 'Order', rel: 'placedBy', to: 'Customer' },
  ...order.items.map((it) => ({ from: 'Product', rel: 'sold', to: it.nameSnapshot })),
  ...order.items.flatMap((it) =>
    (it.recipe ?? []).map((r) => ({ from: it.nameSnapshot, rel: 'consumes', to: r.stockName })),
  ),
]);
```

## 3. AiService — Graph-RAG Entegrasyonu

`buildContext()` bugün sadece SQL agregatları döndürüyor. Yanına, birleşik grafikten
ilgili alt-grafiği çeken bir `graphContext()` ekliyoruz. Böylece asistan, "hangi ürün
hangi stoğu eritiyor / şu müşteri neyle ilişkili" gibi **ilişkisel** soruları,
kod+veri grafiğine dayanarak yanıtlar.

```ts
// AiService içine
private async graphContext(question: string): Promise<string> {
  if (process.env.GRAPH_MEMORY !== 'on') return '';
  const graph = join(process.cwd(), '..', 'graphify-out', 'merged-graph.json');
  try {
    const out = await this.run(
      `graphify query ${JSON.stringify(question)} --graph "${graph}"`,
      4000,
    );
    return out ? `\n=== İLİŞKİ GRAFİĞİ (Graph-RAG) ===\n${out.slice(0, 1500)}` : '';
  } catch {
    return '';   // grafik yoksa/başarısızsa asistan yine düz çalışır
  }
}
```

`ask()` içinde prompt kurulurken:

```ts
const [context, graph] = await Promise.all([
  this.buildContext(),
  this.graphContext(question),
]);
// prompt'a hem `context` hem `graph` eklenir
```

## 4. Tetikleme Özeti (kim ne zaman güncelliyor?)

| Değişim türü | Tetikleyici | Sonuç |
|---|---|---|
| Kod değişti (dev) | `graphify watch .` süreci | code-graph anında güncel |
| Kod commit'lendi | git post-commit/merge hook | code-graph garanti güncel |
| Canlı veri (sipariş/ödeme/stok/yorum) | PrismaService $extends / service observe | data-graph'e ağırlıklı kenar |
| Her ~30 sn (veri değiştiyse) | GraphMemory debounce flush | data-graph yazılır + merge |
| Kullanıcı asistana sordu | AiService.graphContext | merged-graph'ten Graph-RAG |

## 5. Güvenlik / dayanıklılık kuralları

1. **Yan etki asla ana işlemi bloklamaz/patlatmaz** — tüm graph çağrıları try/catch,
   fire-and-forget, `void`.
2. **Feature flag** — `GRAPH_MEMORY=on` olmadan tüm sistem bugünkü gibi çalışır.
3. **Satır değil tip düzeyi** — grafik patlamaz, PII grafiğe düşmez (müşteri adı
   yerine `Customer` tipi + id-hash).
4. **Debounce** — her yazımda değil, 30 sn'de bir disk+merge; yük düşük.
5. **DB'ye dokunulmaz** — yalnızca `graphify-out/` altına yazılır.

## 6. Uygulama Sırası (öneri)

1. `GraphMemoryModule` + `GraphMemoryService` ekle (flag kapalı, no-op).
2. `graphify hook install` + dev script'e `graphify watch` (Şerit A).
3. `OrdersService.close`, `StockService.move`, `FeedbackService.create` içine
   `observe(...)` çağrıları (Şerit B).
4. `AiService.graphContext()` + prompt'a ekleme (Graph-RAG).
5. `GRAPH_MEMORY=on` ile aç, `graphify explain "StockItem"` ile öğrenilen bağları
   doğrula.
