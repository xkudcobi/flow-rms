// Sayfa bazlı eğitim turları. Her adım bir açıklama kartıdır (Sonraki/Atla).
// selector verilirse ilgili alan parlayarak vurgulanır (spotlight); yoksa kart
// ortada gösterilir. Yeni sayfa/adım eklemek için buraya kayıt eklemek yeterli.

export interface TourStep {
  title: string;
  body: string;
  selector?: string; // varsa bu CSS seçicisine denk gelen alanı vurgular
}
export interface Tour {
  title: string;
  steps: TourStep[];
}

const TOURS: Record<string, Tour> = {
  '/salon': {
    title: 'Salon Planı',
    steps: [
      { title: 'Salon Planı', body: 'Burası restoranın kuş bakışı görünümü. Her kutu bir masadır; renkler durumu gösterir: gri = boş, mavi/dolu = açık adisyon, kırmızı = rezerveli. Durumlar tüm cihazlarda canlı güncellenir.' },
      { title: 'Masaya dokun → adisyon', body: 'Bir masaya tıklayınca o masanın adisyonu (hesabı) açılır; menüden ürün ekleyip mutfağa gönderir, ödeme alırsın. Dolu masaya tekrar girince mevcut hesabı görürsün.' },
      { title: 'Katlar / bölümler', body: 'Üstteki sekmeler katları/bölümleri (Bahçe, İç Salon, Üst Kat…) ayırır. Her bölümün masalarını ayrı planda düzenleyebilirsin.' },
      { title: 'Düzenle modu', body: 'Bu butonla düzenlemeye geçersin: masaları sürükleyerek yerleştir, koltuk sayısını ayarla, kat/masa ekle-sil. İşin bitince “Bitir” de.', selector: '[data-tour="salon-edit"]' },
      { title: 'Masaları birleştir', body: 'Kalabalık grup için iki dolu masayı “Birleştir” ile tek hesapta topla. Önce bu butona, sonra sırayla iki masaya tıklarsın. Hesap tek adisyonda toplanır.', selector: '[data-tour="salon-merge"]' },
      { title: 'Yapay zeka asistanı', body: 'Sağ alttaki bu 🤖 butona “bahçeye 2 masa ekle” veya “masa 3 ile 5’i birleştir” yazabilirsin. Asistan işlemi önerir, sen onaylayınca uygular — yetkin yoksa yapmaz.', selector: '[data-tour="ai-assistant"]' },
      { title: 'Bildirim zili', body: 'Buradaki zilde bekleyen işler birikir: geciken sipariş, garson/hesap çağrısı, yeni yorum. Üstündeki kırmızı sayı okunmamış bildirim demektir; sol menüde de ilgili sayfada kırmızı nokta çıkar.', selector: '[data-tour="notif-bell"]' },
    ],
  },
  '/adisyon': {
    title: 'Adisyon (Sipariş & Hesap)',
    steps: [
      { title: 'Adisyon Ekranı', body: 'Bir masanın tüm hesabı burada yönetilir: sipariş al, mutfağa gönder, ödeme al, fiş yazdır.' },
      { title: 'Menüden ürün seç', body: 'Sol/orta alandaki ürün ızgarasından ürüne tıklayarak sepete eklersin. Kategori sekmeleriyle menüde gezinir, arama ile hızlı bulursun.', selector: '[data-tour="adisyon-menu"]' },
      { title: 'Sepet & not', body: 'Seçtiğin kalemler sepette toplanır; adet artır/azalt, kaleme not ekle (“az acılı”, “buzsuz” gibi).', selector: '[data-tour="adisyon-cart"]' },
      { title: 'Mutfağa Gönder', body: 'Sepeti “Mutfağa Gönder” ile mutfağa iletirsin. Gönderilen kalemler mutfak ekranına (KDS) düşer, istasyona göre fiş basılır ve reçeteli ürünlerde stok otomatik iner.', selector: '[data-tour="adisyon-send"]' },
      { title: 'Ödeme / Hesap', body: 'Ödeme al: nakit, kart, yemek kartı veya açık hesap. Hesabı bölebilir (2/3/4’e ya da kalem seçerek), bahşiş girebilir, müşteri bağlayıp sadakat puanı kullandırabilirsin.', selector: '[data-tour="adisyon-pay"]' },
      { title: 'İskonto / ikram', body: 'Yetkin varsa (Patron/Müdür) iskonto veya tam ikram uygulayabilirsin. Bu işlemler Denetim ekranına kayıt olarak düşer.' },
      { title: 'Fiş yazdır', body: 'Adisyon fişini ve kapanışta mali fişi yazdırabilirsin. Yazıcı tanımlı değilse önizleme sunucu logunda görünür.' },
    ],
  },
  '/mutfak': {
    title: 'Mutfak (KDS)',
    steps: [
      { title: 'Mutfak Ekranı', body: 'Gelen siparişler burada üç sütunda akar: Bekleyen (yeni) → Hazırlanıyor → Servise Hazır. Ekran canlı; yeni sipariş geldiğinde otomatik güncellenir.' },
      { title: 'Hazırlığa başla', body: 'Karta dokunarak “Hazırlanıyor”a alırsın; süre saymaya başlar. Hazır olunca “Hazır” işaretle — hazırlık süresi otomatik kaydedilir (performans/analiz için).', selector: '[data-tour="kds-board"]' },
      { title: 'İstasyon filtresi', body: 'Izgara, bar, tatlı gibi istasyonlara göre filtreleyebilirsin; her istasyon yalnız kendi işini görür.' },
      { title: 'Geciken siparişler', body: 'Uzun süredir bekleyen kalemler kırmızıyla uyarır ve bildirim ziline “geciken sipariş” olarak düşer — hiçbir masa unutulmaz.' },
    ],
  },
  '/adisyonlar': {
    title: 'Adisyonlar',
    steps: [
      { title: 'Aktif Adisyonlar', body: 'Şu an açık olan tüm hesapları tek ekranda izlersin; soldaki listeden birini seçince sağda özeti çıkar, “Masaya Git” ile adisyonuna geçersin.' },
      { title: 'Günlük geçmiş', body: '“Günlük” sekmesinde gün içinde kapanan adisyonları, hangi masada ne alındığını görürsün — hesap kapandıktan sonra bile.' },
    ],
  },
  '/menu': {
    title: 'Menü Yönetimi',
    steps: [
      { title: 'Menü Yönetimi', body: 'Kategorileri ve ürünleri buradan yönetirsin: ekle, düzenle, fiyat değiştir, sırala, pasifleştir.' },
      { title: 'Kategori ekle', body: 'Önce kategori oluştur (Ana Yemek, İçecek, Tatlı…). Ürünler kategoriler altında gruplanır; adisyon ve QR menüde bu düzende görünür.', selector: '[data-tour="menu-add-category"]' },
      { title: 'Ürün ekle', body: 'Ürün eklerken ad, fiyat, kategori ve istasyon (mutfak/bar) girersin. İstasyon, siparişin hangi mutfak ekranına/yazıcıya gideceğini belirler.', selector: '[data-tour="menu-add-product"]' },
      { title: 'Maliyet & kâr', body: 'Ürüne (Stok sayfasından) reçete tanımlarsan maliyet, kâr ve marj otomatik hesaplanır; Kârlılık sayfasında menü mühendisliği analizini görürsün.' },
      { title: '86 / Tükendi', body: 'Biten bir ürünü pasifleştirince hem adisyonda hem QR menüde anında görünmez olur — “86” yönetimi.' },
    ],
  },
  '/karlilik': {
    title: 'Kârlılık & Menü Mühendisliği',
    steps: [
      { title: 'Kârlılık', body: 'Her ürünün maliyeti, satış fiyatı, kârı, marjı ve food-cost yüzdesi burada. Renkler yüksek/düşük food-cost’u işaretler.' },
      { title: 'Menü mühendisliği matrisi', body: 'Ürünler popülerlik (adet) × kârlılık (marj) ile dört gruba ayrılır: Yıldız (çok satan+kârlı → öne çıkar), Bulmaca (kârlı ama az satan → tanıt), Beygir (çok satan az kârlı → maliyet düşür), Köpek (az satan+az kârlı → menüden çıkarmayı düşün).' },
      { title: 'Tarih aralığı', body: 'Üstten dönem seçerek belirli bir zaman aralığının satışına göre analiz yaparsın.' },
    ],
  },
  '/stok': {
    title: 'Stok',
    steps: [
      { title: 'Stok Kalemleri', body: 'Hammadde ve ürün stoklarını buradan takip edersin. Kritik seviyenin altına düşen kalemler uyarı verir ve bildirim ziline düşer.' },
      { title: 'Hareket ekle', body: 'Giriş (mal alımı), Fire (zayi) veya Sayım (fiziki sayımla mutlak miktar düzeltme) hareketleri girersin; stok anında güncellenir.' },
      { title: 'Reçeteler', body: '“Reçeteler” sekmesinde ürün ↔ stok ilişkisini kurarsın (ör. 1 Adana = 180g kıyma + 1 lavaş). Satış yapıldıkça stok otomatik düşer, maliyet hesaplanır.', selector: '[data-tour="stok-tabs"]' },
    ],
  },
  '/alislar': {
    title: 'Alışlar / Giderler',
    steps: [
      { title: 'Alış / Gider', body: 'Tedarikçiden aldığın malları fatura olarak girersin. Kalemler, KDV ve toplam maliyet takip edilir.' },
      { title: 'Stok & cari etkisi', body: 'Alış girildiğinde ilgili stok kalemlerine giriş yapılır; ödeme şekline göre tedarikçi carisine borç yazılabilir.' },
    ],
  },
  '/kasa': {
    title: 'Kasa',
    steps: [
      { title: 'Kasa Yönetimi', body: 'Gün başında kasayı açılış nakdiyle açar, gün boyu nakit hareketlerini izler, gün sonunda sayıp kapatırsın.' },
      { title: 'Kasa aç', body: 'Kasadaki başlangıç parasını girerek oturumu açarsın. Açık kasa yokken satışların nakit takibi yapılamaz.', selector: '[data-tour="kasa-action"]' },
      { title: 'Nakit giriş/çıkış', body: 'Kasadan çıkan (tedarikçi ödemesi, gider, para üstü) veya giren her nakti kaydedersin; beklenen nakit buna göre güncellenir.' },
      { title: 'Kapanış & fark', body: 'Gün sonunda saydığın nakti girersin; sistem beklenen nakitle farkı (açık/fazla) otomatik gösterir — kayıp kontrolü.' },
    ],
  },
  '/cari': {
    title: 'Cari Hesaplar',
    steps: [
      { title: 'Cari Hesaplar', body: 'Müşteri, tedarikçi ve personel cari hesaplarını buradan yönetirsin: borç/alacak hareketleri ve güncel bakiye.' },
      { title: 'Ekstre & tahsilat', body: 'Bir cariye tıklayınca ekstresini görür, tahsilat veya borç hareketi eklersin.' },
      { title: 'Açık hesap bağlantısı', body: 'Adisyon ödemesini “açık hesap” seçersen tutar otomatik ilgili cariye borç olarak yazılır.' },
    ],
  },
  '/belgeler': {
    title: 'Mali Belgeler',
    steps: [
      { title: 'Mali Belgeler', body: 'Kapanışta kesilen mali fişler (ÖKC) ve e-belgeler (e-Arşiv/e-Fatura) burada listelenir.' },
      { title: 'Simülasyon → gerçek', body: 'Şu an simülasyon modunda çalışıyor. Gerçek cihaz (ÖKC) veya GİB entegratörü bağlandığında aynı akış gerçek belgeleri üretir; altyapı hazır.' },
    ],
  },
  '/raporlar': {
    title: 'Gün Sonu',
    steps: [
      { title: 'Gün Sonu Panosu', body: 'Günün özeti: ciro, adisyon sayısı, iskonto, ödeme yöntemi dağılımı ve en çok satanlar.' },
      { title: 'Grafikler', body: 'Ciro trendi, saatlik yoğunluk, ödeme dağılımı ve kategori kırılımı grafiklerle gösterilir — kararlarını hızlandırır.' },
      { title: 'Dışa aktar', body: 'Raporu CSV (Excel) veya PDF olarak indirebilirsin.' },
    ],
  },
  '/musteriler': {
    title: 'Müşteriler (CRM)',
    steps: [
      { title: 'Müşteri Veritabanı', body: 'Müdavimlerini burada tutarsın: ad, telefon, doğum günü, tercih/not, ziyaret geçmişi ve toplam harcama.' },
      { title: 'Ara & seç', body: 'Ad veya telefonla hızlı arar, bir müşteriye tıklayınca detayını (harcama grafiği, ziyaretler) görürsün. 5+ ziyaret yapana “VIP” rozeti çıkar.', selector: '[data-tour="crm-search"]' },
      { title: 'Yeni müşteri', body: 'Bu butonla yeni müşteri eklersin. Adisyon ödeme ekranından da telefonla anında müşteri bağlayabilirsin.', selector: '[data-tour="crm-add"]' },
      { title: 'Sadakat & doğum günü', body: 'Harcamaya göre puan birikir; puanla indirim uygulanır. Yan panelde bu ay doğum günü olanları ve en çok harcayanları görürsün — kampanya fırsatı.' },
    ],
  },
  '/personel': {
    title: 'Personel',
    steps: [
      { title: 'Personel', body: 'Vardiya planlaması ve garson performansı burada.' },
      { title: 'Vardiya Planı', body: 'Haftalık vardiyaları güne tıklayarak eklersin; her personelin haftalık toplam saati hesaplanır.', selector: '[data-tour="personel-tabs"]' },
      { title: 'Programı yazdır', body: 'Haftalık programı panoya asmak için tek tıkla yazdırabilirsin (personel × gün tablosu).' },
      { title: 'Performans', body: '“Performans” sekmesinde tarih aralığı seçip garson bazlı ciro, adisyon, ortalama adisyon ve bahşiş sıralamasını (🥇🥈🥉) görürsün.' },
    ],
  },
  '/rezervasyonlar': {
    title: 'Rezervasyonlar',
    steps: [
      { title: 'Rezervasyonlar', body: 'Gelecek rezervasyonları müşteri adı, masa, kişi sayısı ve saatle kaydedersin.' },
      { title: 'Salon & bildirim', body: 'Rezerveli masalar salon planında kırmızı görünüp saat+isim gösterir. Yaklaşan rezervasyonlar bildirim ziline düşer.' },
    ],
  },
  '/geribildirim': {
    title: 'Geri Bildirim & Yorumlar',
    steps: [
      { title: 'Geri Bildirimler', body: 'QR üzerinden müşterinin bıraktığı puan ve yorumlar burada toplanır: ortalama puan ve dağılım grafiği.' },
      { title: 'Google yorumları', body: 'Google puanın, toplam yorum ve son yorumlar burada. Düşük puanlılar (≤2★) kırmızı vurguyla öne çıkar; yeni yorum geldiğinde bildirim düşer. “Yenile” ile elle güncellersin.' },
      { title: 'Yapay zeka özeti', body: 'Bu butonla AI, tüm yorumları analiz edip memnuniyetleri, şikayetleri ve somut iyileştirme önerilerini özetler.', selector: '[data-tour="ai-summary"]' },
    ],
  },
  '/ongoruler': {
    title: 'Öngörüler & Asistan',
    steps: [
      { title: 'Öngörüler', body: 'Local (ücretsiz) analitik motoru: son 8 haftaya bakarak öneriler ve tahminler üretir. İnternet/abonelik gerekmez.' },
      { title: 'Akıllı öneriler', body: 'Ölü saat → happy-hour önerisi, menüde Yıldız/Köpek ürünler, kritik stok ve olağandışı iptal/ikram (anomali) uyarıları kart olarak çıkar.', selector: '[data-tour="insights-suggestions"]' },
      { title: 'Tahmin & ısı haritası', body: 'Önümüzdeki 7 günün ciro tahmini ve gün×saat yoğunluk ısı haritası — çalışma saatlerine göre. (Saatleri Ayarlar’dan gir.)' },
      { title: 'Yapay Zeka Desteği', body: 'Aşağıdaki sohbet kutusuna doğal dille soru sorarsın (“bu ay en kârlı ürün?”). Tamamen local çalışır (Ollama). Bağlı değilse öneriler yine çalışır.', selector: '[data-tour="ai-support"]' },
    ],
  },
  '/denetim': {
    title: 'Denetim',
    steps: [
      { title: 'Denetim Kayıtları', body: 'Kayba yol açabilecek işlemler burada: adisyon/kalem iptali, iskonto ve ikram — kim, ne zaman, ne kadar.' },
      { title: 'Personel kırılımı', body: 'Kişi bazında iptal/iskonto/ikram toplamlarını görür, olağandışı davranışı (suistimal) erken yakalarsın.' },
    ],
  },
  '/kullanicilar': {
    title: 'Kullanıcılar & Roller',
    steps: [
      { title: 'Kullanıcı Yönetimi', body: 'Personel hesaplarını ekler, düzenler ve pasifleştirirsin.' },
      { title: 'Roller', body: 'Her kullanıcıya rol verirsin: Patron, Müdür, Kasiyer, Garson, Mutfak. Rol, kimin hangi ekranı görüp hangi işlemi yapabileceğini belirler (ör. garson iskonto yapamaz, mutfak yalnız mutfağı görür).' },
    ],
  },
  '/ayarlar': {
    title: 'İşletme Ayarları',
    steps: [
      { title: 'İşletme Ayarları', body: 'İşletme adı, iletişim bilgileri, çalışma saatleri ve serbest işletme notunu buradan girersin.' },
      { title: 'Çalışma saatleri', body: 'Açılış-kapanış saatleri ve açık günleri belirle. Öngörü motoru bunları dikkate alır — örneğin kapalı olduğun saatleri “ölü saat” saymaz.', selector: '[data-tour="ayarlar-hours"]' },
      { title: 'İşletme notu = AI bağlamı', body: 'Not alanına konseptini yazarsan (ör. “aile restoranı, akşam à la carte”), yapay zeka önerilerinde bu bilgiyi kullanır.' },
    ],
  },
  '/veri': {
    title: 'Veri İçe Aktarma',
    steps: [
      { title: 'Veri İçe Aktarma', body: 'Geçmiş verilerini CSV dosyasıyla toplu yükleyip sisteme işlersin.' },
      { title: 'Tür seç', body: 'Dört tür var: Geçmiş Satışlar, Ürünler, Müşteriler, Stok. Her türün beklenen sütunları ekranda örnekle gösterilir.', selector: '[data-tour="veri-types"]' },
      { title: 'Neden faydalı?', body: 'Özellikle geçmiş satışları yüklersen tahmin ve analizler gerçek geçmişe dayanır — sistem çok daha isabetli çalışır.' },
      { title: 'Yükle & içe aktar', body: 'CSV seç, önizle, “İçe Aktar” de. Sonuçta eklenen/atlanan/hatalı satır sayısını görürsün; tekrar edenler otomatik atlanır.', selector: '[data-tour="veri-upload"]' },
    ],
  },
};

// Verilen pathname için en uygun turu bulur (en uzun önek eşleşmesi).
export function tourFor(pathname: string): Tour | null {
  let best: { key: string; tour: Tour } | null = null;
  for (const [key, tour] of Object.entries(TOURS)) {
    if (pathname === key || pathname.startsWith(key + '/') || pathname.startsWith(key)) {
      if (!best || key.length > best.key.length) best = { key, tour };
    }
  }
  return best?.tour ?? null;
}
