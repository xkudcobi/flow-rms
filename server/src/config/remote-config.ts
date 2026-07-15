/**
 * Uzaktan erişim (Cloudflare Tunnel) yapılandırması.
 *
 * Modlar:
 *   off   — Sadece yerel ağ (varsayılan). Sistem internete kapalı.
 *   quick — trycloudflare.com üzerinden geçici adres. Domain gerekmez, ücretsiz;
 *           adres her yeniden başlatmada değişir. Cloudflare "yalnız test" diyor.
 *   named — Kendi domain'inizdeki kalıcı adres (ör. bistro.flowrms.com).
 *           Cloudflare Access ile e-posta doğrulaması eklenebilir.
 */
export type RemoteMode = 'off' | 'quick' | 'named';

export function remoteMode(): RemoteMode {
  const raw = (process.env.REMOTE_MODE || 'off').trim().toLowerCase();
  return raw === 'quick' || raw === 'named' ? raw : 'off';
}

/** Uzaktan erişim açık mı? (yani sistem yerel ağın dışına çıkıyor mu) */
export function remoteEnabled(): boolean {
  return remoteMode() !== 'off';
}

/** named modunda işletmenin kalıcı adresi; diğer modlarda undefined. */
export function remoteHostname(): string | undefined {
  const h = (process.env.REMOTE_HOSTNAME || '').trim();
  return h ? h.replace(/^https?:\/\//, '').replace(/\/+$/, '') : undefined;
}
