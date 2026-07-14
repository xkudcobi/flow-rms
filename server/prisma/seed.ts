import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = (p: string) => bcrypt.hash(p, 10);

  // --- Kullanıcılar ---
  await prisma.user.upsert({
    where: { username: 'patron' },
    update: {},
    create: {
      username: 'patron',
      fullName: 'İşletme Sahibi',
      role: 'PATRON',
      password: await hash('patron123'),
    },
  });
  await prisma.user.upsert({
    where: { username: 'garson' },
    update: {},
    create: {
      username: 'garson',
      fullName: 'Ahmet Garson',
      role: 'GARSON',
      password: await hash('garson123'),
    },
  });
  await prisma.user.upsert({
    where: { username: 'mutfak' },
    update: {},
    create: {
      username: 'mutfak',
      fullName: 'Mutfak Ekranı',
      role: 'MUTFAK',
      password: await hash('mutfak123'),
    },
  });

  // --- Menü (kategori + ürün) ---
  const already = await prisma.category.count();
  if (already === 0) {
    const icecekler = await prisma.category.create({
      data: { name: 'İçecekler', sortOrder: 1, color: '#2563eb' },
    });
    const anaYemek = await prisma.category.create({
      data: { name: 'Ana Yemekler', sortOrder: 2, color: '#dc2626' },
    });
    const tatlilar = await prisma.category.create({
      data: { name: 'Tatlılar', sortOrder: 3, color: '#d97706' },
    });

    await prisma.product.createMany({
      data: [
        { name: 'Çay', price: 15, categoryId: icecekler.id, station: 'BAR' },
        { name: 'Türk Kahvesi', price: 45, categoryId: icecekler.id, station: 'BAR' },
        { name: 'Ayran', price: 25, categoryId: icecekler.id, station: 'BAR' },
        { name: 'Kola', price: 40, categoryId: icecekler.id, station: 'BAR' },
        { name: 'Adana Kebap', price: 320, categoryId: anaYemek.id, station: 'IZGARA' },
        { name: 'Izgara Köfte', price: 280, categoryId: anaYemek.id, station: 'IZGARA' },
        { name: 'Tavuk Şiş', price: 260, categoryId: anaYemek.id, station: 'IZGARA' },
        { name: 'Mercimek Çorbası', price: 90, categoryId: anaYemek.id, station: 'MUTFAK' },
        { name: 'Künefe', price: 150, categoryId: tatlilar.id, station: 'TATLI' },
        { name: 'Sütlaç', price: 110, categoryId: tatlilar.id, station: 'TATLI' },
      ],
    });
  }

  // --- Salon & Masa ---
  const floorCount = await prisma.floor.count();
  if (floorCount === 0) {
    const icSalon = await prisma.floor.create({
      data: { name: 'İç Salon', sortOrder: 1 },
    });
    const bahce = await prisma.floor.create({
      data: { name: 'Bahçe', sortOrder: 2 },
    });

    const mk = (name: string, floorId: string, x: number, y: number) => ({
      name,
      floorId,
      seats: 4,
      posX: x,
      posY: y,
    });
    await prisma.restaurantTable.createMany({
      data: [
        mk('1', icSalon.id, 40, 40),
        mk('2', icSalon.id, 200, 40),
        mk('3', icSalon.id, 360, 40),
        mk('4', icSalon.id, 40, 200),
        mk('5', icSalon.id, 200, 200),
        mk('6', icSalon.id, 360, 200),
        mk('B1', bahce.id, 40, 40),
        mk('B2', bahce.id, 200, 40),
        mk('B3', bahce.id, 360, 40),
      ],
    });
  }

  // eslint-disable-next-line no-console
  console.log('✓ Seed tamamlandı. Giriş: patron / patron123');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
