# Uzaktan Erişim

FLOW varsayılan olarak **yalnızca restoranın yerel ağında** çalışır. Bu döküman,
patronun işletmeyi dışarıdan takip edebilmesi için uzaktan erişimin nasıl
açılacağını anlatır.

Kullanılan yöntem **Cloudflare Tunnel**: restorandaki bilgisayar Cloudflare'e
*dışarı doğru* bir bağlantı açar, Cloudflare gelen ziyaretçileri bu bağlantı
üzerinden içeri taşır.

Bunun anlamı:

- **Modemde port açmak gerekmez.** Restoranın modeminde hiçbir ayar değişmez.
- **Sabit IP gerekmez.** İnternet servis sağlayıcısı IP'yi değiştirse de çalışır.
- **HTTPS otomatik gelir.** Sertifika işi yok, şifreler açık metin gitmez.
- **Sunucu internete doğrudan açılmaz.** Dışarıdan içeri açılmış bir kapı yoktur.

---

## Önce güvenlik — bu adım atlanamaz

Yerel ağda zayıf bir şifre, ancak restorana fiziksel olarak giren biri için
risktir. Uzaktan erişim açıldığı anda **aynı şifre tüm internete açılır.**

Bu yüzden sistem, aşağıdakiler düzeltilmeden uzaktan erişimle **başlamaz**:

- `JWT_SECRET` hâlâ kurulumdan gelen örnek değerse
- `patron` / `garson` / `mutfak` hesaplarından biri hâlâ varsayılan şifredeyse

Düzeltmek için:

```bash
npm run remote:harden           # şifreleri siz yazarsınız
npm run remote:harden -- --auto # hepsini üretsin, soru sormasın
```

Bu komut `JWT_SECRET`'i rastgele yeniler ve varsayılan şifreli hesaplara yeni
şifre koyar (siz yazarsınız, ya da boş bırakıp güçlü bir tane ürettirirsiniz).
**Yeni şifreler bir kez gösterilir — o an kaydedin.**

Zaten değiştirilmiş şifrelere ve güçlü bir `JWT_SECRET`'e dokunmaz; tekrar
çalıştırmak güvenlidir.

> `JWT_SECRET` yenilenince açık oturumlar kapanır — herkesin bir kez daha
> giriş yapması gerekir. Beklenen davranıştır.

Sistem ayrıca dışarıya açıkken kendini şununla korur:

| Koruma | Ne yapar |
|---|---|
| Giriş limiti | IP başına 5 dakikada 10 deneme. Sonrası `429`. Şifre deneme saldırısını durdurur. |
| Genel istek limiti | IP başına dakikada 600 istek. Otomatik taramaları keser. |
| Güvenlik başlıkları | `helmet` — HSTS, `nosniff`, `X-Frame-Options`. |
| Gerçek IP tespiti | Tünel arkasında limitler gerçek ziyaretçi IP'sine uygulanır, hepsi tek IP sayılmaz. |

---

## Yol 1 — Hızlı test (ücretsiz, domain gerekmez)

Sistemi denemek için. **Ticari kullanım için uygun değil.**

```bash
npm run remote:setup     # "1" seçin
npm run remote:start     # adres bu pencerede yazar
```

Ekranda şuna benzer bir adres çıkar:

```
https://covering-descriptions-subsequently-steering.trycloudflare.com
```

Bu adresi telefonunuzdan açabilirsiniz.

**Sınırları:**

- Adres **her yeniden başlatmada değişir** — patrona her seferinde yeni link.
- Pencere kapanırsa erişim durur.
- 200 eşzamanlı istek sınırı var.
- Cloudflare bunu resmen "yalnız test için" sunar.
- E-posta doğrulaması (Access) eklenemez — linki bilen giriş ekranını görür
  (şifre yine gerekir).

---

## Yol 2 — Kalıcı adres (önerilen)

Her işletme kendi sabit adresini alır: `bistro-ahmet.flowrms.com`

### Tek domain, sınırsız işletme

Her işletmenin ayrı domain alması **gerekmez**. Sistemi kuran taraf **bir tane**
domain alır (`flowrms.com`, ~$10/yıl), her işletme bir alt alan adı alır:

```
bistro-ahmet.flowrms.com    → Ahmet'in restoranı
kofteci-mehmet.flowrms.com  → Mehmet'in restoranı
pizzaci.flowrms.com         → 3. işletme
```

Alt alan adı sınırsız ve ücretsizdir. 100 işletme de olsa domain maliyeti
yılda ~$10 — **işletme başına değil, toplamda.** İşletme hiçbir şey satın almaz.

> **Neden ücretsiz domain kullanmıyoruz?** Freenom (.tk, .ml, .ga, .cf, .gq)
> 2023'te Meta tarafından dava edildi, ICANN akreditasyonunu iptal etti ve
> 2024'te domain işinden çıktı; 12.4 milyon adres kapandı. 2026 itibarıyla yeni
> kayıt yapılamıyor. Ayrıca Cloudflare Tunnel'ın kalıcı adres için domain'in
> Cloudflare nameserver'larında olmasını şart koşuyor — ücretsiz dinamik DNS
> servisleri (DuckDNS, No-IP) bu şartı sağlayamaz.

### Bir kereye mahsus hazırlık (sistemi kuran taraf)

1. Bir domain alın (Cloudflare Registrar maliyetine satar) ve Cloudflare'e ekleyin.
2. Cloudflare → **My Profile → API Tokens → Create Token**. İzinler:
   - `Account → Cloudflare Tunnel → Edit`
   - `Zone → DNS → Edit`
   - (Access kullanacaksanız) `Account → Access: Apps and Policies → Edit`
3. Proje kökünde `.cf-provision.env` oluşturun — **bu dosya git'e girmez:**

```
CF_API_TOKEN=...
CF_ACCOUNT_ID=...
CF_ZONE_ID=...
CF_BASE_DOMAIN=flowrms.com
```

### Her yeni işletme için — tek komut

```bash
npm run remote:provision -- bistro-ahmet --email ahmet@ornek.com
```

Bu komut Cloudflare panelinde hiçbir şey tıklamadan:

1. Tüneli oluşturur
2. Token'ı alır
3. `bistro-ahmet.flowrms.com → http://localhost:3011` yönlendirmesini yazar
4. DNS kaydını açar
5. `--email` verdiyseniz Access politikasını kurar

Sonunda işletmeye verilecek **adres + token**'ı ekrana basar.

Aynı işletme için tekrar çalıştırmak zararsızdır (yenisini oluşturmaz, mevcudu bulur).

### İşletmede yapılacaklar

1. `setup-remote.bat` → **sağ tık → "Yönetici olarak çalıştır"**
2. `2` seçin
3. Token'ı yapıştırın, adresi yazın

Bu kadar. Betik `cloudflared`'i indirir, Windows servisi olarak kurar —
**bilgisayar açıldığında kendiliğinden başlar**, kimsenin bir şey yapması gerekmez.

### `--email` ne yapar?

Cloudflare Access ekler: adrese giren kişiden önce e-posta doğrulama kodu
istenir, sonra FLOW giriş ekranı gelir. İki katman olur ve FLOW giriş ekranı
internete hiç görünmez.

`--email` **vermezseniz** adres herkese açık olur — linki bilen giriş ekranını
görür (şifre yine gerekir). Tam yetkili uzaktan erişimde `--email` kullanmanız
şiddetle önerilir.

---

## Ayarlar (`server/.env`)

```bash
REMOTE_MODE=off          # off | quick | named
REMOTE_HOSTNAME=         # named: bistro-ahmet.flowrms.com
TUNNEL_TOKEN=            # named: gizli token — paylaşmayın
```

`npm run remote:setup` bu değerleri sizin yerinize doldurur.

---

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run remote:harden` | Şifreleri ve `JWT_SECRET`'i güvenli hale getirir |
| `npm run remote:harden -- --auto` | Aynısı, ama şifreleri sormadan üretir |
| `npm run remote:setup` | Uzaktan erişimi kurar (işletme tarafı) |
| `npm run remote:start` | Tüneli başlatır |
| `npm run remote:provision -- <ad>` | Yeni işletmeye adres açar (kuran taraf) |

---

## Sorun giderme

**"UZAKTAN ERİŞİM AÇILAMADI — ÖNCE GÜVENLİK"**
Beklenen davranış. `npm run remote:harden` çalıştırın.

**Servis kurulamıyor / "Access is denied"**
`setup-remote.bat`'a sağ tık → "Yönetici olarak çalıştır".

**Adres açılmıyor (502)**
FLOW sunucusu çalışmıyor demektir. Önce `start.bat`, sonra tünel.
Tünel bağlıdır ama arkasında sunucu yoktur.

**Adres açılmıyor (DNS bulunamadı)**
DNS yayılması birkaç dakika sürebilir. `--email` kullandıysanız Access
ekranının gelmesi normaldir.

**Tünel neden bağlanmıyor, ayrıntı görmek istiyorum**

```bash
REMOTE_DEBUG=1 npm run remote:start
```

**Uzaktan erişimi tamamen kapatmak**
`server/.env` içinde `REMOTE_MODE=off`, sunucuyu yeniden başlatın.
Windows servisini de kaldırmak için:

```bash
.cloudflared/cloudflared.exe service uninstall
```

---

## Bilinmesi gerekenler

- **Restorandaki bilgisayar açık olmalı.** Uzaktan erişim, o bilgisayardaki
  sunucuya bağlanır; kapalıysa adres de çalışmaz.
- **Personel tabletleri etkilenmez.** Onlar yerel ağdan (`http://192.168.x.x:3011`)
  bağlanmaya devam eder, trafikleri tünelden geçmez.
- **Tam yetkiyle bağlanıyorsunuz.** Uzaktan menü/fiyat değiştirme, adisyon
  iptali dahil her şey yapılabilir. Bu yüzden `--email` (Access) ve güçlü şifre
  önemli.
