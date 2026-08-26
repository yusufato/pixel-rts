/* ═══════════════════════════════════════════════════════════════════════════
   MOCKUP VERİSİ  —  OYUNA TAŞINMAZ
   ═══════════════════════════════════════════════════════════════════════════
   Kural: yer tutucu ("Lorem", "Birim A", "Ülke 1") YASAK. Sayılar ve adlar
   gerçek veri dosyalarından kopyalanmıştır; yerleşim kararı sahte veriyle
   verilirse gerçek metin uzunluğunda kırpma yaşanır.

   Kaynaklar:
     js/units-modern.json      → 26 birim (ad, maliyet, hp, zırh, hız, menzil, hasar)
     js/Story.js:18-26         → 8 devlet (ad + renk)
     js/Story.js:36-71         → 36 ülke düğümü
     js/main.js:374-398        → ABILITY_META (5 aktif + 16 pasif)
     js/main.js:474-482        → SPAWN_CATEGORIES (7 kategori)
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
    'use strict';

    /* js/units-modern.json'dan birebir — sütun sırası: id, ad, kategori, maliyet,
       hp, zırh, hız, menzil, hasar, sprite sütunu */
    var BIRIMLER = [
        { id: 'infantry',       ad: 'Piyade',                  kat: 'inf',     mal: 100,  hp: 220, zirh: 0, hiz: 1.0, mnz: 4,  has: 14,  sp: 0 },
        { id: 'at_team',        ad: 'Tanksavar Timi',          kat: 'inf',     mal: 170,  hp: 160, zirh: 0, hiz: 0.9, mnz: 7,  has: 300, sp: 1 },
        { id: 'mortar_team',    ad: 'Havan Timi',              kat: 'inf',     mal: 180,  hp: 150, zirh: 0, hiz: 0.7, mnz: 12, has: 40,  sp: 2 },
        { id: 'manpads_team',   ad: 'MANPADS Timi',            kat: 'inf',     mal: 190,  hp: 150, zirh: 0, hiz: 0.9, mnz: 11, has: 190, sp: 3 },
        { id: 'commando',       ad: 'Komando',                 kat: 'inf',     mal: 320,  hp: 260, zirh: 1, hiz: 1.3, mnz: 5,  has: 22,  sp: 4 },
        { id: 'mbt',            ad: 'Tank',                    kat: 'armor',   mal: 500,  hp: 900, zirh: 8, hiz: 1.6, mnz: 6,  has: 150, sp: 5 },
        { id: 'ifv',            ad: 'Mekanize Piyade (ZMA)',   kat: 'armor',   mal: 320,  hp: 480, zirh: 4, hiz: 2.2, mnz: 5,  has: 26,  sp: 6 },
        { id: 'tank_destroyer', ad: 'Tank Avcısı',             kat: 'armor',   mal: 420,  hp: 520, zirh: 6, hiz: 2.0, mnz: 9,  has: 290, sp: 7 },
        { id: 'artillery',      ad: 'Topçu',                   kat: 'arty',    mal: 450,  hp: 280, zirh: 1, hiz: 1.1, mnz: 20, has: 95,  sp: 8 },
        { id: 'mlrs',           ad: 'ÇNRA',                    kat: 'arty',    mal: 650,  hp: 260, zirh: 1, hiz: 1.4, mnz: 26, has: 55,  sp: 9 },
        { id: 'spaag',          ad: 'SPAAG',                   kat: 'aa',      mal: 300,  hp: 380, zirh: 3, hiz: 1.8, mnz: 13, has: 34,  sp: 12 },
        { id: 'sam_battery',    ad: 'SAM Bataryası',           kat: 'aa',      mal: 700,  hp: 320, zirh: 2, hiz: 1.0, mnz: 22, has: 255, sp: 13 },
        { id: 'attack_helo',    ad: 'Taarruz Helikopteri',     kat: 'air',     mal: 800,  hp: 330, zirh: 3, hiz: 4.5, mnz: 12, has: 200, sp: 14 },
        { id: 'armed_uav',      ad: 'SİHA',                    kat: 'air',     mal: 550,  hp: 180, zirh: 0, hiz: 2.6, mnz: 12, has: 240, sp: 17 },
        { id: 'scout_vehicle',  ad: 'Keşif Aracı',             kat: 'recon',   mal: 180,  hp: 220, zirh: 2, hiz: 3.2, mnz: 3,  has: 12,  sp: 19 },
        { id: 'engineer',       ad: 'İstihkam',                kat: 'support', mal: 200,  hp: 240, zirh: 1, hiz: 0.9, mnz: 3,  has: 10,  sp: 22 },
        { id: 'medic',          ad: 'Sağlıkçı',                kat: 'support', mal: 160,  hp: 180, zirh: 0, hiz: 1.0, mnz: 0,  has: 0,   sp: 21 },
        { id: 'supply_truck',   ad: 'İkmal Aracı',             kat: 'support', mal: 250,  hp: 340, zirh: 1, hiz: 1.8, mnz: 0,  has: 0,   sp: 23 },
        { id: 'drone_operator', ad: 'Drone Operatörü',         kat: 'air',     mal: 240,  hp: 160, zirh: 2, hiz: 1.6, mnz: 0,  has: 0,   sp: 18 }
    ];

    /* js/main.js:474-482 */
    var KATEGORILER = [
        { id: 'inf',     ad: '👣 Piyade' },
        { id: 'armor',   ad: '🛡️ Zırhlı' },
        { id: 'arty',    ad: '💥 Dolaylı' },
        { id: 'aa',      ad: '🎯 Hava-Sav.' },
        { id: 'air',     ad: '✈️ Hava' },
        { id: 'recon',   ad: '📡 Keşif/EH' },
        { id: 'support', ad: '🚑 Destek' }
    ];

    /* js/main.js:374-398 — ABILITY_META özeti. `hedefli` olanlar haritaya
       ikinci bir tık ister; `oto` olanlar pasiftir (çip olarak gösterilir). */
    var YETENEKLER = {
        aktif: [
            { id: 'lay_mines',     ad: 'MAYIN DÖŞE',  tus: 'M', hedefli: true,  ac: 'Seçilen noktaya mayın tarlası kurar' },
            { id: 'dig_in',        ad: 'SİPER KAZ',   tus: 'T', hedefli: false, ac: 'Bulunduğu yerde siper açar (r 130)' },
            { id: 'field_hospital',ad: 'HASTANE KUR', tus: '',  hedefli: true,  ac: 'Sahra hastanesi (r 165)' },
            { id: 'unload',        ad: 'İNDİR',       tus: 'U', hedefli: true,  ac: 'Taşınan piyadeyi indirir' },
            { id: 'launch_drone',  ad: 'DRONE SAL',   tus: '',  hedefli: true,  ac: 'Operatör 2 drone salar' }
        ],
        pasif: ['garrison', 'ambush', 'hold_fire', 'overrun', 'shoot_and_scoot', 'spot_for_artillery']
    };

    /* js/Story.js:18-26 */
    var DEVLETLER = [
        { ad: 'Türk Cumhuriyeti',   renk: '#4cff7c', oyuncu: true },
        { ad: 'İber Federasyonu',   renk: '#ff8a3c' },
        { ad: 'Britanya Topluluğu', renk: '#e34c4c' },
        { ad: 'Cermen Federasyonu', renk: '#e0d24c' },
        { ad: 'Kuzey Paktı',        renk: '#4cc8ff' },
        { ad: 'Slav Federasyonu',   renk: '#b07cff' },
        { ad: 'Mağrip Konseyi',     renk: '#d98cc0' },
        { ad: 'Levant Birliği',     renk: '#ffd24c' }
    ];

    /* js/StoryUI.js:82-198 mantığındaki severity kategorileri ile birebir. */
    var GUNDEM = [
        { sev: 'critical', bas: 'İzmir tersanesinde grev 4. gününde',
          ac: 'Üretim kuyruğu durdu; 2 fırkatın teslimi 11 gün gecikiyor.',
          panel: 'EKONOMİ ▸ FRAKSİYONLAR', aktor: 'Deniz Arıkan · Liman İşçileri Sendikası' },
        { sev: 'critical', bas: 'Cermen Federasyonu tahıl koridorunu kapattı',
          ac: 'Buğday ithalatının %38\'i kesildi; enflasyon 15.2 → 18.7 bekleniyor.',
          panel: 'SOHBET ▸ DİPLOMASİ', aktor: 'Kanzler Reinhardt Vogel' },
        { sev: 'high', bas: 'Refah 41 (eşik 45)',
          ac: 'İki bölgede sadakat düşüşü başladı.',
          panel: 'EKONOMİ ▸ BÜTÇE', aktor: '—' },
        { sev: 'high', bas: 'Konya\'da yolsuzluk soruşturması açıldı',
          ac: 'Vali hakkında ihale iddiası; makam boşalırsa garnizon komutası askıya alınır.',
          panel: 'KONSEY ▸ YÖNETİM', aktor: 'Müfettiş Selma Doğan' },
        { sev: 'watch', bas: 'Süresi dolan görüşme: 2',
          ac: 'Yanıtlanmazsa muhatap kendi kararını verir.',
          panel: 'SOHBET ▸ SOHBET', aktor: 'Gen. Kurt · Alb. Yenal' },
        { sev: 'stable', bas: 'Ankara AR-GE: Faz 2 tamamlandı',
          ac: 'Termal görüş yükseltmesi ordu geneline açıldı.',
          panel: 'AR-GE', aktor: '—' }
    ];

    /* KUSUR 16 kanıtı: js/Story.js:124 son 6 kaydı tutuyor. Aşağıda 14 kayıt var;
       oyuncu bugün bunların yalnız son 6'sını görebiliyor. */
    var AKIS = [
        { t: '2034-03-11', s: 'Cermen Federasyonu tahıl koridorunu kapattı', yeni: true },
        { t: '2034-03-09', s: 'İzmir tersanesinde grev başladı', yeni: true },
        { t: '2034-03-08', s: 'Konya valisi hakkında soruşturma açıldı', yeni: true },
        { t: '2034-03-05', s: 'Slav Federasyonu ile ateşkes 90 gün uzatıldı', yeni: true },
        { t: '2034-03-02', s: 'Bursa\'da 2 mekanize tabur teslim alındı', yeni: true },
        { t: '2034-02-27', s: 'Enflasyon %13.4 → %15.2', yeni: true },
        { t: '2034-02-24', s: 'Britanya Topluluğu Kıbrıs üssünü tahkim etti', yeni: false },
        { t: '2034-02-19', s: 'Adana AR-GE: termal görüş Faz 1 bitti', yeni: false },
        { t: '2034-02-15', s: 'Levant Birliği ticaret anlaşması imzalandı', yeni: false },
        { t: '2034-02-11', s: 'Trabzon limanı genişletme kredisi onaylandı', yeni: false },
        { t: '2034-02-06', s: 'Mağrip Konseyi elçisi geri çağrıldı', yeni: false },
        { t: '2034-01-30', s: 'Kuzey Paktı tatbikatı Baltık\'ta başladı', yeni: false },
        { t: '2034-01-22', s: 'Eskişehir fabrikası özelleştirme oylaması reddedildi', yeni: false },
        { t: '2034-01-14', s: 'Konsey toplantısı: seferberlik kanunu kabul edildi', yeni: false }
    ];

    /* js/WarRoomUI.js:356 muharebe kaydı — max 8 satır (WAR_ROOM_BATTLE_FEED) */
    var MUHAREBE_KAYDI = [
        { t: '04:12', tip: 'friendly', s: 'Tank #3 → düşman ZMA imha' },
        { t: '04:09', tip: 'hostile',  s: 'Topçu #1 karşı-batarya ateşinde kayıp' },
        { t: '04:03', tip: 'friendly', s: 'SAM Bataryası → Taarruz Helikopteri düşürüldü' },
        { t: '03:58', tip: 'order',    s: 'EMİR: TAARRUZ — Schwerpunkt kuzey sektörü' },
        { t: '03:51', tip: 'hostile',  s: 'Piyade #7 baskı altında geri çekiliyor' },
        { t: '03:44', tip: 'friendly', s: 'Keşif Aracı → düşman ÇNRA tespit edildi' },
        { t: '03:30', tip: 'order',    s: 'EMİR: SİPER KAZ — merkez hattı' },
        { t: '03:22', tip: 'friendly', s: 'İkmal Aracı → 4 birime mühimmat ikmali' }
    ];

    /* js/Talks.js — görüşme çalışma alanı örneği. */
    var GORUSME = {
        katilimcilar: [
            { ad: 'Kanzler Reinhardt Vogel', rol: 'Cermen Federasyonu · Devlet Başkanı',
              guven: 'DOĞRULANDI', iliski: -22, renk: '#e0d24c' },
            { ad: 'Elçi Marta Köhler', rol: 'Cermen Federasyonu · Ticaret Ataşesi',
              guven: 'DOĞRULANDI', iliski: 8, renk: '#e0d24c' },
            { ad: 'Bilinmeyen katılımcı', rol: 'KİMLİK DOĞRULANMADI',
              guven: 'BİLİNMİYOR', iliski: null, renk: '#6e6330' }
        ],
        transkript: [
            { kim: 'Vogel', s: 'Koridoru kapatmak istemedim. Ama Ruhr\'daki fabrikalar üç aydır tahılın fiyatını ödüyor ve meclisim bana kredi vermiyor.' },
            { kim: 'SEN',   s: 'Koridor kapalı kaldıkça benim enflasyonum sizin meclisinizin sorunu olmaya başlar.' },
            { kim: 'Vogel', s: 'Bunu tehdit saymıyorum, tespit sayıyorum. Karşılığında ne veriyorsun?' },
            { kim: 'Köhler',s: 'Somut olalım: Trabzon üzerinden altı aylık sabit fiyatlı bir kontrat konuşulabilir.' }
        ],
        secenekler: [
            { et: 'Trabzon kontratını teklif et', mal: '6 ay sabit fiyat · bütçe −340/ay', risk: 'düşük' },
            { et: 'Koridor kapalı kalırsa boğaz geçiş ücretini iki katına çıkaracağımı söyle', mal: 'ilişki −15', risk: 'yüksek' },
            { et: 'Slav Federasyonu ile alternatif hat konuştuğumu ima et', mal: 'blöf · ifşa olursa güvenilirlik −20', risk: 'orta' },
            { et: 'Kendi cümlemi yazacağım', mal: '', risk: '' }
        ],
        /* KUSUR 20: bu zincir bugün HİÇBİR yerde tek parça görünmüyor. */
        iliskiZinciri: [
            { t: '2033-08', tip: 'söz',     s: 'Vogel: "Koridoru tek taraflı kapatmam."', durum: 'BOZULDU' },
            { t: '2033-11', tip: 'anlaşma', s: 'Karşılıklı gümrük indirimi %4', durum: 'YÜRÜRLÜKTE' },
            { t: '2034-01', tip: 'borç',    s: 'Sen: Kıbrıs oylamasında çekimser kaldın (Vogel talebi)', durum: 'ALACAKLISIN' },
            { t: '2034-03', tip: 'eylem',   s: 'Vogel koridoru kapattı', durum: 'AÇIK' }
        ],
        /* KUSUR 21: geçmiş sütununda arama/filtre yok; oturum sayısı artınca dip. */
        gecmis: [
            { t: '2034-03-11', kim: 'Vogel',   ozet: 'Tahıl koridoru — sürüyor', aktif: true },
            { t: '2034-03-04', kim: 'Vogel',   ozet: 'Kıbrıs oylaması pazarlığı' },
            { t: '2034-02-26', kim: 'Köhler',  ozet: 'Gümrük indirimi teknik ekleri' },
            { t: '2034-02-14', kim: 'Vogel',   ozet: 'Ateşkes uzatma sondajı' },
            { t: '2034-01-30', kim: 'Yenal',   ozet: 'Doğu cephesi ikmal şikâyeti' },
            { t: '2034-01-18', kim: 'Arıkan',  ozet: 'Tersane grev uyarısı' },
            { t: '2033-12-22', kim: 'Köhler',  ozet: 'İlk temas — ticaret ataşesi tanıtımı' }
        ]
    };

    /* js/Character.js:549 — 12 soruluk komutan dosyası. */
    var KARAKTER = {
        adim: 5, toplam: 12,
        soru: 'Bir bölge valisi emrini geciktirdi ve gerekçesini sonradan bildirdi. Ne yaparsın?',
        secenekler: [
            'Görevden alırım; gecikme gerekçesi sonuçtan sonra gelmez.',
            'Gerekçeyi soruşturmaya alırım, kararı soruşturma sonrası veririm.',
            'Yerinde bırakırım ama yetkilerini daraltırım.',
            'Kendisiyle yüz yüze konuşurum, karar vermeden önce dinlerim.'
        ],
        verilmis: [
            { n: 1, s: 'Kariyer başlangıcı', c: 'Kara Harp Okulu' },
            { n: 2, s: 'İlk komuta',        c: 'Mekanize tabur' },
            { n: 3, s: 'Öne çıkan yön',     c: 'Lojistik' },
            { n: 4, s: 'Siyasi bağ',        c: 'Bağımsız' }
        ]
    };

    global.FIX = {
        BIRIMLER: BIRIMLER,
        KATEGORILER: KATEGORILER,
        YETENEKLER: YETENEKLER,
        DEVLETLER: DEVLETLER,
        GUNDEM: GUNDEM,
        AKIS: AKIS,
        MUHAREBE_KAYDI: MUHAREBE_KAYDI,
        GORUSME: GORUSME,
        KARAKTER: KARAKTER,
        birim: function (id) {
            return BIRIMLER.filter(function (b) { return b.id === id; })[0];
        },
        /* icons.png: 8780×730, hücre 320×320, pad 30, 25 sütun (js/globals.js:333).
           CSS background ile: background-size: 2500% 200% (style.css:1861). */
        spriteStil: function (sutun, kirmizi) {
            return 'background-image:url(\'../icons.png\');background-size:2500% 200%;' +
                   'background-repeat:no-repeat;image-rendering:pixelated;' +
                   'background-position:' + (sutun * (100 / 24)) + '% ' + (kirmizi ? '100%' : '0%') + ';';
        }
    };
})(window);
