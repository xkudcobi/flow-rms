# FLOW — Restoran Yönetim Sistemi

Tek bir bilgisayarda **yerel sunucu** olarak çalışır; aynı ağdaki **garson tabletleri, mutfak
ekranı ve kasa** tarayıcıdan bağlanır. İnternet gerekmez (yapay zeka bile yereldir). Adisyon,
mutfak (KDS), ödeme/fiş, stok, cari, kasa, personel, CRM, QR self-servis, raporlar ve öngörüler
tek sistemde.

---

## 🏪 İşletme İçin Kurulum (adım adım)

### 1. Ön koşul — Node.js
Sunucu olacak bilgisayara bir kez **Node.js LTS** kurun: <https://nodejs.org> (indir → kur → ileri, ileri).

### 2. Sistemi indir
GitHub sayfasında **Code → Download ZIP** (veya bir sürümün "Assets" altındaki ZIP'i). ZIP'i çıkarın.

### 3. Kurulum (bir kez)
- **Windows:** `setup.bat` dosyasına çift tıklayın. "Kurulum tamamlandi" yazana kadar bekleyin.
- **Mac/Linux:** terminalde klasöre girip `bash setup.sh`.

Bu adım her şeyi hazırlar: bağımlılıklar, veritabanı, örnek menü/masalar/kullanıcılar ve derleme.

### 4. Ağ izni (bir kez, tabletlerin bağlanması için)
- **Windows:** `firewall.bat` dosyasına **sağ tık → Yönetici olarak çalıştır**.
- **Linux:** `sudo ufw allow 3011/tcp` · **Mac:** ilk çalıştırmada çıkan ağ izni penceresinde "İzin Ver".

### 5. Başlat
- **Windows:** `start.bat` çift tık. · **Mac/Linux:** `bash start.sh`.
- Açılan pencere birkaç adres yazar:
  ```
  Bu bilgisayarda:  http://localhost:3011
  Aynı ağdaki cihazlardan:  http://192.168.1.27:3011
  ```
  **Bu pencereyi açık bırakın** — kapatırsanız sistem durur.

### 6. Cihazları bağla
Garson tableti / mutfak ekranı / kasa bilgisayarının tarayıcısında yukarıdaki
`http://<sunucu-ip>:3011` adresini açın. Hepsi aynı ağa (aynı Wi-Fi/router) bağlı olmalı.

### Varsayılan girişler
| Kullanıcı | Şifre | Rol |
|-----------|-------|-----|
| patron | patron123 | PATRON (tam yetki) |
| garson | garson123 | GARSON |
| mutfak | mutfak123 | MUTFAK |
> İlk işten sonra **Kullanıcılar** ekranından bu şifreleri değiştirin / kendi personelinizi ekleyin.

---

## 🤖 Yapay Zeka (opsiyonel, tek tık)
FLOW'un asistanı ve doğal dil sorguları tamamen **yerel** çalışır (Ollama). İstemezseniz sistem
yapay zeka olmadan da tam çalışır (asistan "kapalı" görünür).

Açmak için:
- **Windows:** `install-ai.bat` çift tık. · **Mac/Linux:** `bash install-ai.sh`.
- Ollama'yı kurar, bir modeli indirir ve ayarı otomatik açar. Sonra sunucuyu yeniden başlatın (`start`).
- Model bilgisayarın RAM'ini kullanır: **llama3.2 (~2GB)** orta seviye PC için yeterlidir. Daha akıcı
  Türkçe isteyen ve güçlü PC'si olanlar `llama3.1:8b`'ye geçebilir (betiğin sonundaki nota bakın).

---

## 🖨️ Yazıcı (opsiyonel)
Mutfak/kasa fişi için ağ (ESC/POS, TCP 9100) yazıcısı. `server/.env` içinde `PRINTER_HOST` /
`PRINTER_PORT` satırlarını açıp yazıcı IP'sini girin. Tanımlı değilse fişler yazdırılmaz, önizleme loglanır.

---

## 🔧 Sorun Giderme
- **Tabletten açılmıyor:** aynı ağda olduklarından emin olun; `firewall.bat`'ı (yönetici) çalıştırın;
  adresin `http://<sunucu-ip>:3011` olduğunu doğrulayın (sunucu penceresindeki adres).
- **Port kullanımda:** `server/.env` içinde `PORT` değerini değiştirin (ör. 3012) ve yeniden başlatın.
- **Kurulum hata verdi:** Node.js LTS kurulu mu? Kurulumu antivirüs/izin engellemiş olabilir.
- **Sunucu IP'si:** Windows'ta `ipconfig`, Mac/Linux'ta `ifconfig`/`ip addr` ile "IPv4" adresini görün
  (sunucu başlarken de yazdırır).

---

## 👩‍💻 Geliştirici Notları

**Teknoloji:** `web/` React+TS+Vite+Tailwind · `server/` NestJS+Prisma+SQLite · socket.io (gerçek zamanlı).

**Mimari (üretim):** `npm run start` → NestJS sunucusu hem API'yi (`/api`) hem derlenmiş React
uygulamasını (`web/dist`) hem socket.io'yu **tek port (3011)** üzerinden servis eder. Her cihaz tek URL açar.

**Komutlar (kök):**
- `npm run setup` — kurulum (install + .env üret + `prisma migrate deploy` + seed + build).
- `npm start` — üretim (tek sunucu, 3011).
- `npm run dev` — geliştirme (Nest watch 3011 + Vite 5173 + graphify watch). Web dev: <http://localhost:5173>.

**Veritabanı:** SQLite (`server/prisma/dev.db`), tek işletme/tek sunucu için ideal. Şema Postgres'e
taşınabilir yazıldı (`server/prisma/schema.prisma` provider + `DATABASE_URL`). Migration'lar
`prisma migrate deploy` ile uygulanır.

**Ortam değişkenleri:** `server/.env` (kurulumda `server/.env.example`'dan üretilir, rastgele
`JWT_SECRET` ile). Simülasyon/opsiyonel: `FISCAL_PROVIDER`, `EINVOICE_PROVIDER`, `REVIEWS_PROVIDER`,
`AI_PROVIDER`. **`GRAPH_MEMORY`** varsayılan kapalı; açmak (gelişmiş) `pip install graphifyy` gerektirir.

**Roller:** `PATRON` · `MUDUR` · `KASIYER` · `GARSON` · `MUTFAK`. Yetki backend'de zorlanır (401/403).
