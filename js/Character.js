// ═══════════════════════════════════════════════════════════════════════════
//  KARAKTER SİSTEMİ — yaratma ekranı + kişilik motoru (PLAN AŞAMA 1)
//  ---------------------------------------------------------------------------
//  İki iş yapar:
//   1) Harekât kurulumundan sonra KARAKTER EKRANI: isim + 3 yetenek zarı (1-6,
//      sınırsız yeniden atma) + 12 UYARLANIR soru. Sorular A/B/C temalı (HARP/
//      İDARE/SİYASET — komutan ağacının 3 dalıyla hizalı) ve bir sonraki soru
//      ÖNCEKİ CEVABIN ETİKETİNE göre gelir. Yazım modeli tema başına
//      1 kök + 4+4+4 takip = 39 soru; sonuç uzayı 4^12 ≈ 16.7M kombinasyon.
//   2) KİŞİLİK MOTORU: 4 ideolojik eksen (0-100) yalnız oyuncuya değil TÜM
//      komutanlara ve her devletin CUMHURBAŞKANINA atanır. AI devletin doktrini
//      liderinden türer — lider değişince devletin karakteri değişir.
//
//  ZAR DENGESİ: sınırsız yeniden atma "6/6/6 gelene kadar bas" istismarına açık
//  olurdu. Denkleştirme: başlangıç Liyakat Puanı = 21 − zar toplamı (taban 3).
//  Düşük zar = güçlü gelişim bütçesi; her atış oynanabilir, bekleme istismarı ölür.
// ═══════════════════════════════════════════════════════════════════════════

// ── 4 İDEOLOJİK EKSEN (0-100, 50 = merkez) ─────────────────────────────────
//  hawk: Güvercin(0) ↔ Şahin(100)      auth: Özgürlükçü(0) ↔ Otoriter(100)
//  pop : Teknokrat(0) ↔ Halkçı(100)    nat : Küreselci(0) ↔ Milliyetçi(100)
const CHAR_AXES = [
    { k: 'hawk', lo: 'Güvercin', hi: 'Şahin',      icon: '⚔️' },
    { k: 'auth', lo: 'Özgürlükçü', hi: 'Otoriter', icon: '🏛️' },
    { k: 'pop',  lo: 'Teknokrat', hi: 'Halkçı',    icon: '📣' },
    { k: 'nat',  lo: 'Küreselci', hi: 'Milliyetçi', icon: '🏴' },
];
function charAxesDefault() { return { hawk: 50, auth: 50, pop: 50, nat: 50 }; }
function charClampAxes(a) { for (const x of CHAR_AXES) a[x.k] = Math.max(0, Math.min(100, Math.round(a[x.k] ?? 50))); return a; }

// Kişilikten eksen üret (AI komutan/cumhurbaşkanları). Serpinti ±12: aynı
// kişilikte iki komutan aynı adam değildir.
const CHAR_PERSONA_AXES = {
    dengeli:     { hawk: 50, auth: 50, pop: 50, nat: 50 },
    agresif:     { hawk: 74, auth: 60, pop: 46, nat: 62 },
    'savunmacı': { hawk: 30, auth: 46, pop: 56, nat: 56 },
    'fırsatçı':  { hawk: 56, auth: 60, pop: 36, nat: 40 },
    oyuncu:      { hawk: 50, auth: 50, pop: 50, nat: 50 },
};
function charAxesFor(persona) {
    const b = CHAR_PERSONA_AXES[persona] || CHAR_PERSONA_AXES.dengeli;
    const j = () => (storyRandom('character') * 24 - 12);
    return charClampAxes({ hawk: b.hawk + j(), auth: b.auth + j(), pop: b.pop + j(), nat: b.nat + j() });
}

// ── ARKETİP — baskın eksen kombinasyonundan unvan ──────────────────────────
// Taslaktaki 4 profil + merkez. Sıra önemli: ilk eşleşen kazanır.
function charArchetype(a) {
    if (!a) return { id: 'denge', name: 'Pragmatist', icon: '⚖️' };
    if (a.auth >= 62 && a.hawk >= 55) return { id: 'demir',   name: 'Demir Yumruk',    icon: '🛡️' };
    if (a.pop >= 62 && a.auth < 60)   return { id: 'halk',    name: 'Halkın Adamı',    icon: '📣' };
    if (a.pop <= 40 && a.auth >= 50)  return { id: 'golge',   name: 'Gölge Teknokrat', icon: '🕶️' };
    if (a.nat <= 42 && a.pop <= 55)   return { id: 'oligark', name: 'Oligark Dostu',   icon: '🏦' };
    return { id: 'denge', name: 'Pragmatist', icon: '⚖️' };
}

// ── ZAR ────────────────────────────────────────────────────────────────────
function charRollDie() { return 1 + storyRandomInt('character', 6); }
function charRollDice() { return { warrior: charRollDie(), diplomat: charRollDie(), economist: charRollDie() }; }
function charLpBonus(d) { return Math.max(3, 21 - (d.warrior + d.diplomat + d.economist)); }

// ── YOL AYRIMLARI — 12 uyarlanır soru ──────────────────────────────────────
// Yapı: tema → { root, s2:{tag:soru}, s3:{tag:soru}, s4:{tag:soru} }.
// N+1'inci soru N'inci cevabın TAG'ine göre seçilir → oyuncu kendi seçiminin
// devamını yaşar ("madem gazeteciyi tutuklattın, şimdi yabancı ajanslar soruyor").
// Etiketler: sert(şahin/otoriter) · kurnaz(gölge/fırsatçı) · halkci(popülist) · uzman(teknokrat)
// fx: eksen deltaları; seed: yalnız 4. aşamada — kalıcı geçmiş etiketi (AŞAMA 7 hafızasına doğar).
const CHARQ = {
    harp: {
        root: { q: 'Sınır karakolun kimliği belirsiz İHA\'larla vuruldu; 12 asker yaralı. Uydu izleri komşuyu gösteriyor ama kanıt kesin değil. İlk emrin?', o: [
            { t: 'Kaynağına anında misilleme — kanıtı sahada buluruz.', tag: 'sert',   fx: { hawk: 8, auth: 2 } },
            { t: 'Sessiz kal; sızma timiyle kanıtı çalıp koz yap.',      tag: 'kurnaz', fx: { hawk: 2, auth: 3, pop: -2 } },
            { t: 'Yaralıları basının önünde ziyaret et, dünyayı tanık tut.', tag: 'halkci', fx: { pop: 7, hawk: -2 } },
            { t: 'Hava savunmayı taşı, telemetriyi çözdür, raporla karar ver.', tag: 'uzman', fx: { hawk: -3, pop: -4 } },
        ]},
        s2: {
            sert: { q: 'Misillemen komşunun radar üssünü kül etti; BM acil oturum çağırdı. Tavrın?', o: [
                { t: 'Bir daha vururlarsa iki katı — bunu açıkça söyle.', tag: 'sert', fx: { hawk: 7, auth: 3 } },
                { t: 'Operasyonu inkâr et; kanıtları karart.',            tag: 'kurnaz', fx: { auth: 5, pop: -3 } },
                { t: 'Meydana çık: "Evlatlarımızı koruduk."',             tag: 'halkci', fx: { pop: 6, nat: 4 } },
                { t: 'Hukuk ekibiyle meşru müdafaa dosyası sun.',         tag: 'uzman', fx: { pop: -3, hawk: -3 } },
            ]},
            kurnaz: { q: 'Sızma timin operatör kayıtlarını getirdi — ama imza komşunun değil, özel bir ŞİRKETİN. Ne yaparsın?', o: [
                { t: 'Şirketin sahadaki tesisini vur.',                    tag: 'sert', fx: { hawk: 8 } },
                { t: 'Şirketle gizlice anlaş: artık bize çalışsınlar.',    tag: 'kurnaz', fx: { auth: 3, nat: -4 } },
                { t: 'Kayıtları yayınla, dünya kamuoyunu ayağa kaldır.',   tag: 'halkci', fx: { pop: 6 } },
                { t: 'Kayıtları müttefik istihbaratlarla doğrulat.',       tag: 'uzman', fx: { hawk: -2, pop: -3, nat: -3 } },
            ]},
            halkci: { q: 'Ziyaretin viral oldu; halk "cevap ver" diye meydanda. Gerilimi sen büyüttün. Şimdi?', o: [
                { t: 'Halkın sesi emirdir — sınıra yığınak.',              tag: 'sert', fx: { hawk: 7, pop: 3 } },
                { t: 'Öfkeyi içeri çevir: kritik bütçeyi bu havada geçir.', tag: 'kurnaz', fx: { auth: 4, pop: -2 } },
                { t: 'Sükûnet çağrısı yap ama aileleri sahiplen.',         tag: 'halkci', fx: { pop: 5, hawk: -3 } },
                { t: 'Kamuoyunu veriyle soğut: gerçek risk tablosunu aç.', tag: 'uzman', fx: { pop: -4 } },
            ]},
            uzman: { q: 'Telemetri çözüldü: saldırı komşudan değil, TAŞERON bir milis ağından. Rapor masanda. Kararın?', o: [
                { t: 'Milis kamplarına kapsamlı harekât.',                 tag: 'sert', fx: { hawk: 7 } },
                { t: 'Ağı satın al — bizim taşeronumuz olsunlar.',         tag: 'kurnaz', fx: { auth: 4, nat: -3 } },
                { t: 'Raporu açıkla; komşuyla ortak tatbikat öner.',       tag: 'halkci', fx: { pop: 4, hawk: -4 } },
                { t: 'Sessizce iz sür; ağın finansörünü bul.',             tag: 'uzman', fx: { pop: -3, auth: 2 } },
            ]},
        },
        s3: {
            sert: { q: 'Tırmanma orduyu yordu: mühimmat stoku %40\'a düştü, genelkurmay ikiye bölündü. Sen?', o: [
                { t: 'Zafer stoktan ucuzdur — devam.',                     tag: 'sert', fx: { hawk: 6 } },
                { t: 'Ambargodaki bir ülkeden gizlice mühimmat al.',       tag: 'kurnaz', fx: { nat: -4, auth: 3 } },
                { t: 'Seferberlik çağrısı: "Millet ordusuna sahip çıkar."', tag: 'halkci', fx: { pop: 5, nat: 4 } },
                { t: 'Üretimi savaş düzenine çevir, tempoyu düşür.',       tag: 'uzman', fx: { pop: -2, hawk: -3 } },
            ]},
            kurnaz: { q: 'Gizli kanalların basına sızdı: "Perde arkası anlaşmalar" manşeti. Ne yaparsın?', o: [
                { t: 'Sızdıranı bul, askeri mahkemeye ver.',               tag: 'sert', fx: { auth: 7 } },
                { t: 'Karşı-sızıntı: rakibin daha kirli dosyasını servis et.', tag: 'kurnaz', fx: { auth: 4, pop: -3 } },
                { t: 'Kabul et: "Evet, savaşı önlemek için konuştum."',    tag: 'halkci', fx: { pop: 6, hawk: -3 } },
                { t: 'Yorum yok; sonuçlar konuşsun.',                      tag: 'uzman', fx: { pop: -4, auth: 2 } },
            ]},
            halkci: { q: 'Mitinginde bir grup "savaş istemiyoruz" pankartı açtı; yandaşların susturmaya kalktı. Anlık kararın?', o: [
                { t: 'Provokatörleri gözaltına aldır.',                    tag: 'sert', fx: { auth: 7, pop: -2 } },
                { t: 'Pankartçıları sahneye çağır — kucaklaşma karesi ver.', tag: 'kurnaz', fx: { pop: 4, auth: -2 } },
                { t: 'Susturma: "Bu meydan herkesin."',                    tag: 'halkci', fx: { pop: 6, auth: -5 } },
                { t: 'Mitingi kısa kes, güvenlik raporu iste.',            tag: 'uzman', fx: { pop: -3, auth: 3 } },
            ]},
            uzman: { q: 'Savaş oyunu sonucu masanda: çatışma uzarsa kazanma ihtimali %31. Bu raporu kim görecek?', o: [
                { t: 'Kimse. Moral bozan rapor rafa.',                     tag: 'sert', fx: { auth: 6, pop: -2 } },
                { t: 'Yalnız müttefik pazarlığında, koz olarak.',          tag: 'kurnaz', fx: { auth: 3, nat: -2 } },
                { t: 'Meclis ve halkla paylaş; kararı birlikte verelim.',  tag: 'halkci', fx: { pop: 6, auth: -4 } },
                { t: 'Varsayımları sorgulat; bağımsız ikinci analiz iste.', tag: 'uzman', fx: { pop: -3 } },
            ]},
        },
        s4: {
            sert: { q: 'Ateşkes masası kuruldu; karşı taraf tazminat istiyor. Son sözün?', o: [
                { t: 'Tazminat yok; gerekirse masayı devirin.',            tag: 'sert', fx: { hawk: 6 }, seed: 'masayı deviren' },
                { t: 'Kabul et ama gizli maddeyle geri kazan.',            tag: 'kurnaz', fx: { auth: 3 }, seed: 'gizli protokolcü' },
                { t: 'Tazminat yerine ortak yeniden inşa fonu öner.',      tag: 'halkci', fx: { pop: 5 }, seed: 'yeniden inşa mimarı' },
                { t: 'Rakamı takvime yay, faize boğ, kabul ettir.',        tag: 'uzman', fx: { pop: -2 }, seed: 'masada hesap kazanan' },
            ]},
            kurnaz: { q: 'Kriz bitti; ama elinde toplanan gizli dosyalar duruyor. Ne yapacaksın?', o: [
                { t: 'Operasyonel plana çevir — bir dahaki sefere.',       tag: 'sert', fx: { hawk: 5 }, seed: 'dosyaları bileyen' },
                { t: 'Kasaya. Gün gelir, kapı açar.',                      tag: 'kurnaz', fx: { auth: 4 }, seed: 'kasa sahibi' },
                { t: 'Yak. Yeni sayfa ancak temiz açılır.',                tag: 'halkci', fx: { pop: 4 }, seed: 'dosyaları yakan' },
                { t: 'Arşive — erişim protokolüyle, kayıt altında.',       tag: 'uzman', fx: {}, seed: 'protokol adamı' },
            ]},
            halkci: { q: 'Kriz bitti; şehit aileleri devlet töreni bekliyor, hazine kısıtlı. Kararın?', o: [
                { t: 'Tören yerine sınır tahkimatı — en iyi saygı güvenliktir.', tag: 'sert', fx: { hawk: 4 }, seed: 'tahkimat kararı' },
                { t: 'Sade tören + ailelere sessiz maaş bağla.',           tag: 'kurnaz', fx: {}, seed: 'sessiz maaşlar' },
                { t: 'Ulusal tören; masrafı komuta kademesi öder, ben dahil.', tag: 'halkci', fx: { pop: 6 }, seed: 'cebinden tören' },
                { t: 'Tören + şehit çocuklarına eğitim fonu.',             tag: 'uzman', fx: {}, seed: 'burs fonu kurucusu' },
            ]},
            uzman: { q: 'Krizin kapanış raporunda "sorumluluk" başlığı var. Kimin adı yazılacak?', o: [
                { t: 'Sahadaki komutanın — emir komuta net olmalı.',       tag: 'sert', fx: { auth: 4 }, seed: 'sorumluluğu devreden' },
                { t: 'Kimsenin. Muğlak bırak.',                            tag: 'kurnaz', fx: { auth: 3, pop: -3 }, seed: 'muğlak rapor' },
                { t: 'Benim. Sorumluluk liderde biter.',                   tag: 'halkci', fx: { pop: 7 }, seed: 'sorumluluğu üstlenen' },
                { t: 'Kişi değil sistem: hata analizi yayınlansın.',       tag: 'uzman', fx: {}, seed: 'sistem analisti' },
            ]},
        },
    },
    idare: {
        root: { q: 'İlk bütçen masada: enerji sübvansiyonu, ordu modernizasyonu ve hastane programı aynı anda karşılanamıyor. Önceliğin?', o: [
            { t: 'Ordu. Güvenlik olmadan gerisi süs.',                     tag: 'sert', fx: { hawk: 5, auth: 2 } },
            { t: 'Üçünü de açıkla; ikisini sessizce ertele.',              tag: 'kurnaz', fx: { auth: 4, pop: -2 } },
            { t: 'Hastane. Devlet önce vatandaşını yaşatır.',              tag: 'halkci', fx: { pop: 6 } },
            { t: 'Enerji — o düşerse üçü birden düşer.',                   tag: 'uzman', fx: { pop: -2 } },
        ]},
        s2: {
            sert: { q: 'Modernizasyon ihalesine tek yerli aday girdi; fiyat fahiş. Ne yaparsın?', o: [
                { t: 'Öde. Gecikme zafiyettir.',                           tag: 'sert', fx: { hawk: 3, nat: 3 } },
                { t: 'Yabancı teklifi gizlice al; yerliye "ayarla" de.',   tag: 'kurnaz', fx: { nat: -3, auth: 4 } },
                { t: 'İhaleyi iptal et; işi kamu fabrikasına ver.',        tag: 'halkci', fx: { pop: 5, nat: 4 } },
                { t: 'Parçala: gövde yerli, elektronik ithal.',            tag: 'uzman', fx: { nat: -2, pop: -2 } },
            ]},
            kurnaz: { q: 'Ertelediğin hastane programı sızdı; sağlık sendikası grevde. İlk hamlen?', o: [
                { t: 'Grev yasağı — bu kritik hizmettir.',                 tag: 'sert', fx: { auth: 7, pop: -4 } },
                { t: 'Sendika başkanına özel bir teklif götür.',           tag: 'kurnaz', fx: { auth: 4, pop: -2 } },
                { t: 'Hastaneyi geri koy; orduyu ertele.',                 tag: 'halkci', fx: { pop: 6, hawk: -3 } },
                { t: 'Kademeli takvim aç: tarih ver, imzala.',             tag: 'uzman', fx: { pop: 1 } },
            ]},
            halkci: { q: 'Hastane programın başladı ama enerji faturaları patladı; kışın karneye kalma riski var. Kararın?', o: [
                { t: 'Komşuya enerji koridoru için baskı kur.',            tag: 'sert', fx: { hawk: 5 } },
                { t: 'Spot piyasadan pahalı al; farkı örtülü fondan kapat.', tag: 'kurnaz', fx: { auth: 4, pop: -2 } },
                { t: 'Karneyi dürüstçe açıkla; kendi konutundan başla.',   tag: 'halkci', fx: { pop: 6 } },
                { t: 'Sanayiye gece tarifesi; konuta öncelik.',            tag: 'uzman', fx: { pop: 2 } },
            ]},
            uzman: { q: 'Enerji yatırımı için iki teklif: ucuz ama kirli kömür, pahalı ama temiz nükleer. Halk nükleerden korkuyor. Seçimin?', o: [
                { t: 'Nükleer — korku yönetilir, enerjisizlik yönetilmez.', tag: 'sert', fx: { auth: 4 } },
                { t: 'Kömürle başla; nükleerin temelini sessizce at.',     tag: 'kurnaz', fx: { auth: 3, pop: -2 } },
                { t: 'Referanduma götür.',                                 tag: 'halkci', fx: { pop: 7, auth: -5 } },
                { t: 'İkisini de küçült; şebeke verimliliğine yatır.',     tag: 'uzman', fx: { pop: -2 } },
            ]},
        },
        s3: {
            sert: { q: 'Bütçe açığı büyüdü; merkez bankası başkanı faiz artışı istiyor, sen büyüme. Masada gerginlik. Sen?', o: [
                { t: 'Başkanı değiştir.',                                  tag: 'sert', fx: { auth: 7 } },
                { t: 'Kabul etmiş görün; arka kanaldan likidite aç.',      tag: 'kurnaz', fx: { auth: 4 } },
                { t: 'Faiz artsın ama asgari ücrete kalkan koy.',          tag: 'halkci', fx: { pop: 5 } },
                { t: 'Bankaya dokunma; açığı harcamadan kapat.',           tag: 'uzman', fx: { pop: -3, auth: -2 } },
            ]},
            kurnaz: { q: 'Örtülü fon hareketlerini bir müfettiş fark etti; dosya henüz masasında. Ne yaparsın?', o: [
                { t: 'Müfettişi pasif göreve al.',                         tag: 'sert', fx: { auth: 7 } },
                { t: 'Dosyayı satın al — terfi ve tayinle.',               tag: 'kurnaz', fx: { auth: 5, pop: -3 } },
                { t: 'Öne geç: fonu gerekçesiyle kendin açıkla.',          tag: 'halkci', fx: { pop: 6, auth: -3 } },
                { t: 'Hukuka bırak; sonucuna katlan.',                     tag: 'uzman', fx: { pop: 2, auth: -4 } },
            ]},
            halkci: { q: 'Popüler programların hazineyi zorluyor; derecelendirme kuruluşu not kırdı, borçlanma pahalandı. Tavrın?', o: [
                { t: 'Kuruluşu "ekonomik saldırı" ilan et.',               tag: 'sert', fx: { nat: 5, pop: 3 } },
                { t: 'Nota itiraz ederken gizlice kemer sık.',             tag: 'kurnaz', fx: { auth: 3 } },
                { t: 'Halka anlat: "Not değil, sofra önemli."',            tag: 'halkci', fx: { pop: 6 } },
                { t: 'Programları verimlilik denetiminden geçir.',         tag: 'uzman', fx: { pop: -3 } },
            ]},
            uzman: { q: 'Verimlilik reformun 12 bin memurun yerini değiştiriyor; sessiz ama derin bir direnç var. Nasıl ilerlersin?', o: [
                { t: 'Kararname ile; tartışma bitti.',                     tag: 'sert', fx: { auth: 6 } },
                { t: 'Önce sendika liderlerinin çevresini muaf tut.',      tag: 'kurnaz', fx: { auth: 3, pop: -3 } },
                { t: 'Gönüllülük + teşvik; zorlama yok.',                  tag: 'halkci', fx: { pop: 5 } },
                { t: 'Pilot iller, ölçüm, sonra yayılım.',                 tag: 'uzman', fx: { pop: -1 } },
            ]},
        },
        s4: {
            sert: { q: 'Yıl sonu: disiplinle yönettin ama gölgen büyüdü. Kabine revizyonunda kimleri seçersin?', o: [
                { t: 'Sadıkları — itaat da bir kabiliyettir.',             tag: 'sert', fx: { auth: 5 }, seed: 'sadakat kabinesi' },
                { t: 'Rakiplerini içeri al; göz önünde dursunlar.',        tag: 'kurnaz', fx: { auth: 3 }, seed: 'rakip kucaklayan' },
                { t: 'Genç uzmanları — vitrin değil icraat.',              tag: 'halkci', fx: { pop: 4 }, seed: 'genç kabine' },
                { t: 'Karışık: her bakanlığa bir denge.',                  tag: 'uzman', fx: {}, seed: 'denge kabinesi' },
            ]},
            kurnaz: { q: 'Yıl sonu: hesaplar kapandı, kimse bir şey kanıtlayamadı. İç sesin ne diyor?', o: [
                { t: 'Devlet böyle yönetilir.',                            tag: 'sert', fx: { auth: 4 }, seed: 'gölge yönetici' },
                { t: 'Sonraki hamle için iki yeni kanal aç.',              tag: 'kurnaz', fx: { auth: 5 }, seed: 'kanal kurucusu' },
                { t: 'Bu yıl bitti; gelecek yıl şeffaf başlarım.',         tag: 'halkci', fx: { pop: 3 }, seed: 'yarım tövbe' },
                { t: 'Riskliydi. Ya sistemleştir ya bırak.',               tag: 'uzman', fx: {}, seed: 'sistemleştiren' },
            ]},
            halkci: { q: 'Yıl sonu: halk desteğin tavan ama bütçe bıçak sırtı. Yeni yıl vaadin ne olacak?', o: [
                { t: '"Sofranızı da sınırı da korurum."',                  tag: 'sert', fx: { hawk: 4 }, seed: 'güvenlik vaadi' },
                { t: 'Büyük vaat, takvimsiz söz — faturasız umut.',        tag: 'kurnaz', fx: { pop: 2, auth: 2 }, seed: 'takvimsiz vaat' },
                { t: 'Vaat yok: "Söz değil, hesap vereceğim."',            tag: 'halkci', fx: { pop: 6 }, seed: 'hesap veren' },
                { t: 'Tek vaat: enflasyonu tek haneye indirmek.',          tag: 'uzman', fx: {}, seed: 'tek hedef adamı' },
            ]},
            uzman: { q: 'Yıl sonu: reformlar rakamlarda başarılı ama sokakta hissedilmiyor. Ne değişecek?', o: [
                { t: 'Anlatı. Başarıyı anlatacak iletişim ordusu kur.',    tag: 'sert', fx: { auth: 4 }, seed: 'anlatı kurucusu' },
                { t: 'Seçim öncesi hedefli mikro-harcamalar.',             tag: 'kurnaz', fx: { pop: 2, auth: 2 }, seed: 'mikro harcamacı' },
                { t: 'Sahaya in: ayda bir kentte halk günü.',              tag: 'halkci', fx: { pop: 5 }, seed: 'saha lideri' },
                { t: 'Sabır. Bileşik etki ikinci yılda görünür.',          tag: 'uzman', fx: { pop: -2 }, seed: 'bileşik etki inancı' },
            ]},
        },
    },
    siyaset: {
        root: { q: 'Ana muhalefet lideri seçim gecesi hile iddiasıyla sonuçları tanımadı; iki meydanda kalabalık büyüyor. İlk hamlen?', o: [
            { t: 'Meydanları boşalt — devlet otoritesi tartışılmaz.',      tag: 'sert', fx: { auth: 8 } },
            { t: 'Liderle gizlice görüş; koalisyon teklif et.',            tag: 'kurnaz', fx: { auth: 3, pop: -2 } },
            { t: 'Sandıkları canlı yayında yeniden saydır.',               tag: 'halkci', fx: { pop: 7, auth: -4 } },
            { t: 'Bağımsız uluslararası gözlemci heyeti çağır.',           tag: 'uzman', fx: { pop: 1, nat: -3 } },
        ]},
        s2: {
            sert: { q: 'Meydan müdahalesinde bir genç yaralandı; görüntü her yerde. Basın toplantısında soruyorlar. Cevabın?', o: [
                { t: '"Provokasyona müdahaleydi; gerekirse yine olur."',   tag: 'sert', fx: { auth: 7, pop: -4 } },
                { t: 'Görüntünün "kurgu" olduğunu ima et.',                tag: 'kurnaz', fx: { auth: 5, pop: -3 } },
                { t: 'Hastaneye git; aileden özür dile, soruşturma aç.',   tag: 'halkci', fx: { pop: 6, auth: -4 } },
                { t: '"Soruşturma sonuçlanmadan yorum yok."',              tag: 'uzman', fx: { pop: -3, auth: 2 } },
            ]},
            kurnaz: { q: 'Koalisyon pazarlığın sızdı; kendi tabanın "ihanet" diyor. Ne yaparsın?', o: [
                { t: 'Sızdıran kurmayı tasfiye et.',                       tag: 'sert', fx: { auth: 6 } },
                { t: '"Devlet aklı" de; detayları muğlak bırak.',          tag: 'kurnaz', fx: { auth: 4 } },
                { t: 'Tabana anlat: "Kavga değil, istikrar aldım."',       tag: 'halkci', fx: { pop: 5 } },
                { t: 'Protokolü olduğu gibi yayınla.',                     tag: 'uzman', fx: { pop: 2, auth: -3 } },
            ]},
            halkci: { q: 'Yeniden sayım seni doğruladı ama muhalefet "süreç şaibeli" diyor; taraftarların "yeter artık" modunda. Ne yaparsın?', o: [
                { t: 'Tanımayana bedel: dokunulmazlık dosyalarını aç.',    tag: 'sert', fx: { auth: 6, pop: -2 } },
                { t: 'Muhalefetin ılımlı kanadını sessizce kopar.',        tag: 'kurnaz', fx: { auth: 3 } },
                { t: 'Zafer konuşmasında el uzat: "Hepimiz kazandık."',    tag: 'halkci', fx: { pop: 6, hawk: -2 } },
                { t: 'Seçim yasası reform komisyonu kur.',                 tag: 'uzman', fx: { pop: 1, auth: -3 } },
            ]},
            uzman: { q: 'Gözlemci raporu: "Usulsüzlük yok ama sistemik zafiyet var." Muhalefet raporu "kanıt" diye sallıyor. Tavrın?', o: [
                { t: 'Raporu çarpıtana dava aç.',                          tag: 'sert', fx: { auth: 6 } },
                { t: 'Raporun olumlu cümlelerini afişe bas.',              tag: 'kurnaz', fx: { pop: 2, auth: 2 } },
                { t: 'Zafiyet listesini kabul et; düzeltme takvimi ilan et.', tag: 'halkci', fx: { pop: 5 } },
                { t: 'Teknik komite kur; maddeleri tek tek kapat.',        tag: 'uzman', fx: { pop: -1 } },
            ]},
        },
        s3: {
            sert: { q: 'Uluslararası basında manşetsin: "Yeni demir yumruk". Yabancı yatırımcı temkinli. Sen?', o: [
                { t: '"Düzen olmadan yatırım olmaz" — devam.',             tag: 'sert', fx: { auth: 6, nat: 4 } },
                { t: 'İmaj ajansı tut; yumuşak bir belgesel çektir.',      tag: 'kurnaz', fx: { auth: 3, pop: -2 } },
                { t: 'Af paketi açıkla; birkaç tutukluyu bırak.',          tag: 'halkci', fx: { pop: 5, auth: -4 } },
                { t: 'Yatırımcıya hukuki garanti paketi sun.',             tag: 'uzman', fx: { nat: -4, pop: -2 } },
            ]},
            kurnaz: { q: 'Perde arkası ittifakların meclisi sana teslim etti; ama kimse sana GÜVENMİYOR — herkes fiyatını biliyor. Sorun mu?', o: [
                { t: 'Korku yeter; güven lükstür.',                        tag: 'sert', fx: { auth: 7, pop: -4 } },
                { t: 'Güven de satın alınır: birkaç kamu zaferi planla.',  tag: 'kurnaz', fx: { auth: 3, pop: 2 } },
                { t: 'Sorun. Bir sözü tut, bir dosyayı kapat — görünür ol.', tag: 'halkci', fx: { pop: 4 } },
                { t: 'Güven metriktir: söz-tutma oranını yayınla.',        tag: 'uzman', fx: { pop: 1 } },
            ]},
            halkci: { q: 'Meydan gücün tavan; ama kurmayların "vaatlerin faturası kabarıyor" diyor. Hangi ses kazanır?', o: [
                { t: 'Meydan. Ekonomi meydana uyar.',                      tag: 'sert', fx: { pop: 4, nat: 3 } },
                { t: 'İkisi de: vaadi söyle, faturayı seçim sonrasına yaz.', tag: 'kurnaz', fx: { auth: 3, pop: 1 } },
                { t: 'Meydanda dürüst ol: "Hepsi bir anda olmaz."',        tag: 'halkci', fx: { pop: 5 } },
                { t: 'Kurmaylar. Vaat takvimini rakama bağla.',            tag: 'uzman', fx: { pop: -2 } },
            ]},
            uzman: { q: 'Komisyonların, raporların, reformların var — ama anket "soğuk ve uzak" diyor. Ne yaparsın?', o: [
                { t: 'Anket değil sonuç konuşur.',                         tag: 'sert', fx: { auth: 4, pop: -3 } },
                { t: 'Bir "insani an" kurgula: sahada spontane(!) ziyaret.', tag: 'kurnaz', fx: { auth: 2, pop: 2 } },
                { t: 'Gerçekten sahaya in; program yapma, dinle.',         tag: 'halkci', fx: { pop: 5 } },
                { t: 'İletişimi de sistemleştir: haftalık sade video rapor.', tag: 'uzman', fx: { pop: 1 } },
            ]},
        },
        s4: {
            sert: { q: 'Dönemin kapanışında tarih kitapları için tek cümle yazılacak. Hangisi olsun?', o: [
                { t: '"Düzeni sağladı."',                                  tag: 'sert', fx: { auth: 4 }, seed: 'düzenin adamı' },
                { t: '"Kimse nasıl yaptığını çözemedi."',                  tag: 'kurnaz', fx: {}, seed: 'çözülemeyen' },
                { t: '"Kapısı hep açıktı."',                               tag: 'halkci', fx: { pop: 4 }, seed: 'kapısı açık lider' },
                { t: '"Kurumları kişilerden büyük yaptı."',                tag: 'uzman', fx: {}, seed: 'kurum inşacısı' },
            ]},
            kurnaz: { q: 'Dosyaların, borçluların, kanalların — hepsi yerli yerinde. Bu ağı kime bırakırsın?', o: [
                { t: 'Kimseye; benimle gömülür.',                          tag: 'sert', fx: { auth: 5 }, seed: 'ağını gömen' },
                { t: 'Üçe böl; kimse bütünü görmesin.',                    tag: 'kurnaz', fx: { auth: 4 }, seed: 'ağı bölen' },
                { t: 'Kurumsallaştır: yasal istihbarat çatısına devret.',  tag: 'halkci', fx: { pop: 3 }, seed: 'ağı yasallaştıran' },
                { t: 'Arşivle ve mühürle: 25 yıl sonra açılsın.',          tag: 'uzman', fx: {}, seed: 'mühürlü arşiv' },
            ]},
            halkci: { q: 'Bir gazeteci soruyor: "Halk sizi çok seviyor. Peki ya yanılırsanız?" Cevabın?', o: [
                { t: '"Halk yanılmaz."',                                   tag: 'sert', fx: { pop: 3, nat: 3 }, seed: 'halk yanılmaz diyen' },
                { t: '"Yanılırsam kimse fark etmez." (gülerek)',           tag: 'kurnaz', fx: { auth: 3 }, seed: 'şakayla geçiştiren' },
                { t: '"Yanılırım. O gün beni meydan düzeltir."',           tag: 'halkci', fx: { pop: 5, auth: -3 }, seed: 'meydana hesap veren' },
                { t: '"Bunun için fren mekanizmaları kurdum."',            tag: 'uzman', fx: { auth: -4 }, seed: 'fren kuran' },
            ]},
            uzman: { q: 'Sistemin çalışıyor; ama bir danışmanın "sistemler lider ister" diyor. Gücün merkezi neresi olacak?', o: [
                { t: 'Liderlik. Sistem araçtır.',                          tag: 'sert', fx: { auth: 5 }, seed: 'lider merkezli' },
                { t: 'Belirsiz bırak — ikisi de beni bilsin.',             tag: 'kurnaz', fx: { auth: 4 }, seed: 'belirsizlik ustası' },
                { t: 'Meclis. Ben geçiciyim, o kalıcı.',                   tag: 'halkci', fx: { pop: 4, auth: -5 }, seed: 'meclisi büyüten' },
                { t: 'Anayasa. Kişiler değişir, çerçeve kalır.',           tag: 'uzman', fx: { auth: -3 }, seed: 'çerçeve adamı' },
            ]},
        },
    },
};
const CHARQ_THEMES = [
    { key: 'harp',    name: 'HARP',    icon: '⚔️' },
    { key: 'idare',   name: 'İDARE',   icon: '🏛️' },
    { key: 'siyaset', name: 'SİYASET', icon: '📣' },
];

// ── SORU AKIŞI (saf mantık; UI'dan bağımsız → test edilebilir) ─────────────
function charQuestionAt(themeKey, stage, prevTag) {
    const th = CHARQ[themeKey]; if (!th) return null;
    if (stage === 0) return th.root;
    const bank = [th.s2, th.s3, th.s4][stage - 1];
    return bank ? (bank[prevTag] || bank.uzman) : null;
}
// Cevap etiketi sayacından yetenek +1: sert→savaş, halkci→diplomasi, uzman→iktisat,
// kurnaz→en düşük zara (+çok yönlü kurnazlık). charApply içinde kullanılır.
function charSkillFromTags(tags, dice) {
    const c = { sert: 0, kurnaz: 0, halkci: 0, uzman: 0 };
    for (const t of tags) c[t] = (c[t] || 0) + 1;
    const top = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
    if (top === 'sert') return 'warrior';
    if (top === 'halkci') return 'diplomat';
    if (top === 'uzman') return 'economist';
    return Object.keys(dice).sort((a, b) => dice[a] - dice[b])[0];   // kurnaz: en düşük zar
}

// ── CUMHURBAŞKANLARI — her devletin İSİMLİ lideri ─────────────────────────
// "AI Cumhurbaşkanı" etiketi ölür: karar veren kişinin adı ve karakteri var.
// Devlet doktrini (saldırganlık, pakt eğilimi) liderin eksenlerinden türer;
// lider değişince devletin karakteri değişir.
const CHAR_PRES_PERSONA = { TR: 'dengeli', IB: 'fırsatçı', BK: 'savunmacı', CB: 'agresif', KB: 'savunmacı', SF: 'agresif', MB: 'fırsatçı', AB: 'dengeli' };
// Cumhurbaşkanı SİVİLDİR: 'Mert Komutan' gibi asker adı, komutan listesinde
// karşılığı olmayan bir kişi izlenimi veriyordu (kullanıcı yakaladı). Ad + soyad alır.
const PRES_SURNAMES = ['Aksoy', 'Demirel', 'Korkmaz', 'Aydoğan', 'Ertem', 'Sancak', 'Uludağ', 'Karaca', 'Tekin', 'Yalman', 'Soylu', 'Erkan'];
function charPresidentName() {
    return STORY_CMD_NAMES[storyRandomInt('character', STORY_CMD_NAMES.length)] + ' '
         + PRES_SURNAMES[storyRandomInt('character', PRES_SURNAMES.length)];
}
function charMakePresident(st) {
    const flavor = (typeof WAR_ROOM_STATE_FLAVOR !== 'undefined' && WAR_ROOM_STATE_FLAVOR[st.id]) || {};
    const persona = CHAR_PRES_PERSONA[flavor.code] || storyPickPersonality();
    return { name: charPresidentName(), persona, axes: charAxesFor(persona), dice: charRollDice() };
}
function storyEnsurePresidents() {
    for (const st of STORY.states) {
        if (!st.gov) continue;
        if (!st.gov.president) st.gov.president = charMakePresident(st);
        if (!st.gov.president.axes) st.gov.president.axes = charAxesFor(st.gov.president.persona || 'dengeli');
        // GÖÇ: eski kayıtlarda asker-adlı başkan ('Mert Komutan') → sivil soyadla değiştir
        if (/\s(Paşa|Komutan|Bey|Ağa)$/.test(st.gov.president.name || ''))
            st.gov.president.name = st.gov.president.name.split(' ')[0] + ' ' + PRES_SURNAMES[(st.id * 5 + 3) % PRES_SURNAMES.length];
    }
}
function storyPresidentName(st) {
    if (!st) return 'Cumhurbaşkanı';
    if (st.isPlayer && st.isAdmin && STORY.commander) return STORY.commander.name;
    const elected = typeof storyElectionExecutiveHolder === 'function'
        ? storyElectionExecutiveHolder(st.id) : null;
    if (elected && elected.name) return elected.name;
    return (st.gov && st.gov.president && st.gov.president.name) || 'Cumhurbaşkanı';
}
// Devlet doktrini: liderin şahinliği saldırı iştahını sürer (0.7x güvercin … 1.3x şahin).
// storyEvalTarget'ta RİSK EŞİĞİNİ oynatır (asıl kaldıraç) + EV'yi çarpar (hedef seçimi).
// Genlik ölçümle ayarlandı: 0.8-1.2 aralığı 600sn testinde yalnız ~%13 fetih farkı
// veriyordu — "lider değişince devlet karakteri değişir" hissi için zayıf.
function storyDoctrineAggr(st) {
    const p = st && st.gov && st.gov.president;
    const hawk = (p && p.axes && p.axes.hawk != null) ? p.axes.hawk : 50;
    return 0.7 + 0.6 * (hawk / 100);
}

// ── KARAKTERİ KAMPANYAYA UYGULA ────────────────────────────────────────────
function charApply(character) {
    const c = STORY.commander; if (!c || !character) return;
    if (character.name) c.name = character.name;
    if (character.dice) c.skills = { warrior: character.dice.warrior, diplomat: character.dice.diplomat, economist: character.dice.economist };
    c.axes = charClampAxes(Object.assign(charAxesDefault(), character.axes || {}));
    c.lpBonus = character.dice ? charLpBonus(character.dice) : 0;    // zar denkleştirmesi
    c.legacy = (character.seeds || []).slice(0, 4);                  // geçmiş tohumları (AŞAMA 7 hafızasına doğacak)
    c.archetype = charArchetype(c.axes).id;
    if (character.skillPlus && c.skills[character.skillPlus] != null)
        c.skills[character.skillPlus] = Math.min(6, c.skills[character.skillPlus] + 1);
}

// ── EKRAN ──────────────────────────────────────────────────────────────────
const CHAR_UI = { cfg: null, step: 0, name: '', dice: null, axes: null, tags: [], seeds: [], theme: 0, stage: 0, prevTag: null, qIndex: 0 };

function charOpen(setupCfg) {
    CHAR_UI.cfg = Object.assign({}, setupCfg || {});
    if (typeof storyRngReset === 'function') {
        const rng = storyRngReset(CHAR_UI.cfg.seed);
        CHAR_UI.cfg.seed = rng.rootSeed;
    }
    CHAR_UI.step = 0; CHAR_UI.dice = charRollDice(); CHAR_UI.axes = charAxesDefault();
    CHAR_UI.tags = []; CHAR_UI.seeds = []; CHAR_UI.theme = 0; CHAR_UI.stage = 0; CHAR_UI.prevTag = null; CHAR_UI.qIndex = 0;
    CHAR_UI.name = 'Komutan';
    showScreen('story-character');
    charRender();
}
function charFinish() {
    const skillPlus = charSkillFromTags(CHAR_UI.tags, CHAR_UI.dice);
    const character = { name: CHAR_UI.name.trim() || 'Komutan', dice: CHAR_UI.dice, axes: CHAR_UI.axes, seeds: CHAR_UI.seeds, skillPlus };
    storyNewCampaign(Object.assign({}, CHAR_UI.cfg, { character }));
    if (typeof storyOpen === 'function') storyOpen();
}
function charRender() {
    const el = document.getElementById('char-body'); if (!el) return;
    if (CHAR_UI.step === 0) return charRenderDice(el);
    if (CHAR_UI.step === 1) return charRenderQuestion(el);
    return charRenderSummary(el);
}
function charRenderDice(el) {
    const d = CHAR_UI.dice, lp = charLpBonus(d);
    const die = (k, icon, name) => `<div class="char-die"><span class="cd-icon">${icon}</span><b class="cd-val">${d[k]}</b><span class="cd-name">${name}</span></div>`;
    el.innerHTML = `
      <div class="char-title">KOMUTAN PROFİLİ</div>
      <label class="char-name-row">İSİM <input id="char-name" maxlength="24" value="${CHAR_UI.name.replace(/"/g, '&quot;')}"></label>
      <div class="char-dice-row">${die('warrior', '⚔️', 'SAVAŞ')}${die('diplomat', '🕊️', 'DİPLOMASİ')}${die('economist', '⚙️', 'İKTİSAT')}</div>
      <div class="char-lp">🎖️ Başlangıç liyakat puanı: <b>${lp}</b><br>
        <small>Zar toplamı düştükçe gelişim bütçesi artar (21 − toplam). Düşük zar = güçlü başlangıç ağacı; her atış oynanabilir.</small></div>
      <div class="char-btns">
        <button id="char-roll" type="button">🎲 RASTGELE</button>
        <button id="char-next" type="button" class="primary">DEVAM → SORULAR</button>
      </div>`;
    const nameEl = document.getElementById('char-name');
    nameEl.addEventListener('input', () => { CHAR_UI.name = nameEl.value; });
    document.getElementById('char-roll').addEventListener('click', () => { CHAR_UI.dice = charRollDice(); charRender(); });
    document.getElementById('char-next').addEventListener('click', () => { CHAR_UI.step = 1; charRender(); });
}
function charRenderQuestion(el) {
    const th = CHARQ_THEMES[CHAR_UI.theme];
    const q = charQuestionAt(th.key, CHAR_UI.stage, CHAR_UI.prevTag);
    if (!q) { CHAR_UI.step = 2; return charRender(); }
    el.innerHTML = `
      <div class="char-title">${th.icon} ${th.name} · Soru ${CHAR_UI.qIndex + 1}/12</div>
      <div class="char-q">${q.q}</div>
      <div class="char-opts">${q.o.map((o, i) => `<button type="button" class="char-opt" data-i="${i}">${o.t}</button>`).join('')}</div>`;
    el.querySelectorAll('.char-opt').forEach(btn => btn.addEventListener('click', () => {
        const o = q.o[+btn.dataset.i];
        for (const k in (o.fx || {})) CHAR_UI.axes[k] = (CHAR_UI.axes[k] ?? 50) + o.fx[k];
        charClampAxes(CHAR_UI.axes);
        CHAR_UI.tags.push(o.tag);
        if (o.seed) CHAR_UI.seeds.push(o.seed);
        CHAR_UI.prevTag = o.tag; CHAR_UI.stage++; CHAR_UI.qIndex++;
        if (CHAR_UI.stage > 3) { CHAR_UI.theme++; CHAR_UI.stage = 0; CHAR_UI.prevTag = null; }
        if (CHAR_UI.theme >= CHARQ_THEMES.length) CHAR_UI.step = 2;
        charRender();
    }));
}
function charRenderSummary(el) {
    const a = CHAR_UI.axes, arc = charArchetype(a);
    const bar = x => {
        const v = a[x.k] ?? 50;
        return `<div class="char-axis"><span class="ca-lo">${x.lo}</span>
          <div class="ca-track"><div class="ca-fill" style="left:${Math.min(v, 50)}%;width:${Math.abs(v - 50)}%"></div><div class="ca-mid"></div></div>
          <span class="ca-hi">${x.hi}</span><b class="ca-val">${v}</b></div>`;
    };
    el.innerHTML = `
      <div class="char-title">${arc.icon} ${CHAR_UI.name.trim() || 'Komutan'} — <span class="char-arc">${arc.name}</span></div>
      <div class="char-axes">${CHAR_AXES.map(bar).join('')}</div>
      ${CHAR_UI.seeds.length ? `<div class="char-seeds">📜 Geçmişin: ${CHAR_UI.seeds.map(s => `<i>${s}</i>`).join(' · ')}</div>` : ''}
      <div class="char-lp">⚔️${CHAR_UI.dice.warrior} 🕊️${CHAR_UI.dice.diplomat} ⚙️${CHAR_UI.dice.economist} · 🎖️ ${charLpBonus(CHAR_UI.dice)} LP</div>
      <div class="char-btns"><button id="char-go" type="button" class="primary">GÖREVE BAŞLA</button></div>`;
    document.getElementById('char-go').addEventListener('click', charFinish);
}

// Komutan listelerinde bar yerine ZAR ROZETİ (kullanıcı isteği: "1/1/1 gibi sayılar")
function charDiceBadge(sk) {
    const s = sk || {};
    return `<div class="cr-dice" title="Savaş ${s.warrior | 0} · Diplomasi ${s.diplomat | 0} · İktisat ${s.economist | 0}">`
        + `<span>⚔️${s.warrior | 0}</span><span>🕊️${s.diplomat | 0}</span><span>⚙️${s.economist | 0}</span></div>`;
}
