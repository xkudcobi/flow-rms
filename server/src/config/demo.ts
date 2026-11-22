// Herkese açık demo kurulumu (DEMO_MODE=1). Müşteriler giriş ekranındaki
// hazır hesaplarla girer; biri bu hesapların şifresini değiştirir ya da
// pasifleştirirse diğer herkes kilitlenir. Bu yüzden demo hesapları korunur.
import { BadRequestException } from '@nestjs/common';

export const DEMO_USERNAMES = ['patron', 'garson', 'mutfak', 'kasa'];

export function demoMode(): boolean {
  return process.env.DEMO_MODE === '1' || process.env.DEMO_MODE === 'true';
}

export function assertNotDemoAccount(username: string | null | undefined) {
  if (demoMode() && username && DEMO_USERNAMES.includes(username)) {
    throw new BadRequestException(
      'Demo sürümünde hazır demo hesaplarının şifresi, rolü ve durumu değiştirilemez. Yeni bir kullanıcı ekleyip onu düzenleyebilirsiniz.',
    );
  }
}
