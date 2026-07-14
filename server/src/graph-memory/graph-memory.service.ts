import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { execFile } from 'child_process';

/**
 * Öğrenilen ilişki kenarı. TİP düzeyinde tutulur (satır değil): örn.
 * { from: 'Order', rel: 'placedBy', to: 'Customer' }. Aynı kenar tekrar
 * gözlenince ağırlığı artar — böylece grafik satır sayısıyla şişmez, PII düşmez.
 */
export interface GraphEdge {
  from: string;
  rel: string;
  to: string;
}

/**
 * Kendi kendini güncelleyen oto-hafızanın "Şerit B" beyni: canlı veri
 * ilişkilerini biriktirir, debounce'la data-graph.json'a yazar ve Graphify CLI
 * ile kod grafiğine birleştirir (merged-graph.json).
 *
 * KURALLAR:
 *  - Feature flag: GRAPH_MEMORY=on değilse tüm metodlar no-op.
 *  - Asla throw etmez / ana iş akışını bloklamaz (fire-and-forget, try/catch).
 *  - Yalnızca graphify-out/ altına yazar; veritabanına dokunmaz.
 */
@Injectable()
export class GraphMemoryService implements OnModuleDestroy {
  private readonly log = new Logger('GraphMemory');
  private readonly enabled = (process.env.GRAPH_MEMORY || '').toLowerCase() === 'on';
  private readonly outDir =
    process.env.GRAPH_OUT_DIR || join(process.cwd(), '..', 'graphify-out');
  private readonly dataGraph = join(this.outDir, 'data-graph.json');
  private readonly codeGraph = join(this.outDir, 'graph.json');
  private readonly mergedGraph = join(this.outDir, 'merged-graph.json');
  private readonly debounceMs = Number(process.env.GRAPH_FLUSH_MS || 30_000);

  // "from|rel|to" -> kaç kez gözlendi (ağırlık)
  private readonly weights = new Map<string, number>();
  private dirty = false;
  private flushTimer?: NodeJS.Timeout;
  private merging = false;

  constructor() {
    if (this.enabled) {
      this.log.log(
        `oto-hafıza AÇIK · out=${this.outDir} · debounce=${this.debounceMs}ms`,
      );
    }
  }

  /**
   * Domain servislerinden çağrılır (OrdersService.close, StockService.deduct,
   * PublicService.feedback ...). Yeni ilişkileri ağırlıklı biriktirir.
   */
  observe(edges: GraphEdge[]): void {
    if (!this.enabled || !edges?.length) return;
    try {
      for (const e of edges) {
        if (!e?.from || !e?.rel || !e?.to) continue;
        const k = `${e.from}|${e.rel}|${e.to}`;
        this.weights.set(k, (this.weights.get(k) ?? 0) + 1);
      }
      this.dirty = true;
      this.scheduleFlush();
    } catch (err: any) {
      this.log.warn(`observe atlandı: ${err?.message}`);
    }
  }

  /** Yazımları topaklar: en fazla debounce süresinde bir disk+merge. */
  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      void this.flush();
    }, this.debounceMs);
    // Süreç kapanışını bu timer bloklamasın.
    this.flushTimer.unref?.();
  }

  /** Biriken kenarları data-graph.json'a yaz, sonra kod grafiğiyle birleştir. */
  async flush(): Promise<void> {
    if (!this.enabled || !this.dirty) return;
    this.dirty = false;
    try {
      // networkx node_link formatı (graphify merge-graphs bunu bekler):
      // { directed, multigraph, graph, nodes:[{id,label,...}], links:[{source,target,relation,weight}] }
      const nodes = new Map<string, Record<string, unknown>>();
      const links: Array<Record<string, unknown>> = [];
      for (const [k, w] of this.weights) {
        const [from, rel, to] = k.split('|');
        if (!nodes.has(from))
          nodes.set(from, {
            id: from,
            label: from,
            file_type: 'data',
            _origin: 'runtime',
          });
        if (!nodes.has(to))
          nodes.set(to, {
            id: to,
            label: to,
            file_type: 'data',
            _origin: 'runtime',
          });
        links.push({
          source: from,
          target: to,
          relation: rel,
          weight: w,
          confidence: 'EXTRACTED',
          _origin: 'runtime',
        });
      }
      const graph = {
        directed: false,
        multigraph: false,
        graph: {},
        nodes: [...nodes.values()],
        links,
      };
      await fs.mkdir(this.outDir, { recursive: true });
      await fs.writeFile(this.dataGraph, JSON.stringify(graph, null, 2), 'utf8');
      this.mergeIntoMemory();
    } catch (err: any) {
      this.log.warn(`flush atlandı: ${err?.message}`);
    }
  }

  /** Kod grafiği (graph.json) + veri grafiği (data-graph.json) → merged-graph.json */
  private mergeIntoMemory(): void {
    if (this.merging) return; // eşzamanlı merge'i engelle
    this.merging = true;
    // GÜVENLİK: kabuk YOK — execFile + argüman dizisi (shell enjeksiyonu yüzeyi kapalı).
    const bin = process.env.GRAPHIFY_BIN || 'graphify';
    execFile(
      bin,
      ['merge-graphs', this.codeGraph, this.dataGraph, '--out', this.mergedGraph],
      { timeout: 60_000, shell: false },
      (err) => {
        this.merging = false;
        if (err) this.log.warn(`merge atlandı: ${err.message}`);
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    await this.flush(); // kapanmadan önce son buffer'ı garanti yaz
  }
}
