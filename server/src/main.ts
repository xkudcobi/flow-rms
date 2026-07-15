// .env'i her şeyden ÖNCE yükle (DI-zamanı okunan process.env değerleri için).
// Açık path: sunucu hangi dizinden başlatılırsa başlatılsın server/.env bulunur.
import * as dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(__dirname, '..', '.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { networkInterfaces } from 'os';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { assertRemoteSecurity } from './config/boot-guard';
import { remoteEnabled, remoteHostname, remoteMode } from './config/remote-config';

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
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Uzaktan erişim açıksa: varsayılan şifre / örnek JWT_SECRET ile açılmayı reddet.
  await assertRemoteSecurity(app.get(PrismaService));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // Güvenlik başlıkları. contentSecurityPolicy kapalı: React uygulaması aynı
  // sunucudan servis ediliyor ve varsayılan CSP inline stilleri kırıyor.
  app.use(helmet({ contentSecurityPolicy: false }));

  // cloudflared aynı makinede çalışır ve isteği 127.0.0.1'e iletir. 'loopback'
  // dersek: tünelden gelen isteklerde req.ip = gerçek ziyaretçi IP'si olur
  // (rate limit doğru çalışır), ama LAN'daki bir cihaz X-Forwarded-For
  // uydurarak limiti atlatamaz — çünkü onun bağlantısı loopback değildir.
  app.set('trust proxy', 'loopback');

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

  if (remoteEnabled()) {
    const mode = remoteMode();
    console.log('');
    console.log('  Uzaktan erişim: AÇIK (' + mode + ')');
    if (mode === 'named') {
      const host = remoteHostname();
      console.log(host
        ? '     →  https://' + host
        : '     ⚠ REMOTE_HOSTNAME boş — server/.env içinde adresi tanımlayın.');
    } else {
      console.log('     Adres cloudflared penceresinde yazıyor (her başlatmada değişir).');
    }
  } else {
    console.log('');
    console.log('  Uzaktan erişim: kapalı (yalnızca yerel ağ).');
  }

  // Uzaktan erişim açıkken bu şifreler zaten değiştirilmiş oluyor (boot-guard
  // buna izin vermeden başlatmıyor) — yazdırmak hem yanlış hem gereksiz riskli.
  if (!remoteEnabled()) {
    console.log('  Varsayılan girişler:  patron/patron123 · garson/garson123 · mutfak/mutfak123');
  }
  console.log('========================================================\n');
}
bootstrap();
