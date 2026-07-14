import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../orders/orders.gateway';

interface RawReview {
  author: string;
  rating: number;
  text: string;
  time: Date;
  relativeTime?: string;
  profilePhoto?: string;
}

// Google yorumları sağlayıcı. Tak-çalıştır (ÖKC/e-Fatura/Ollama deseni):
//   REVIEWS_PROVIDER = none | google | simulation
//   GOOGLE_PLACES_API_KEY, GOOGLE_PLACE_ID  (google modu için)
//   REVIEWS_POLL_MIN = periyodik çekme dakikası (varsayılan 30)
// Google Places API yalnız en yeni ~5 yorumu döndürür (API kısıtı).
@Injectable()
export class ReviewsService implements OnModuleInit {
  private readonly logger = new Logger('Reviews');
  private timer?: NodeJS.Timeout;
  private simCounter = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: OrdersGateway,
  ) {}

  private get provider() {
    return (process.env.REVIEWS_PROVIDER || 'none').toLowerCase();
  }
  private get pollMs() {
    const m = Number(process.env.REVIEWS_POLL_MIN) || 30;
    return Math.max(1, m) * 60 * 1000;
  }

  onModuleInit() {
    if (this.provider === 'none') return;
    // Açılışta bir kez çek, sonra periyodik.
    this.sync().catch(() => undefined);
    this.timer = setInterval(() => this.sync().catch(() => undefined), this.pollMs);
    this.logger.log(
      `Yorum senkronizasyonu aktif (${this.provider}), her ${this.pollMs / 60000} dk.`,
    );
  }

  status() {
    const enabled = this.provider !== 'none';
    return {
      enabled,
      provider: this.provider,
      pollMinutes: this.pollMs / 60000,
      simulation: this.provider === 'simulation',
    };
  }

  // Depolanan yorumlar + özet + yıldız dağılımı (Geri Bildirim ekranı için).
  async list() {
    const [reviews, setting, unseen, all] = await Promise.all([
      this.prisma.googleReview.findMany({ orderBy: { time: 'desc' }, take: 50 }),
      this.prisma.businessSetting.findUnique({ where: { id: 'singleton' } }),
      this.prisma.googleReview.count({ where: { seen: false } }),
      this.prisma.googleReview.findMany({ select: { rating: true } }),
    ]);
    // Puan dağılımı (elde tutulan tüm yorumlardan; zamanla birikir).
    const distribution = [1, 2, 3, 4, 5].map((r) => ({
      rating: r,
      count: all.filter((x) => x.rating === r).length,
    }));
    return {
      ...this.status(),
      rating: setting?.reviewsRating ?? null,
      total: setting?.reviewsTotal ?? null,
      syncedAt: setting?.reviewsSyncedAt ?? null,
      unseen,
      distribution,
      reviews,
    };
  }

  // Yorumları "görüldü" işaretle (bildirim rozetini sıfırlar).
  async markSeen() {
    await this.prisma.googleReview.updateMany({
      where: { seen: false },
      data: { seen: true },
    });
    return { ok: true };
  }

  // Sağlayıcıdan çek, kaydet, YENİ olanları tespit et → bildirim yayınla.
  async sync() {
    if (this.provider === 'none') return { new: 0, disabled: true };
    let raws: RawReview[] = [];
    let overall: { rating?: number; total?: number } = {};
    if (this.provider === 'simulation') {
      const r = this.simulate();
      raws = r.reviews;
      overall = { rating: r.rating, total: r.total };
    } else {
      const r = await this.fetchGoogle();
      raws = r.reviews;
      overall = { rating: r.rating, total: r.total };
    }

    let newCount = 0;
    for (const rv of raws) {
      const id = this.keyFor(rv);
      const exists = await this.prisma.googleReview.findUnique({ where: { id } });
      if (!exists) {
        await this.prisma.googleReview.create({
          data: {
            id,
            author: rv.author,
            rating: rv.rating,
            text: rv.text,
            time: rv.time,
            relativeTime: rv.relativeTime,
            profilePhoto: rv.profilePhoto,
            source: this.provider === 'simulation' ? 'simulation' : 'google',
            seen: false,
          },
        });
        newCount++;
        // Her yeni yorum için anlık bildirim (özellikle düşük puanlılar önemli).
        this.gateway.emitNewReview({
          author: rv.author,
          rating: rv.rating,
          text: rv.text.slice(0, 160),
        });
      }
    }

    await this.prisma.businessSetting.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        reviewsRating: overall.rating ?? null,
        reviewsTotal: overall.total ?? null,
        reviewsSyncedAt: new Date(),
      },
      update: {
        reviewsRating: overall.rating ?? undefined,
        reviewsTotal: overall.total ?? undefined,
        reviewsSyncedAt: new Date(),
      },
    });
    if (newCount) this.logger.log(`${newCount} yeni yorum eklendi.`);
    return { new: newCount };
  }

  private keyFor(r: RawReview): string {
    return `${this.provider === 'simulation' ? 'sim' : 'g'}:${Math.floor(r.time.getTime() / 1000)}:${r.author}`.slice(0, 190);
  }

  // --- Google Places API ---
  private async fetchGoogle(): Promise<{
    reviews: RawReview[];
    rating?: number;
    total?: number;
  }> {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    const placeId = process.env.GOOGLE_PLACE_ID;
    if (!key || !placeId) {
      this.logger.warn('GOOGLE_PLACES_API_KEY / GOOGLE_PLACE_ID eksik.');
      return { reviews: [] };
    }
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=reviews,rating,user_ratings_total` +
      `&reviews_sort=newest&language=tr&key=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google API ${res.status}`);
    const data: any = await res.json();
    if (data.status && data.status !== 'OK')
      throw new Error(`Google: ${data.status} ${data.error_message || ''}`);
    const result = data.result || {};
    const reviews: RawReview[] = (result.reviews || []).map((r: any) => ({
      author: r.author_name || 'Anonim',
      rating: Number(r.rating) || 0,
      text: r.text || '',
      time: new Date((Number(r.time) || 0) * 1000),
      relativeTime: r.relative_time_description,
      profilePhoto: r.profile_photo_url,
    }));
    return {
      reviews,
      rating: result.rating,
      total: result.user_ratings_total,
    };
  }

  // --- Simülasyon (anahtarsız test/demo) ---
  private simulate(): { reviews: RawReview[]; rating: number; total: number } {
    // Sabit zamanlar — anahtarlar senkronizasyonlar arası değişmesin (tekrar
    // "yeni" sayılmasın). Gerçek Google modunda zaman zaten sabittir.
    const base: RawReview[] = [
      {
        author: 'Ahmet Y.',
        rating: 5,
        text: 'Adana kebap harikaydı, servis çok hızlıydı. Kesinlikle tekrar geleceğiz.',
        time: new Date('2026-07-11T20:00:00'),
        relativeTime: '2 gün önce',
      },
      {
        author: 'Selin K.',
        rating: 2,
        text: 'Yemekler güzeldi ama masamıza çok geç bakıldı, garson ilgisizdi.',
        time: new Date('2026-07-08T21:30:00'),
        relativeTime: '5 gün önce',
      },
      {
        author: 'Murat D.',
        rating: 4,
        text: 'Lezzetli ve uygun fiyatlı. Otopark olsa mükemmel olurdu.',
        time: new Date('2026-07-05T19:15:00'),
        relativeTime: '1 hafta önce',
      },
    ];
    // Her manuel senkronizasyonda YENİ bir yorum ekle (bildirim akışını test için).
    const extra: RawReview[] = [];
    if (this.simCounter > 0) {
      const pool = [
        { author: 'Yeni Müşteri', rating: 1, text: 'Sipariş yanlış geldi ve soğuktu, memnun kalmadım.' },
        { author: 'Zeynep A.', rating: 5, text: 'Tatlılar mükemmel, personel çok güler yüzlü!' },
        { author: 'Can B.', rating: 3, text: 'Ortalama bir deneyimdi, fena değil.' },
      ];
      const pick = pool[(this.simCounter - 1) % pool.length];
      extra.push({ ...pick, time: new Date(), relativeTime: 'az önce' });
    }
    this.simCounter++;
    const all = [...extra, ...base];
    const rating =
      Math.round((all.reduce((s, r) => s + r.rating, 0) / all.length) * 10) / 10;
    return { reviews: all, rating, total: 120 + this.simCounter };
  }
}
