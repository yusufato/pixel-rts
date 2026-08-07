// ═══════════════════════════════════════════════════════════════════════════
//  beonai — ÖĞRENEN BEYİN SOYU (sürümlenmiş)
//  ---------------------------------------------------------------------------
//  YENİ MİMARİ DEĞİL: repoda zaten çalışan hat var —
//     OperationGrammar (aday üretir) → BattleOracle (karşı-olgusal rollout = ÖĞRETMEN)
//     → BattleFeatures (durum⊕aday) → BattleSelector (MLP sıralayıcı)
//  Bu dosya o hattı bir SOY hâline getirir: sürüm kaydı, taraf-başı bağlama ve
//  kod-AI (intel4 / intel4-pro) ile AYNI tezgâhta yarıştırma.
//
//  NEDEN SOY (tek model değil): öğrenen sistemde her yeniden eğitim yeni bir sürümdür;
//  hangi sürümün neyi kazandığı izlenebilmeli. intel3→intel4→intel4-pro soyu ayrı kalır,
//  sürüm-turnuvasında karışmaz.
//
//  ÜÇ SERT KURAL (hepsi acı deneyimden):
//   1) DETERMİNİZM: model çıkarımı SAF fonksiyondur (özellik→skor). Sim kodu canlı
//      kontrolör nesnesi okumaz; seçim kontrolörün karar yolunda olur ve emir olarak
//      kaydedilir → replay byte-aynı kalır. Replay/MP oynatımında beonai KAPALIDIR.
//   2) ÇOK-TOHUMLU DEĞERLENDİRME: marj std sapması ~3114 ölçüldü. Hiçbir beonai sürümü
//      12 tohumdan az ile "daha iyi" ilan edilemez; nihai karar dışörneklem havuzunda.
//      (docs/OLCUM-KRIZI-TOHUM-SAYISI.md — "6/6 kazanan" bir tarif taze tohumda 2/6 çıktı.)
//   3) BAYAT MODEL KAPALI DURUR: roster/motor değişince model dağılım-dışı kalır.
//      Sürüm kaydında hangi motor sürümüyle eğitildiği yazar; uyuşmazsa UYARIR.
// ═══════════════════════════════════════════════════════════════════════════

// Sürüm kaydı: { 'beonai-v1': { model, meta } }
const BATTLE_BEONAI_SURUMLER = Object.create(null);

// Taraf-başı etkin sürüm (null = kapalı, kod-AI kullanılır)
let BATTLE_BEONAI_RED = null;
let BATTLE_BEONAI_BLUE = null;

// Model açılışta değil TEMAS fazında devreye girer: kod-AI'ın açılış konuşlandırması
// korunur, model operasyon seçmeye sonra başlar (BATTLE_SELECTOR_MIN_TICK ile aynı mantık).
let BATTLE_BEONAI_MIN_TICK = 500;

// Kontrolör kimlikleri (BattleController.js ile aynı)
const BEONAI_KONTROLOR = { kirmizi: 'battle-red-ai', mavi: 'battle-blue-ally-ai' };

function battleBeonaiKaydet(surum, model, meta) {
    if (!surum || !model) return false;
    BATTLE_BEONAI_SURUMLER[surum] = {
        model,
        meta: Object.assign({
            motorSurumu: (typeof BATTLE_ENGINE_VERSION !== 'undefined') ? BATTLE_ENGINE_VERSION : null,
            stateVersion: model.stateVersion || null,
            candidateVersion: model.candidateVersion || null
        }, meta || {})
    };
    return true;
}

function battleBeonaiSurum(ad) {
    return ad ? BATTLE_BEONAI_SURUMLER[ad] || null : null;
}

// ÖZNİTELİK-DENK MOTOR SÜRÜMLERİ: modelin gördüğü öznitelik ŞEMASI aynı kaldıysa, motor sürümü
// değişmiş olsa da model çalışabilir. Buraya YALNIZ şemayı değiştirmeyen sürümler elle yazılır —
// otomatik gevşetme YOK, çünkü asıl amaç bayat modeli yakalamaktır.
//   -a2a (2026-08-07): hava-hava silahı + hedef-uygunluk emri. Öznitelik şeması (1280 raster + 59 skaler)
//   AYNI; yalnız muharebe dinamiği değişti. Modeller kullanılabilir ama a2a ÖNCESİ dinamikle eğitildi.
const BATTLE_BEONAI_DENK_SURUMLER = {
    'battlefield-v4-roster25-intel4-deferdmg-s2-posture-pdair-a2a': [
        'battlefield-v4-roster25-intel4-deferdmg-s2-posture-pdair'
    ]
};

// Bu sürüm mevcut motorla uyumlu mu? Uyumsuzsa model dağılım-dışıdır (bayat).
function battleBeonaiUyumlu(ad) {
    const s = battleBeonaiSurum(ad);
    if (!s) return { uyumlu: false, sebep: 'sürüm kayıtlı değil: ' + ad };
    const simdi = (typeof BATTLE_ENGINE_VERSION !== 'undefined') ? BATTLE_ENGINE_VERSION : null;
    if (s.meta.motorSurumu && simdi && s.meta.motorSurumu !== simdi) {
        const denk = BATTLE_BEONAI_DENK_SURUMLER[simdi] || [];
        if (denk.indexOf(s.meta.motorSurumu) < 0) {
            return { uyumlu: false, sebep: 'BAYAT: ' + s.meta.motorSurumu + ' ile eğitildi, motor şimdi ' + simdi };
        }
        return { uyumlu: true, sebep: 'öznitelik-denk: ' + s.meta.motorSurumu + ' (dinamik değişti, şema aynı)' };
    }
    return { uyumlu: true, sebep: null };
}

// Maç başında çağrılır: etkin sürümleri kontrolörlere bağlar.
// REPLAY/MP'de hiçbir şey yapmaz (kural 1).
function battleBeonaiBagla() {
    // DİKKAT: battleSelectorSetModel modeli YALNIZCA KAYDEDER. Kararları yakalayan sarmalayıcıyı
    // battleOracleInstallInjection kurar; onsuz model sessizce HİÇBİR ŞEY YAPMAZ. (Ölçüldü: beonai
    // "bağlı" görünürken sonuçlar modelsiz koşuyla BİREBİR aynı çıkıyordu.) Bu yüzden burada
    // battleSelectorEnableFor / battleSelectorDisable kullanılır — ikisi de sarmalayıcıyı yönetir.
    if (typeof battleSelectorEnableFor !== 'function' || typeof battleSelectorDisable !== 'function') {
        return { bagli: [], uyari: ['BattleSelector/Oracle yok'] };
    }
    const oynatim = (typeof BATTLE_REPLAY !== 'undefined' && BATTLE_REPLAY && BATTLE_REPLAY.playback);
    const mp = (typeof MP !== 'undefined' && MP && MP.active);
    if (oynatim || mp) { battleSelectorDisable(); return { bagli: [], uyari: ['replay/MP → beonai kapalı'] }; }

    battleSelectorDisable();   // önce temizle: önceki maçtan model VE sarmalayıcı sızmasın
    const bagli = [], uyari = [];
    const kur = (ad, ctrlId, taraf) => {
        if (!ad) return;
        const u = battleBeonaiUyumlu(ad);
        if (!u.uyumlu) { uyari.push(taraf + ': ' + u.sebep + ' → kod-AI kullanılıyor'); return; }
        battleSelectorEnableFor(ctrlId, BATTLE_BEONAI_SURUMLER[ad].model);
        bagli.push(taraf + '=' + ad);
    };
    kur(BATTLE_BEONAI_RED, BEONAI_KONTROLOR.kirmizi, 'kırmızı');
    kur(BATTLE_BEONAI_BLUE, BEONAI_KONTROLOR.mavi, 'mavi');
    if (bagli.length && typeof BATTLE_SELECTOR_MIN_TICK !== 'undefined') {
        BATTLE_SELECTOR_MIN_TICK = BATTLE_BEONAI_MIN_TICK;
    }
    return { bagli, uyari };
}

// Tanılama: hangi taraf hangi sürümle koşuyor (rapor satırlarında kullanılır)
function battleBeonaiDurum() {
    return {
        kirmizi: BATTLE_BEONAI_RED, mavi: BATTLE_BEONAI_BLUE,
        kayitli: Object.keys(BATTLE_BEONAI_SURUMLER).sort(),
        minTick: BATTLE_BEONAI_MIN_TICK
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        battleBeonaiKaydet, battleBeonaiSurum, battleBeonaiUyumlu,
        battleBeonaiBagla, battleBeonaiDurum, BEONAI_KONTROLOR
    };
}
