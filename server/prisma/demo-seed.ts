// FLOW — herkese açık demo için dolu örnek restoran.
// Yalnız veritabanı BOŞSA çalışır (kullanıcı yoksa); dolu veritabanına dokunmaz.
// Böylece her yeniden yayında müşterilerin eklediği veriler korunur.
//   npx ts-node prisma/demo-seed.ts
// Uydurma işletme: "Demo Bistro". Tüm isimler/telefonlar örnektir.
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Tekrarlanabilir rastgelelik (her kurulum aynı veriyi üretir).
let seed = 20261122;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const id = () => randomUUID();
const r2 = (n: number) => Math.round(n * 100) / 100;

function dayStart(offsetDays: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}
function at(base: Date, hour: number, minute: number) {
  const d = new Date(base);
  d.setHours(hour, minute, ri(0, 59), 0);
  return d;
}
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

async function main() {
  if ((await prisma.user.count()) > 0) {
    console.log('• Veritabanı dolu, demo verisi atlandı.');
    return;
  }
  console.log('• Demo restoran kuruluyor…');
  const hash = (p: string) => bcrypt.hash(p, 10);

  // --- İşletme -------------------------------------------------------------
  await prisma.businessSetting.create({
    data: {
      id: 'singleton',
      businessName: 'Demo Bistro',
      openHour: 9,
      closeHour: 24,
      address: 'Örnek Mah. Deneme Cad. No:1, Ankara',
      phone: '0312 000 00 00',
      note: 'Mahalle bistrosu: kahvaltı, ızgara ve tatlı. Hafta sonu kahvaltısı yoğun; öğrenciye %10 indirim.',
      qrOrderingEnabled: true,
      attendanceQrEnabled: true,
      reviewsRating: 4.6,
      reviewsTotal: 312,
      reviewsSyncedAt: new Date(),
    },
  });

  // --- Personel -------------------------------------------------------------
  const staffDef = [
    { username: 'patron', fullName: 'Demo Patron', role: 'PATRON', pw: 'patron123' },
    { username: 'garson', fullName: 'Ahmet Yılmaz', role: 'GARSON', pw: 'garson123' },
    { username: 'mutfak', fullName: 'Mutfak Ekranı', role: 'MUTFAK', pw: 'mutfak123' },
    { username: 'kasa', fullName: 'Elif Kaya', role: 'KASIYER', pw: 'kasa123' },
    { username: 'mudur', fullName: 'Burak Demir', role: 'MUDUR', pw: 'mudur123' },
    { username: 'zeynep', fullName: 'Zeynep Arslan', role: 'GARSON', pw: 'zeynep123' },
    { username: 'mert', fullName: 'Mert Şahin', role: 'GARSON', pw: 'mert123' },
    { username: 'usta', fullName: 'Hasan Usta', role: 'MUTFAK', pw: 'usta123' },
  ];
  const users: Record<string, { id: string; fullName: string; role: string }> = {};
  for (const s of staffDef) {
    const u = await prisma.user.create({
      data: { username: s.username, fullName: s.fullName, role: s.role, password: await hash(s.pw) },
    });
    users[s.username] = { id: u.id, fullName: u.fullName, role: u.role };
  }
  const waiters = [users.garson, users.zeynep, users.mert];
  const patronId = users.patron.id;

  // --- Menü -----------------------------------------------------------------
  type P = { name: string; price: number; station: string; recipe?: [string, number][] };
  const menu: { name: string; color: string; items: P[] }[] = [
    {
      name: 'Kahvaltı', color: '#f59e0b', items: [
        { name: 'Serpme Kahvaltı (2 kişilik)', price: 850, station: 'MUTFAK', recipe: [['Yumurta', 4], ['Beyaz Peynir', 0.2], ['Domates', 0.3], ['Ekmek', 2]] },
        { name: 'Menemen', price: 190, station: 'MUTFAK', recipe: [['Yumurta', 3], ['Domates', 0.25], ['Sivri Biber', 0.1]] },
        { name: 'Sucuklu Yumurta', price: 210, station: 'MUTFAK', recipe: [['Yumurta', 3], ['Sucuk', 0.08]] },
        { name: 'Kaşarlı Tost', price: 140, station: 'MUTFAK', recipe: [['Ekmek', 1], ['Kaşar Peyniri', 0.08]] },
        { name: 'Simit Tabağı', price: 120, station: 'MUTFAK', recipe: [['Beyaz Peynir', 0.08], ['Domates', 0.1]] },
      ],
    },
    {
      name: 'Izgara', color: '#dc2626', items: [
        { name: 'Adana Kebap', price: 380, station: 'IZGARA', recipe: [['Kıyma', 0.2], ['Lavaş', 1], ['Domates', 0.1]] },
        { name: 'Izgara Köfte', price: 340, station: 'IZGARA', recipe: [['Kıyma', 0.2], ['Patates', 0.15]] },
        { name: 'Tavuk Şiş', price: 310, station: 'IZGARA', recipe: [['Tavuk Göğüs', 0.22], ['Lavaş', 1]] },
        { name: 'Kuzu Pirzola', price: 620, station: 'IZGARA', recipe: [['Kuzu Pirzola', 0.25], ['Patates', 0.15]] },
        { name: 'Karışık Izgara', price: 720, station: 'IZGARA', recipe: [['Kıyma', 0.15], ['Tavuk Göğüs', 0.15], ['Kuzu Pirzola', 0.12]] },
      ],
    },
    {
      name: 'Ara Sıcak & Çorba', color: '#ea580c', items: [
        { name: 'Mercimek Çorbası', price: 110, station: 'MUTFAK', recipe: [['Kırmızı Mercimek', 0.06]] },
        { name: 'Ezogelin Çorbası', price: 110, station: 'MUTFAK', recipe: [['Kırmızı Mercimek', 0.05]] },
        { name: 'Patates Kızartması', price: 120, station: 'MUTFAK', recipe: [['Patates', 0.25], ['Ayçiçek Yağı', 0.05]] },
        { name: 'Sigara Böreği', price: 140, station: 'MUTFAK', recipe: [['Beyaz Peynir', 0.06], ['Ayçiçek Yağı', 0.04]] },
        { name: 'Çoban Salata', price: 130, station: 'MUTFAK', recipe: [['Domates', 0.2], ['Salatalık', 0.15], ['Sivri Biber', 0.05]] },
      ],
    },
    {
      name: 'Tatlılar', color: '#d97706', items: [
        { name: 'Künefe', price: 190, station: 'TATLI', recipe: [['Künefe Peyniri', 0.1], ['Kadayıf', 0.08]] },
        { name: 'Sütlaç', price: 130, station: 'TATLI', recipe: [['Süt', 0.25]] },
        { name: 'Cheesecake', price: 170, station: 'TATLI' },
        { name: 'Baklava (4 dilim)', price: 220, station: 'TATLI' },
      ],
    },
    {
      name: 'Sıcak İçecekler', color: '#7c3aed', items: [
        { name: 'Çay', price: 20, station: 'BAR', recipe: [['Çay (dökme)', 0.004]] },
        { name: 'Türk Kahvesi', price: 70, station: 'BAR', recipe: [['Türk Kahvesi (çekirdek)', 0.007]] },
        { name: 'Latte', price: 110, station: 'BAR', recipe: [['Espresso Çekirdeği', 0.018], ['Süt', 0.2]] },
        { name: 'Americano', price: 95, station: 'BAR', recipe: [['Espresso Çekirdeği', 0.018]] },
        { name: 'Sahlep', price: 90, station: 'BAR', recipe: [['Süt', 0.25]] },
      ],
    },
    {
      name: 'Soğuk İçecekler', color: '#2563eb', items: [
        { name: 'Ayran', price: 40, station: 'BAR', recipe: [['Ayran (şişe)', 1]] },
        { name: 'Kola', price: 60, station: 'BAR', recipe: [['Kola (kutu)', 1]] },
        { name: 'Ev Yapımı Limonata', price: 80, station: 'BAR', recipe: [['Limon', 0.12]] },
        { name: 'Soda', price: 35, station: 'BAR', recipe: [['Soda (şişe)', 1]] },
        { name: 'Taze Portakal Suyu', price: 100, station: 'BAR', recipe: [['Portakal', 0.4]] },
      ],
    },
  ];

  // --- Stok -----------------------------------------------------------------
  // [ad, birim, grup, miktar, kritik, maliyet, bozulabilir]
  const stockDef: [string, string, string, number, number, number, boolean][] = [
    ['Yumurta', 'adet', 'Kahvaltılık', 420, 120, 4.5, true],
    ['Beyaz Peynir', 'kg', 'Kahvaltılık', 9, 4, 310, true],
    ['Kaşar Peyniri', 'kg', 'Kahvaltılık', 2.5, 3, 380, true],
    ['Sucuk', 'kg', 'Kahvaltılık', 4, 2, 620, true],
    ['Ekmek', 'adet', 'Fırın', 60, 30, 10, true],
    ['Lavaş', 'adet', 'Fırın', 140, 60, 4, true],
    ['Kıyma', 'kg', 'Et', 18, 8, 560, true],
    ['Tavuk Göğüs', 'kg', 'Et', 12, 6, 210, true],
    ['Kuzu Pirzola', 'kg', 'Et', 3, 4, 980, true],
    ['Domates', 'kg', 'Sebze', 22, 8, 32, true],
    ['Salatalık', 'kg', 'Sebze', 8, 4, 28, true],
    ['Sivri Biber', 'kg', 'Sebze', 5, 2, 45, true],
    ['Patates', 'kg', 'Sebze', 40, 15, 18, false],
    ['Limon', 'kg', 'Meyve', 6, 3, 40, true],
    ['Portakal', 'kg', 'Meyve', 14, 6, 30, true],
    ['Kırmızı Mercimek', 'kg', 'Kuru Gıda', 15, 5, 55, false],
    ['Ayçiçek Yağı', 'lt', 'Kuru Gıda', 25, 10, 75, false],
    ['Süt', 'lt', 'Süt Ürünleri', 30, 12, 34, true],
    ['Künefe Peyniri', 'kg', 'Tatlı', 4, 2, 420, true],
    ['Kadayıf', 'kg', 'Tatlı', 3, 2, 160, true],
    ['Çay (dökme)', 'kg', 'İçecek', 6, 2, 260, false],
    ['Türk Kahvesi (çekirdek)', 'kg', 'İçecek', 2, 1, 900, false],
    ['Espresso Çekirdeği', 'kg', 'İçecek', 0.8, 2, 1100, false],
    ['Ayran (şişe)', 'adet', 'İçecek', 96, 40, 14, true],
    ['Kola (kutu)', 'adet', 'İçecek', 72, 48, 22, false],
    ['Soda (şişe)', 'adet', 'İçecek', 110, 48, 9, false],
    ['Peçete', 'adet', 'Sarf', 1800, 500, 0.3, false],
    ['Paket Kabı', 'adet', 'Ambalaj', 160, 100, 6, false],
  ];
  const stock: Record<string, { id: string; cost: number; unit: string }> = {};
  for (const [name, unit, group, quantity, criticalLevel, cost, perishable] of stockDef) {
    const s = await prisma.stockItem.create({ data: { name, unit, group, quantity, criticalLevel, cost, perishable } });
    stock[name] = { id: s.id, cost, unit };
  }

  const products: { id: string; name: string; price: number; station: string; cat: string; recipe?: [string, number][] }[] = [];
  let ci = 0;
  for (const c of menu) {
    const cat = await prisma.category.create({ data: { name: c.name, color: c.color, sortOrder: ++ci } });
    let pi = 0;
    for (const p of c.items) {
      const prod = await prisma.product.create({
        data: { name: p.name, price: p.price, station: p.station, categoryId: cat.id, sortOrder: ++pi },
      });
      products.push({ id: prod.id, name: p.name, price: p.price, station: p.station, cat: c.name, recipe: p.recipe });
      if (p.recipe) {
        await prisma.recipeItem.createMany({
          data: p.recipe.map(([s, q]) => ({ productId: prod.id, stockItemId: stock[s].id, quantity: q })),
        });
      }
    }
  }
  const byCat = (n: string) => products.filter((p) => p.cat === n);

  // --- Salon & masalar ------------------------------------------------------
  const floors = [
    { name: 'İç Salon', tables: ['1', '2', '3', '4', '5', '6', '7', '8'] },
    { name: 'Bahçe', tables: ['B1', 'B2', 'B3', 'B4', 'B5'] },
    { name: 'Teras', tables: ['T1', 'T2', 'T3'] },
  ];
  const tables: { id: string; name: string }[] = [];
  let fi = 0;
  for (const f of floors) {
    const floor = await prisma.floor.create({ data: { name: f.name, sortOrder: ++fi } });
    for (let i = 0; i < f.tables.length; i++) {
      const t = await prisma.restaurantTable.create({
        data: {
          name: f.tables[i],
          floorId: floor.id,
          seats: i % 3 === 0 ? 6 : i % 2 === 0 ? 2 : 4,
          posX: 40 + (i % 4) * 160,
          posY: 40 + Math.floor(i / 4) * 160,
          qrToken: id().replace(/-/g, '').slice(0, 16),
        },
      });
      tables.push({ id: t.id, name: t.name });
    }
  }

  // --- Müşteriler (CRM) -----------------------------------------------------
  const firstNames = ['Ayşe', 'Mehmet', 'Fatma', 'Ali', 'Selin', 'Can', 'Deniz', 'Ece', 'Emre', 'Gizem', 'Kerem', 'Merve', 'Onur', 'Pınar', 'Serkan', 'Tuğba', 'Umut', 'Yasemin', 'Barış', 'Cansu'];
  const lastNames = ['Yıldız', 'Aydın', 'Öztürk', 'Çelik', 'Koç', 'Kurt', 'Polat', 'Erdoğan', 'Güneş', 'Aksoy'];
  const notes = [null, null, 'Fıstık alerjisi', 'Cam kenarı sever', 'Çayı açık içer', 'Vejetaryen', null, 'Doğum günü kutlaması yaptı'];
  const customers: { id: string; spent: number; visits: number; last: Date | null }[] = [];
  for (let i = 0; i < 28; i++) {
    const b = new Date(1975 + ri(0, 30), ri(0, 11), ri(1, 28));
    const c = await prisma.customer.create({
      data: {
        name: `${firstNames[i % firstNames.length]} ${pick(lastNames)}`,
        phone: `0555 ${String(100 + i).padStart(3, '0')} ${String(ri(10, 99))} ${String(ri(10, 99))}`,
        birthday: b,
        note: pick(notes),
      },
    });
    customers.push({ id: c.id, spent: 0, visits: 0, last: null });
  }

  // --- Cari hesaplar & tedarikçiler -----------------------------------------
  const supplierDef = [
    { name: 'Örnek Et Toptan', cat: 'GIDA', items: ['Kıyma', 'Tavuk Göğüs', 'Kuzu Pirzola', 'Sucuk'] },
    { name: 'Deneme Manav', cat: 'GIDA', items: ['Domates', 'Salatalık', 'Sivri Biber', 'Patates', 'Limon', 'Portakal'] },
    { name: 'Demo Süt & Peynir', cat: 'GIDA', items: ['Beyaz Peynir', 'Kaşar Peyniri', 'Süt', 'Yumurta', 'Künefe Peyniri'] },
    { name: 'Örnek İçecek Dağıtım', cat: 'ICECEK', items: ['Ayran (şişe)', 'Kola (kutu)', 'Soda (şişe)', 'Çay (dökme)', 'Espresso Çekirdeği', 'Türk Kahvesi (çekirdek)'] },
  ];
  const suppliers: { id: string; name: string; cat: string; items: string[]; balance: number }[] = [];
  for (const s of supplierDef) {
    const a = await prisma.account.create({
      data: { name: s.name, type: 'TEDARIKCI', phone: '0312 111 22 ' + ri(10, 99), taxOffice: 'Çankaya', taxNumber: String(ri(1000000000, 1999999999)) },
    });
    suppliers.push({ id: a.id, name: s.name, cat: s.cat, items: s.items, balance: 0 });
  }
  const houseAccounts: { id: string; name: string; balance: number }[] = [];
  for (const n of ['Örnek Yazılım A.Ş. (öğle yemeği)', 'Komşu Kuaför']) {
    const a = await prisma.account.create({ data: { name: n, type: 'MUSTERI', phone: '0532 000 00 ' + ri(10, 99) } });
    houseAccounts.push({ id: a.id, name: n, balance: 0 });
  }

  // --- Alış faturaları (son 6 hafta) + stok lotları ---------------------------
  const accTx: any[] = [];
  const movements: any[] = [];
  const lots: any[] = [];
  const cashMoves: any[] = [];
  const origins: Record<string, string> = { Kıyma: 'Polatlı', 'Tavuk Göğüs': 'Bolu', Domates: 'Antalya', Portakal: 'Finike', Süt: 'Ankara' };
  let inv = 1000;
  for (let w = 6; w >= 0; w--) {
    for (const s of suppliers) {
      const date = at(dayStart(-w * 7 - ri(0, 2)), 10, ri(0, 59));
      const lines = s.items.map((name) => {
        const st = stock[name];
        const qty = st.unit === 'adet' ? ri(4, 12) * 12 : ri(3, 15);
        const unitPrice = r2(st.cost * (0.95 + rnd() * 0.1));
        const vatRate = s.cat === 'ICECEK' ? 20 : 1;
        const lineNet = r2(qty * unitPrice);
        const lineVat = r2((lineNet * vatRate) / 100);
        return { name, stockItemId: st.id, qty, unit: st.unit, unitPrice, vatRate, lineNet, lineVat, lineTotal: r2(lineNet + lineVat) };
      });
      const subtotal = r2(lines.reduce((a, l) => a + l.lineNet, 0));
      const vatTotal = r2(lines.reduce((a, l) => a + l.lineVat, 0));
      const grandTotal = r2(subtotal + vatTotal);
      const open = w <= 1 && s.cat === 'GIDA';
      const purchaseId = id();
      await prisma.purchase.create({
        data: {
          id: purchaseId, supplierId: s.id, invoiceNo: `DMO${++inv}`, invoiceDate: date, category: s.cat,
          subtotal, vatTotal, grandTotal, paymentStatus: open ? 'ACIK' : 'PESIN', paymentMethod: open ? null : pick(['NAKIT', 'HAVALE', 'KREDI_KARTI']),
          createdById: patronId, createdAt: date,
          items: {
            create: lines.map((l) => ({
              stockItemId: l.stockItemId, name: l.name, quantity: l.qty, unit: l.unit, unitPrice: l.unitPrice, vatRate: l.vatRate,
              lineNet: l.lineNet, lineVat: l.lineVat, lineTotal: l.lineTotal, origin: origins[l.name] ?? null,
            })),
          },
        },
      });
      for (const l of lines) {
        const def = stockDef.find((d) => d[0] === l.name)!;
        const lotId = id();
        if (def[6] && w <= 1) {
          const expiry = new Date(date);
          expiry.setDate(expiry.getDate() + (l.name === 'Süt' || l.name === 'Ayran (şişe)' ? 6 : l.name === 'Kıyma' ? 4 : 14));
          lots.push({
            id: lotId, stockItemId: l.stockItemId, supplierId: s.id, supplierName: s.name, origin: origins[l.name] ?? null,
            receivedAt: date, expiryDate: expiry, initialQty: l.qty, remainingQty: r2(l.qty * (0.2 + rnd() * 0.6)), unitCost: l.unitPrice,
          });
        }
        movements.push({
          id: id(), stockItemId: l.stockItemId, type: 'GIRIS', quantity: l.qty, note: `Alış faturası DMO${inv}`,
          lotId: def[6] && w <= 1 ? lotId : null, createdById: patronId, createdAt: date,
        });
      }
      if (open) {
        s.balance += grandTotal;
        accTx.push({ id: id(), accountId: s.id, type: 'BORC', amount: grandTotal, description: `Alış faturası DMO${inv}`, createdById: patronId, createdAt: date });
      } else {
        cashMoves.push({ id: id(), type: 'CIKIS', amount: grandTotal, category: 'ALIS', description: `${s.name} — DMO${inv}`, createdById: patronId, createdAt: date });
      }
    }
  }
  // Bir tedarikçiye kısmi ödeme
  const paidSup = suppliers[0];
  if (paidSup.balance > 0) {
    const amt = r2(paidSup.balance * 0.5);
    paidSup.balance = r2(paidSup.balance - amt);
    accTx.push({ id: id(), accountId: paidSup.id, type: 'ALACAK', amount: amt, description: 'Havale ile kısmi ödeme', createdById: patronId, createdAt: at(dayStart(-2), 15, 0) });
    cashMoves.push({ id: id(), type: 'CIKIS', amount: amt, category: 'TEDARIKCI_ODEME', description: `${paidSup.name} ödeme`, createdById: patronId, createdAt: at(dayStart(-2), 15, 0) });
  }

  // --- Sipariş geçmişi (son 45 gün) -----------------------------------------
  const orders: any[] = [];
  const items: any[] = [];
  const payments: any[] = [];
  const fiscal: any[] = [];
  const audits: any[] = [];
  const feedbacks: any[] = [];
  const consumption: Record<string, number> = {};
  const comments = ['Her şey çok lezzetliydi', 'Servis hızlıydı', 'Künefe harika', 'Çay biraz geç geldi', 'Personel çok ilgili', 'Kahvaltı bol ve taze', null, null, 'Fiyatlar biraz yüksek', 'Tekrar geleceğiz'];
  let fiscalNo = 5000;

  function buildOrder(opened: Date, status: 'KAPANDI' | 'ACIK', table: { id: string; name: string } | null, type: string, servedAll: boolean) {
    const orderId = id();
    const hour = opened.getHours();
    const waiter = pick(waiters);
    const groups: (typeof products)[] = [];
    if (hour < 12) groups.push(byCat('Kahvaltı'), byCat('Sıcak İçecekler'));
    else groups.push(byCat('Izgara'), byCat('Ara Sıcak & Çorba'), byCat('Soğuk İçecekler'), byCat('Tatlılar'), byCat('Sıcak İçecekler'));
    const n = ri(2, 6);
    let total = 0;
    for (let k = 0; k < n; k++) {
      const g = groups[k % groups.length];
      const p = pick(g);
      const qty = p.station === 'BAR' ? ri(1, 4) : ri(1, 2);
      const created = addMin(opened, k < 2 ? ri(0, 3) : ri(10, 40));
      const prep = p.station === 'BAR' ? ri(60, 240) : p.station === 'IZGARA' ? ri(600, 1300) : ri(240, 900);
      const startedAt = addMin(created, ri(0, 3));
      const readyAt = new Date(startedAt.getTime() + prep * 1000);
      let st = 'SERVIS';
      if (!servedAll) st = k === 0 ? 'SERVIS' : pick(['YENI', 'HAZIRLANIYOR', 'HAZIR', 'SERVIS']);
      items.push({
        id: id(), orderId, productId: p.id, nameSnapshot: p.name, unitPrice: p.price, quantity: qty, station: p.station,
        addedById: waiter.id, status: st,
        startedAt: st === 'YENI' ? null : startedAt,
        readyAt: st === 'SERVIS' || st === 'HAZIR' ? readyAt : null,
        servedAt: st === 'SERVIS' ? addMin(readyAt, ri(1, 4)) : null,
        prepSeconds: st === 'SERVIS' || st === 'HAZIR' ? prep : null,
        note: rnd() < 0.08 ? pick(['az pişmiş', 'acısız', 'buzsuz', 'ekstra peynir', 'şekersiz']) : null,
        createdAt: created, updatedAt: created,
      });
      total += p.price * qty;
      if (status === 'KAPANDI' && p.recipe) {
        for (const [s, q] of p.recipe) consumption[s] = (consumption[s] ?? 0) + q * qty;
      }
    }
    return { orderId, waiter, total, type, table };
  }

  for (let d = -45; d <= 0; d++) {
    const base = dayStart(d);
    const dow = base.getDay();
    const weekend = dow === 0 || dow === 6;
    const trend = 1 + (45 + d) / 120; // son haftalara doğru hafif büyüme
    const count = Math.round((weekend ? ri(42, 58) : ri(26, 38)) * trend * (d === 0 ? 0.45 : 1));
    for (let o = 0; o < count; o++) {
      // Saat dağılımı: kahvaltı, öğle ve akşam zirveleri
      const slot = rnd();
      const hour = slot < (weekend ? 0.38 : 0.18) ? ri(9, 11) : slot < 0.55 ? ri(12, 14) : slot < 0.7 ? ri(15, 17) : ri(18, 22);
      if (d === 0 && hour > new Date().getHours() - 1) continue;
      const opened = at(base, hour, ri(0, 59));
      const r = rnd();
      const type = r < 0.78 ? 'MASA' : r < 0.9 ? 'PAKET' : 'GELAL';
      const table = type === 'MASA' ? pick(tables) : null;
      const b = buildOrder(opened, 'KAPANDI', table, type, true);
      const closedAt = addMin(opened, ri(35, 95));
      let discountType: string | null = null;
      let discountValue = 0;
      let discountReason: string | null = null;
      let total = b.total;
      if (rnd() < 0.07) {
        discountType = 'YUZDE'; discountValue = 10; discountReason = 'Öğrenci indirimi';
        total = r2(total * 0.9);
        audits.push({ id: id(), action: 'ISKONTO', userId: b.waiter.id, userName: b.waiter.fullName, tableName: table?.name ?? null, orderId: b.orderId, amount: r2(b.total * 0.1), detail: '%10 öğrenci indirimi', createdAt: closedAt });
      }
      const tip = rnd() < 0.2 ? ri(2, 10) * 10 : 0;
      const cust = rnd() < 0.3 ? pick(customers) : null;
      if (cust) { cust.spent += total; cust.visits += 1; if (!cust.last || cust.last < closedAt) cust.last = closedAt; }
      orders.push({
        id: b.orderId, type, status: 'KAPANDI', tableId: table?.id ?? null, openedById: b.waiter.id, discountType, discountValue, discountReason, tip,
        customerId: cust?.id ?? null, createdAt: opened, updatedAt: closedAt, closedAt,
      });
      // Ödeme: bazen bölünmüş
      const house = rnd() < 0.03 ? pick(houseAccounts) : null;
      const method = house ? 'ACIK_HESAP' : pick(['KREDI_KARTI', 'KREDI_KARTI', 'KREDI_KARTI', 'NAKIT', 'NAKIT', 'YEMEK_KARTI']);
      if (!house && rnd() < 0.12) {
        const half = r2(total / 2);
        payments.push({ id: id(), orderId: b.orderId, method: 'NAKIT', amount: half, createdById: users.kasa.id, createdAt: closedAt });
        payments.push({ id: id(), orderId: b.orderId, method: 'KREDI_KARTI', amount: r2(total - half), createdById: users.kasa.id, createdAt: closedAt });
      } else {
        payments.push({ id: id(), orderId: b.orderId, method, amount: total, createdById: users.kasa.id, createdAt: closedAt });
      }
      if (house) {
        house.balance += total;
        accTx.push({ id: id(), accountId: house.id, type: 'BORC', amount: total, description: `Adisyon ${table ? 'Masa ' + table.name : type}`, orderId: b.orderId, createdById: users.kasa.id, createdAt: closedAt });
      }
      fiscal.push({ id: id(), orderId: b.orderId, fiscalNo: String(++fiscalNo), zNo: String(100 + 45 + d), amount: total, provider: 'simulation', status: 'OK', createdAt: closedAt });
      if (rnd() < 0.12) {
        feedbacks.push({ id: id(), tableId: table?.id ?? null, rating: pick([5, 5, 5, 4, 4, 4, 3, 5, 2]), comment: pick(comments), createdAt: addMin(closedAt, 2) });
      }
    }
    // Arada bir iptal / ikram kaydı
    if (rnd() < 0.5) {
      const w = pick(waiters);
      audits.push({ id: id(), action: pick(['IPTAL_KALEM', 'IKRAM', 'IPTAL_KALEM']), userId: w.id, userName: w.fullName, tableName: pick(tables).name, amount: pick([20, 70, 110, 190]), detail: pick(['Yanlış sipariş', 'Müşteri vazgeçti', 'Bekleme için ikram çay', 'Doğum günü ikramı']), createdAt: at(base, ri(12, 21), ri(0, 59)) });
    }
    // Günlük giderler
    if (d < 0 && rnd() < 0.35) {
      cashMoves.push({ id: id(), type: 'CIKIS', amount: pick([150, 250, 400, 600]), category: 'GIDER', description: pick(['Tüp gaz', 'Temizlik malzemesi', 'Kargo', 'Ufak tamirat', 'Ekmek (ek)']), createdById: users.kasa.id, createdAt: at(base, 17, 0) });
    }
  }

  // --- Şu an açık masalar (canlı demo için) ---------------------------------
  const now = new Date();
  const openTables = [tables[0], tables[2], tables[4], tables[8], tables[13]];
  for (const t of openTables) {
    const opened = addMin(now, -ri(8, 50));
    const b = buildOrder(opened, 'ACIK', t, 'MASA', false);
    orders.push({ id: b.orderId, type: 'MASA', status: 'ACIK', tableId: t.id, openedById: b.waiter.id, createdAt: opened, updatedAt: now });
  }
  // Bir paket sipariş yolda
  {
    const b = buildOrder(addMin(now, -12), 'ACIK', null, 'PAKET', false);
    orders.push({ id: b.orderId, type: 'PAKET', status: 'ACIK', openedById: b.waiter.id, note: 'Kapıda kartla ödeme', createdAt: addMin(now, -12), updatedAt: now });
  }

  const chunk = async <T,>(arr: T[], fn: (part: T[]) => Promise<unknown>) => {
    for (let i = 0; i < arr.length; i += 500) await fn(arr.slice(i, i + 500));
  };
  await chunk(orders, (p) => prisma.order.createMany({ data: p }));
  await chunk(items, (p) => prisma.orderItem.createMany({ data: p }));
  await chunk(payments, (p) => prisma.payment.createMany({ data: p }));
  await chunk(fiscal, (p) => prisma.fiscalReceipt.createMany({ data: p }));
  await chunk(audits, (p) => prisma.auditLog.createMany({ data: p }));
  await chunk(feedbacks, (p) => prisma.feedback.createMany({ data: p }));
  await chunk(lots, (p) => prisma.stockLot.createMany({ data: p }));

  // Satışlardan stok çıkışları (günlük toplu kayıt yerine ürün başı tek satır)
  for (const [name, qty] of Object.entries(consumption)) {
    movements.push({ id: id(), stockItemId: stock[name].id, type: 'CIKIS', quantity: r2(qty), note: 'Satış (reçeteden, son 45 gün)', createdAt: at(dayStart(-1), 23, 30) });
  }
  movements.push({ id: id(), stockItemId: stock['Domates'].id, type: 'FIRE', quantity: 2.5, note: 'Ezik / bozulmuş', createdById: users.mudur.id, createdAt: at(dayStart(-3), 11, 0) });
  movements.push({ id: id(), stockItemId: stock['Süt'].id, type: 'FIRE', quantity: 3, note: 'Tarihi geçti', createdById: users.mudur.id, createdAt: at(dayStart(-6), 9, 30) });
  movements.push({ id: id(), stockItemId: stock['Ekmek'].id, type: 'SAYIM', quantity: 60, note: 'Akşam sayımı', createdById: users.mudur.id, createdAt: at(dayStart(-1), 23, 0) });
  await chunk(movements, (p) => prisma.stockMovement.createMany({ data: p }));
  await chunk(cashMoves, (p) => prisma.cashMovement.createMany({ data: p }));
  await chunk(accTx, (p) => prisma.accountTransaction.createMany({ data: p }));
  for (const a of [...suppliers, ...houseAccounts]) {
    await prisma.account.update({ where: { id: a.id }, data: { balance: r2(a.balance) } });
  }
  for (const c of customers) {
    await prisma.customer.update({
      where: { id: c.id },
      data: { totalSpent: r2(c.spent), visitCount: c.visits, lastVisitAt: c.last, loyaltyPoints: Math.floor(c.spent / 100) },
    });
  }
  for (const t of openTables) await prisma.restaurantTable.update({ where: { id: t.id }, data: { status: 'DOLU' } });
  await prisma.restaurantTable.update({ where: { id: tables[6].id }, data: { status: 'REZERVE' } });

  // --- Kasa oturumları --------------------------------------------------------
  for (let d = -7; d < 0; d++) {
    const v = pick([0, 0, 0, -20, 15, -50, 0]);
    await prisma.cashSession.create({
      data: {
        openedById: users.kasa.id, openingCash: 1500, openedAt: at(dayStart(d), 8, 45), closedById: users.kasa.id,
        countedCash: 1500 + ri(3000, 9000), variance: v, status: 'KAPANDI', closedAt: at(dayStart(d), 23, 50),
        note: v < 0 ? 'Bozuk para eksiği' : null,
      },
    });
  }
  await prisma.cashSession.create({ data: { openedById: users.kasa.id, openingCash: 1500, openedAt: at(dayStart(0), 8, 45), status: 'ACIK' } });

  // --- Rezervasyonlar ---------------------------------------------------------
  const resv: [number, number, string, number, string, string | null][] = [
    [0, 20, 'Selin Koç', 4, 'BEKLIYOR', 'Doğum günü, pasta getirecekler'],
    [0, 21, 'Kerem Aydın', 2, 'BEKLIYOR', null],
    [1, 10, 'Gizem Polat', 6, 'BEKLIYOR', 'Hafta sonu kahvaltısı'],
    [1, 19, 'Onur Çelik', 8, 'BEKLIYOR', 'İş yemeği, sessiz masa'],
    [2, 13, 'Ece Güneş', 3, 'BEKLIYOR', null],
    [-1, 20, 'Barış Kurt', 4, 'GELDI', null],
    [-2, 19, 'Merve Aksoy', 2, 'GELMEDI', 'Telefonu açmadı'],
    [-3, 12, 'Umut Öztürk', 5, 'GELDI', null],
  ];
  for (const [d, h, name, size, status, note] of resv) {
    await prisma.reservation.create({
      data: { tableId: d === 0 && h === 20 ? tables[6].id : pick(tables).id, customerName: name, phone: '0555 000 ' + ri(10, 99) + ' ' + ri(10, 99), partySize: size, reservedAt: at(dayStart(d), h, 0), status, note, createdById: users.mudur.id },
    });
  }

  // --- Garson çağrıları -------------------------------------------------------
  await prisma.waiterCall.create({ data: { tableId: tables[2].id, type: 'GARSON', createdAt: addMin(now, -2) } });
  await prisma.waiterCall.create({ data: { tableId: tables[8].id, type: 'HESAP', createdAt: addMin(now, -1) } });

  // --- Google yorumları (örnek) -----------------------------------------------
  const reviews: [string, number, string, number][] = [
    ['Cem T.', 5, 'Kahvaltısı efsane, her şey taze. Personel güler yüzlü.', 2],
    ['Nazlı B.', 4, 'Adana çok iyiydi, sadece hafta sonu biraz bekledik.', 5],
    ['Okan D.', 5, 'Künefe için bile gelinir. Bahçesi çok keyifli.', 9],
    ['Sibel A.', 3, 'Yemekler güzel ama servis yavaştı.', 14],
    ['Tolga K.', 5, 'QR menüden sipariş vermek çok pratik.', 20],
  ];
  for (const [author, rating, text, daysAgo] of reviews) {
    await prisma.googleReview.create({
      data: { id: `demo-${author}`, author, rating, text, time: at(dayStart(-daysAgo), 14, 0), relativeTime: `${daysAgo} gün önce`, source: 'simulation', seen: daysAgo > 3 },
    });
  }

  // --- Ekipler, görevler, tavsiyeler -----------------------------------------
  const salon = await prisma.staffGroup.create({ data: { name: 'Salon Ekibi', members: { create: waiters.map((w) => ({ userId: w.id })) } } });
  const mutfakG = await prisma.staffGroup.create({ data: { name: 'Mutfak Ekibi', members: { create: [{ userId: users.usta.id }, { userId: users.mutfak.id }] } } });
  const tpl = await prisma.taskTemplate.create({ data: { title: 'Açılış kontrol listesi', description: 'Masaları sil, şekerlikleri doldur, terası aç', defaultAssigneeType: 'GROUP', defaultAssigneeId: salon.id, recurrence: '{"freq":"daily"}', pinned: true, useCount: 12 } });
  const tasks = [
    { title: 'Açılış kontrol listesi', assigneeType: 'GROUP', assigneeGroupId: salon.id, templateId: tpl.id, recurrence: '{"freq":"daily"}', dueDate: at(dayStart(0), 9, 0), status: 'TAMAMLANDI', completedById: users.zeynep.id, completedAt: at(dayStart(0), 8, 55) },
    { title: 'Izgara davlumbaz temizliği', assigneeType: 'GROUP', assigneeGroupId: mutfakG.id, dueDate: at(dayStart(1), 23, 0), status: 'ACIK', recurrence: '{"freq":"weekly","days":[1]}' },
    { title: 'Espresso çekirdeği siparişi ver', assigneeType: 'USER', assigneeUserId: users.mudur.id, dueDate: at(dayStart(0), 16, 0), status: 'ACIK', description: 'Stok kritik seviyenin altında' },
    { title: 'Bahçe şemsiyelerini kontrol et', assigneeType: 'USER', assigneeUserId: users.mert.id, dueDate: at(dayStart(-1), 12, 0), status: 'ACIK' },
    { title: 'Yeni menü fiyatlarını tabletlere işle', assigneeType: 'USER', assigneeUserId: users.mudur.id, dueDate: at(dayStart(-2), 18, 0), status: 'TAMAMLANDI', completedById: users.mudur.id, completedAt: at(dayStart(-2), 17, 20) },
  ];
  for (const t of tasks) await prisma.task.create({ data: { ...t, createdById: patronId } });

  await prisma.staffRecommendation.createMany({
    data: [
      { targetType: 'ROLE', targetRole: 'GARSON', title: 'Tatlı önerin', body: 'Akşam masalarında tatlı siparişi düşük. Hesaptan önce künefe önermeyi unutmayın.', source: 'MANUAL', severity: 'info', status: 'ONAYLANDI', createdById: patronId, approvedById: patronId, approvedAt: at(dayStart(-1), 10, 0) },
      { targetType: 'GROUP', targetGroupId: mutfakG.id, title: 'Izgara bekleme süresi', body: 'Cumartesi akşamı ızgara ortalama hazırlık süresi 18 dakikayı geçti. Yoğun saatte ikinci ızgaracı düşünülebilir.', source: 'AUTO', severity: 'warning', status: 'BEKLIYOR', dedupeKey: 'demo-izgara-sure' },
    ],
  });

  // --- Vardiya & mesai --------------------------------------------------------
  const shiftUsers = [users.garson, users.zeynep, users.mert, users.kasa, users.usta, users.mudur];
  for (let d = -6; d <= 6; d++) {
    for (const u of shiftUsers) {
      const morning = (d + u.fullName.length) % 2 === 0;
      await prisma.shift.create({ data: { userId: u.id, userName: u.fullName, date: dayStart(d), startTime: morning ? '08:30' : '15:30', endTime: morning ? '16:30' : '00:00' } });
      if (d < 0) {
        const cin = at(dayStart(d), morning ? 8 : 15, ri(20, 45));
        const cout = addMin(cin, ri(470, 510));
        await prisma.attendance.create({ data: { userId: u.id, userName: u.fullName, clockIn: cin, clockOut: cout, workedMinutes: Math.round((cout.getTime() - cin.getTime()) / 60000), source: 'QR' } });
      }
    }
  }

  console.log(`✓ Demo restoran hazır: ${orders.length} adisyon, ${items.length} kalem, ${products.length} ürün.`);
  console.log('  Girişler: patron/patron123 · garson/garson123 · mutfak/mutfak123 · kasa/kasa123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
