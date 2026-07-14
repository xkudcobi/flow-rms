// .env'i her şeyden ÖNCE yükle (DI-zamanı okunan process.env değerleri için).
// Açık path: sunucu hangi dizinden başlatılırsa başlatılsın server/.env bulunur.
import * as dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(__dirname, '..', '.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { networkInterfaces } from 'os';
import { AppModule } from './app.module';

// Yerel ağdaki (LAN) IPv4 adreslerini döndürür — tabletler/KDS bu adresten bağlanır.
function lanAddresses(): string[] {
  const out: string[] = [];
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // LAN'daki tüm cihazların (terminal, tablet, KDS) bağlanabilmesi için CORS açık.
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = Number(process.env.PORT) || 3011;
  // 0.0.0.0 -> yerel ağdaki diğer cihazlar sunucu IP'sinden erişebilir.
  await app.listen(port, '0.0.0.0');

  // Personelin bağlanacağı adresleri konsola bas.
  const ips = lanAddresses();
  // eslint-disable-next-line no-console
  console.log('\n========================================================');
  console.log('  FLOW Restoran Yönetim Sistemi çalışıyor');
  console.log('========================================================');
  console.log('  Bu bilgisayarda:  http://localhost:' + port);
  if (ips.length) {
    console.log('  Aynı ağdaki cihazlardan (tablet, mutfak ekranı, kasa):');
    for (const ip of ips) console.log('     →  http://' + ip + ':' + port);
  } else {
    console.log('  (Ağ adresi bulunamadı — kablolu/kablosuz ağa bağlı olun.)');
  }
  console.log('  Varsayılan girişler:  patron/patron123 · garson/garson123 · mutfak/mutfak123');
  console.log('========================================================\n');
}
bootstrap();
