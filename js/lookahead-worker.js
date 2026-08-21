/* ═══════════════════════════════════════════════════════════════════════════
   İLERİ-BAKIŞ İŞÇİSİ (Web Worker) — arama ana iş parçacığından ÇIKIYOR

   NEDEN: aramanın TAM ayarı ölçülmüş +735 veriyor (t 3.55, saptama tabanının üstünde)
   ama canlı oyunda oynatılamıyordu: bir arama turu 2834ms (en kötü 6622ms) sürüyor ve
   ana iş parçacığında koşarsa oyun donuyor. Kullanıcı bunu sahada gördü:
   "oyun her 5 saniyede bir 2-3 saniye donuyor."

   MİMARİ ÖLÇÜLEREK DOĞRULANDI (tools/worker-kapisi.js, Node worker_threads provası):
     · EMİR EŞİTLİĞİ   3/3 — işçi yalnız fork'u alıp arayınca ana iş parçacığının
                             üreteceği emirlerin AYNISINI üretiyor
     · ÖNGÖRÜ EŞİTLİĞİ 3/3 — işçi dünyayı 100 tik (5sn) kendi ilerletince vardığı
                             durumun hash'i ana taraftakiyle BİREBİR aynı
   Yani "fork tek başına yeterli mesaj" ve "öngörü tam doğru" birer varsayım değil,
   ölçüm. (Negatif kontrol: fork'tan mayınlar atılınca kapı düşüyor → kapı kör değil.)

   ⚠ NEDEN ÖNGÖRÜ ŞART: işçinin cevabı ~k tik SONRA iner. Fork'u alıp olduğu yerden
   aramak, emrin hesaplandığı dünyaya değil geçmişe ait olması demektir. İşçi dünyayı
   k tik kendi ilerletip ORADAN ararsa emir indiği ana denk gelir. Sim deterministik ve
   kontrolörler + rngState fork'un içinde olduğu için bu yaklaşıklık DEĞİL, tam doğru —
   AI-vs-AI'da. Oyuncunun o pencerede yaptıkları tek hata kaynağıdır ve köprü bunu
   her turda ÖLÇER (öngörü hash'i tutmazsa sayaç artar).

   ⚠ FORK HARİTAYI TAŞIMAZ: `battleForkCapture` birimleri/siperleri/mayınları taşır,
   arazi rasterini taşımaz. Bu yüzden işçi ÖNCE aynı oturumu açar (bir kez), sonra
   her mesajda yalnız fork'u geri yükler.

   MESAJ SÖZLEŞMESİ
     ana → işçi  { tip:'kur', oturum:{...} }
     işçi → ana  { tip:'hazir' } | { tip:'hata', mesaj }
     ana → işçi  { tip:'ara', id, fork, now, ileri, kirmizi, mavi, koruma }
     işçi → ana  { tip:'emir', id, emirler:[{uid,x,y}], ongoruHash, sure }
   ═══════════════════════════════════════════════════════════════════════════ */

/* MİNİ DOM ÖNCE: muharebe zinciri yüklenirken `document.getElementById`, canvas
   `getContext` vb. çağırıyor. Worker'da DOM yok → shim kendini `self` üzerine kurar.
   Shim `js/` altında ÇÜNKÜ `package.json` build.files yalnız `js/**` içeriyor. */
importScripts('MiniDom.js');

/* ── ÇİZİM DÖNGÜSÜ KAPALI, KOŞULSUZ ────────────────────────────────────────
   `main.js` en üst seviyede `requestAnimationFrame(gameLoop)` çağırıyor ve `gameLoop`
   KENDİ BAŞINA `stepSim` + `battleLookaheadTick` koşuyor. İşçide bu felaket olurdu:
   işçi ana iş parçacığından bağımsız kendi maçını oynar, gönderilen fork'un üstüne
   yazar, emirler başka bir dünyaya ait çıkardı.

   ÖLÇÜLDÜ (tarayıcı kapısı, ilk koşu): bu ortamda Worker bağlamında `requestAnimationFrame`
   VAR — işçi gameLoop'a girip render yoluna (`drawFogOfWar`) düştü ve `myCanonicalSide`
   tanımsız diye çöktü. MiniDom "zaten varsa dokunma" kuralıyla çalıştığı için onu
   ezmiyordu. Burada KOŞULSUZ eziliyor; işçi tamamen senkron istek/cevap. */
self.requestAnimationFrame = function () { return 0; };
self.cancelAnimationFrame = function () {};

/* MUHAREBE ZİNCİRİ — `tools/muharebe-tezgah.js` içindeki MUHAREBE_KAYNAK ile AYNI SIRA.
   ⚠ BAĞLILIK: o liste değişirse burası da değişmeli. İki liste birbirinden kayarsa
   işçi ana iş parçacığından farklı davranır ve bu emir eşitliği kapısında görünür
   (tools/worker-kapisi.js). Sıra index.html'deki sırayla da uyumludur. */
var LA_WORKER_KAYNAK = [
    'UnitData.js', 'UnitFeatures.js', 'UnitLoader.js', 'globals.js',
    'BattleRules.js', 'BattleSession.js', 'BattlePerception.js', 'BattleSituation.js',
    'BattlePlanning.js', 'BattleExecution.js', 'BattleExploiters.js', 'OperationGrammar.js',
    'BattleSpaceTime.js', 'BattleStateFeatures.js', 'BattleBlackboard.js', 'BattleTargeting.js',
    'CommanderProfiles.js', 'BattleController.js', 'BattleCommander.js', 'BattleFeatures.js',
    'BattleSelector.js', 'BattleOracle.js', 'BattleSelectorModel.js', 'BattleCoach.js',
    'BattleBeonai.js', 'MapData.js', 'MapImage.js', 'VFX.js', 'Support.js', 'Unit.js',
    'BattleDeployment.js', 'main.js', 'BattleLookahead.js',
    'BattleValueModel.js', 'BattleValueNet.js'
];
/* İSTEĞE BAĞLI: eğitim çıktıları. Yoksa `importScripts` ATAR — tek tek denenir ki
   biri eksik diye işçinin tamamı çökmesin. (Tezgâhta da aynı kural var.) */
var LA_WORKER_ISTEGE_BAGLI = ['BattlePolicyModel.js', 'BattlePolicyNet.js',
    'BattleBeonaiModels.js', 'BattleBeonaiModelBC.js', 'BattleBeonaiModelBCv2.js'];

try {
    importScripts.apply(null, LA_WORKER_KAYNAK);
} catch (e) {
    self.postMessage({ tip: 'hata', mesaj: 'ZINCIR YUKLENEMEDI: ' + (e && e.message || e) });
    throw e;
}
for (var i = 0; i < LA_WORKER_ISTEGE_BAGLI.length; i++) {
    try { importScripts(LA_WORKER_ISTEGE_BAGLI[i]); } catch (e) { /* yok: sorun değil */ }
}

var LA_W_HAZIR = false;
var LA_W_EMIRLER = [];

/* AI AYAR YUZEYI — fork'un TASIMADIGI ama davranisi belirleyen kuresel anahtarlar.
   KUSUR (olcerek bulundu, tarayici kapisi): isci BATTLE_INTEL4_RED/BLUE'yu hic
   kurmuyordu -> ana is parcacigi intel4 ile, isci baska bir beyinle kosuyordu. Sonuc:
   ayni fork'tan 100 tik ileri sarinca hash'ler ayriliyor, arama farkli emir uretiyordu.
   Node provasi bunu KACIRDI cunku orada isci kurulumunu ELLE yazmistim ve bayraklari
   oraya koymustum — yani prova gercek iscinin kodunu degil kendi kopyasini siniyordu.
   Artik bu anahtarlar her 'ara' mesajinda ana taraftan GELIYOR ve parmak izine giriyor. */
var LA_W_AYAR_ANAHTAR = [
    'BATTLE_INTEL4_RED', 'BATTLE_INTEL4_BLUE', 'BATTLE_INTEL4PRO_RED', 'BATTLE_INTEL4PRO_BLUE',
    'BATTLE_POSTURE_GATE', 'BATTLE_SECTOR_COMMAND', 'BATTLE_SECTOR_COMMAND_RED', 'BATTLE_SECTOR_COMMAND_BLUE',
    'BATTLE_BEONAI_RED', 'BATTLE_BEONAI_BLUE', 'BATTLE_EXPLOITER_RED', 'BATTLE_EXPLOITER_BLUE',
    'BATTLE_FORCE_DOCTRINE', 'BATTLE_JAM_PARTIAL', 'BATTLE_JAM_RECON', 'BATTLE_SPAWN_LOADED',
    'BATTLE_KAPMA_TEHLIKE', 'BATTLE_ISTIHKAM_US', 'BATTLE_LA_EMIR_KORUMA',
    'BATTLE_KARSI_PLAN', 'BATTLE_KARSI_PLAN_GUVEN', 'BATTLE_KARSI_PLAN_KAPSAM', 'BATTLE_KARSI_PLAN_KAPAT', 'BATTLE_KARSI_PLAN_SURE',
    'BATTLE_TOPCU_ILERI', 'BATTLE_IKMAL_REFAKAT_INTEL4', 'BATTLE_TOPCU_KUTLE_INTEL4', 'BATTLE_DOLAYLI_YAKLAS_INTEL4', 'BATTLE_ZIRH_YONU_INTEL4', 'BATTLE_ANTI_ESLESME_INTEL4',
    'LA_PERIYOT_TIK', 'LA_YARICAP', 'LA_AG_ADAY', 'LA_AG_ESIK',
    'LA_GRUP', 'LA_GRUP_MIN', 'LA_GRUP_DERIN',
    'LA_RAKIP', 'LA_SIRALI', 'LA_CIFT_YON', 'LA_HIZLI_YOL', 'LA_DEGER_AGI', 'LA_AG_MIN_TIK',
    'LA_POLITIKA', 'LA_EMIR_SURESI', 'LA_KANAL_AGIRLIK'
];
function laWorkerAyarUygula(ayar) {
    if (!ayar) return;
    for (var i = 0; i < LA_W_AYAR_ANAHTAR.length; i++) {
        var k = LA_W_AYAR_ANAHTAR[i];
        if (!(k in ayar)) continue;
        try { self.eval(k + ' = ' + JSON.stringify(ayar[k]) + ';'); } catch (e) { /* sabit/yok: atla */ }
    }
}
function laWorkerAyarOku() {
    var o = {};
    for (var i = 0; i < LA_W_AYAR_ANAHTAR.length; i++) {
        var k = LA_W_AYAR_ANAHTAR[i];
        try {
            var v = self.eval('typeof ' + k + ' === "undefined" ? undefined : ' + k);
            if (v !== undefined) o[k] = v;
        } catch (e) {}
    }
    return o;
}

/* EMİR TOPLAYICI — yalnız NİHAİ emirler (kayit === true). Deneme rollout'ları da
   `battleLookaheadEmirVer`'i çağırıyor; onları da toplamak işçiyi ana iş parçacığından
   ayırırdı (orada yalnız nihai emirler uygulanıyor). */
function laWorkerEmirKancasiKur() {
    if (typeof battleLookaheadEmirVer !== 'function') return false;
    var eski = battleLookaheadEmirVer;
    battleLookaheadEmirVer = function (uid, karar, kayit) {
        if (kayit) LA_W_EMIRLER.push({ uid: uid, x: karar.x, y: karar.y });
        return eski(uid, karar, kayit);
    };
    return true;
}

function laWorkerKur(o) {
    /* Oturum ana iş parçacığındakiyle AYNI parametrelerle açılır: harita, kurallar ve
       KONTROLÖRLER buradan gelir. Kontrolörler kritik — rollout'lar `battleControllersDrive`
       çağırıyor; işçide kontrolör yoksa rollout'larda AI hiç koşmaz ve arama başka bir
       şey ölçer. (`configureBattleControllers` openBattlefieldSession'ın İÇİNDE.) */
    openBattlefieldSession({
        mode: 'quick', mapId: o.mapId, seed: o.seed, attackerSide: o.attackerSide,
        durationSec: o.durationSec, playerMoney: o.playerMoney, enemyMoney: o.enemyMoney,
        show: false
    });
    // İşçi hiçbir şey KAYDETMEZ: replay/telemetri ana iş parçacığının işi.
    if (typeof BATTLE_REPLAY !== 'undefined') BATTLE_REPLAY.telemetry = null;
    if (typeof BATTLE_REPLAY_KAYITSIZ !== 'undefined') BATTLE_REPLAY_KAYITSIZ = true;
    /* Ordu ÖNEMSİZ: `battleForkRestore` tüm birimleri değiştiriyor. Yine de `startBattle`
       birim bekleyebilir → oturum kendi ordusunu kurmadıysa kısa bir yedek kurulur. */
    if (typeof SIM !== 'undefined' && SIM.units && !SIM.units.length &&
        typeof battleBuildArmyManifest === 'function' && typeof battleDeployManifest === 'function') {
        var mv = battleBuildArmyManifest(o.enemyMoney || 6500, {
            maxUnits: 48, combatFocused: true, varied: true, brainIntel4: true,
            isAttacker: false, pro: false
        });
        battleDeployManifest(mv, false, { source: 'la-worker', ally: true });
    }
    startBattle();
    SIM.headless = true;                  // işçi ÇİZMEZ
    laWorkerEmirKancasiKur();
    LA_W_HAZIR = true;
}

/* ORTAM PARMAK İZİ — işçi ile ana iş parçacığının AYNI zeminde olduğunu kanıtlar.
   Fork araziyi TAŞIMAZ (yalnız birim/siper/mayın); arazi oturumdan yeniden üretilir.
   Üretilemezse ya da roster/motor sürümü farklıysa iki taraf sessizce farklı dünyalarda
   koşar ve bu ancak "öngörü tutmuyor" diye, sebebi görünmeden ortaya çıkar. İmza bunu
   ilk mesajda yakalar. */
function laWorkerParmakIzi() {
    var h = 2166136261 >>> 0;
    var kat = function (v) { var s = String(v); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } };
    if (typeof terrainGrid !== 'undefined' && terrainGrid) {
        kat(terrainGrid.length);
        for (var i = 0; i < terrainGrid.length; i++) kat(terrainGrid[i]);
    } else { kat('ARAZI-YOK'); }
    /* ⚠ Set'i diziye cevirmek: `[].slice.call(set)` BOS dizi doner (Set'te length/index yok).
       Ilk surumde tam bu yazildi ve isci hep '' uretti; sayfa gercek listeyi uretiyordu →
       arac "ARAZI FARKLI" diye YANLIS alarm verdi. Arazi aynıydı, OLCUM yanlisti. */
    if (typeof bridgeSet !== 'undefined' && bridgeSet) {
        kat('kopru');
        var kl = []; bridgeSet.forEach(function (x) { kl.push(String(x)); });
        kat(kl.sort().join('|'));
    }
    var sh = 2166136261 >>> 0;
    var kat2 = function (v) { var s = String(v); for (var i = 0; i < s.length; i++) { sh ^= s.charCodeAt(i); sh = (sh * 16777619) >>> 0; } };
    if (typeof STATS !== 'undefined' && STATS) {
        var ks = Object.keys(STATS).sort();
        for (var a = 0; a < ks.length; a++) {
            var st = STATS[ks[a]]; kat2(ks[a]);
            var f = Object.keys(st).sort();
            for (var b = 0; b < f.length; b++) { kat2(f[b]); kat2(st[f[b]]); }
        }
    }
    return {
        statsImza: (sh >>> 0).toString(16),
        degerAgi: (typeof battleValueNetHazir === 'function') ? !!battleValueNetHazir() : 'yok',
        politikaAgi: (typeof battlePolicyNetHazir === 'function') ? !!battlePolicyNetHazir() : 'yok',
        secici: (typeof battleSelectorModelHazir === 'function') ? !!battleSelectorModelHazir() : 'yok',
        beonai: (typeof battleBeonaiDurum === 'function') ? JSON.stringify(battleBeonaiDurum()) : 'yok',
        arazi: (h >>> 0).toString(16),
        dunya: (typeof WORLD_W !== 'undefined' ? WORLD_W : '?') + 'x' + (typeof WORLD_H !== 'undefined' ? WORLD_H : '?'),
        birimTipi: (typeof STATS !== 'undefined' && STATS) ? Object.keys(STATS).length : -1,
        motor: (typeof BATTLE_ENGINE_VERSION !== 'undefined') ? BATTLE_ENGINE_VERSION : '?',
        ayar: JSON.stringify(laWorkerAyarOku())
    };
}


/* BIRIM DOKUMU — sapan tik bulunduktan sonra "hangi birimin hangi ALANI" sorusunu
   cevaplar. battleStateHash'in birim bolumundeki alanlar + fork'un tasidigi ama
   hash'te OLMAYAN birkac alan (manualMoveTarget, _holdingPos, _laUntilTick): sapma
   hash'te gorunmeyen bir alandan basliyorsa oradan yakalanir. */
function laWorkerBirimDokumu() {
    var o = [];
    var us = SIM.units.filter(function (x) { return !x.dead; }).slice().sort(function (a, b) { return a.id - b.id; });
    for (var i = 0; i < us.length; i++) {
        var u = us[i];
        o.push([u.id, u.type, u.isRed ? 1 : 0, u.ally ? 1 : 0, u.controlOwner || '-', u.controllerId || '-',
            Math.round(u.x * 100), Math.round(u.y * 100), Math.round(u.hp * 100), Math.round((u.ammo || 0) * 100),
            Math.round((u.suppression || 0) * 100), u.isFleeing ? 1 : 0,
            (u.attackTarget && !u.attackTarget.dead) ? u.attackTarget.id : 0,
            Math.round((u.targetX || 0) * 100), Math.round((u.targetY || 0) * 100),
            u.operatorId != null ? u.operatorId : '-', u.payloadCount != null ? u.payloadCount : '-',
            Math.round(u._reloadTimer || 0), u._retired ? 1 : 0, u._refuelBaseKey || '-',
            u.manualMoveTarget ? (Math.round(u.manualMoveTarget.x * 100) + ',' + Math.round(u.manualMoveTarget.y * 100)) : '-',
            u.isMovingToManualTarget ? 1 : 0, u._holdingPos ? 1 : 0, u._laUntilTick | 0,
            Math.round((u.fuel || 0) * 100), u.combatState || '-', Math.round((u.panic || 0) * 100)]);
    }
    return o;
}

function laWorkerAra(m) {
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    /* AYAR ONCE, FORK SONRA: ayarlarin bir kismi fork geri yuklenirken okunabiliyor. */
    laWorkerAyarUygula(m.ayar);
    battleForkRestore(JSON.parse(m.fork));
    // Aramayı hangi tarafın kullandığı ana iş parçacığından gelir (canlıda değişebilir).
    BATTLE_LOOKAHEAD_RED = !!m.kirmizi;
    BATTLE_LOOKAHEAD_BLUE = !!m.mavi;
    if (typeof BATTLE_LA_EMIR_KORUMA !== 'undefined') BATTLE_LA_EMIR_KORUMA = m.koruma | 0;
    /* TAM AYAR — işçinin VARLIK SEBEBİ bu. Ana iş parçacığındaki kısılmış ayar
       (ufuk 50 / derin 1 / birim 8) donmayı önlemek içindi; burada donacak bir kare yok.
       Bu beş değer ana taraftan GELMEZ (ayar listesinde yoklar) — gelselerdi işçi de
       kısılırdı ve worker'ın tek amacı boşa giderdi. Değerler +735'in ölçüldüğü
       konfigürasyonun ta kendisi (tezgâh varsayılanları). */
    /* ⭐ UFUK 100 -> 200 (2026-08-19 — KANITLANDI, tek satirlik kazanc)
         · H3 tek basina : n=128  fark +874  t 3.13  · saptama tabani 783  -> TABANIN USTUNDE
         · D + H3 havuz  : n=256  fark +603  t 3.13  · saptama tabani 540  -> TABANIN USTUNDE
       Tohumlar AYRIK (D 100000..100127 · H3 109000..109127) — ayni mac iki kez sayilmadi.
       D tek basina ANLAMLI DEGILDI (+357, t 1.34); karari veren onceden kararlastirilmis
       TEKRAR'dir, havuz yalnizca onu guclendirir. Galibiyet: saldiran %50.0 -> %63.3.

       NEDEN BURADA, ana iplikte DEGIL: ufku iki katina cikarmak rollout maliyetini de iki
       katina cikarir. Ana iplikte bu DONMA demektir (worker oncesi tur 4432ms olculmustu).
       Isci ayri bir iplikte kostugu icin donacak kare yok. Yani worker kapasiteyi acti;
       kazanci veren, o kapasiteyi KULLANAN bu satirdir — gecenin bes "kucuk duzeltme"
       denemesinin hepsi tabanin altinda kaldi, kaldirac aramada cikti.

       BEDELIN IKINCI YARISI (olculdu, 2026-08-19): kopru ongoru penceresini OLCULEN tur
       suresinden turetiyor (battleLaWorkerPencere: ceil(ms/50)+20, alt 40 ust 200, sonra
       periyoda hizalanir). Yani pencere ancak ORTALAMA TUR 4.0 SANIYEYI asarsa 100 -> 200
       tike cikar ve o zaman emir 5sn degil 10sn ileriden verilir (sapma buyur).
       Kullanicinin gercek maclarinda tur 194-491ms olculdu; ufuk 200 ile ~306-776ms
       beklenir, yani esige 5-13 kat marj var. AMA yuklu bir makinede bu esik ASILIR:
       gece kuyrugu koserken ayni kapida tur 10433ms cikti ve pencere gercekten 200'e
       tirmandi. Bu bir kusur DEGIL (yavas isci icin daha uzun tampon dogrudur), ama
       ufuk 200'un yavas makinede ikinci bir bedeli oldugu bilinsin. */
    /* ⭐ TAM GUC (2026-08-19, kullanici karari: "tam gucte calissin"). Her iki knob da
       AYRI AYRI kapidan gecti — ikisi de "canli butceye sigmadigi icin kisilmis" ayarlardi
       ve worker o butceyi kaldirdi:
         LA_UFUK 100->200 : havuz n=256  +603  t 3.13  taban 540
         LA_UFUK 200->300 : n=128        +980  t 3.39  taban 810   (H4)
         LA_DERIN 2->5    : havuz n=256  +607  t 3.15  taban 540   (H1+H1b)
       ⚠ TOPLANMA VARSAYILMADI: bu depoda demet etkileri toplanmamisti. Ikisinin BIRLIKTE
       yalniz-ufuk-300'u gectigi ayri bir kapiyla sinaniyor; gecmezse ucuz olan tutulur. */
    LA_UFUK = 300; LA_DERIN = 5; LA_TIK_BIRIM = 0; LA_BIRIM = 20; LA_TUR_BIRIM = 0;

    var s = m.now;
    /* ⭐ İLERİ SARMA PERİYOT SINIRINA HİZALANIR — YOKSA ARAMA HİÇ KOŞMAZ.
       KUSUR (kullanıcının gerçek maçında bulundu, 2026-08-18): `battleLookaheadTick`
       yalnız `SIM.tick % LA_PERIYOT_TIK === 0` anında karar verir. Köprü ise öngörü
       penceresini ÖLÇÜLEN tur süresinden türetiyor (40, 49, 107 tik...). Hedef tik
       periyoda denk gelmeyince fonksiyon hemen dönüyor ve tur BOŞ bitiyordu.
       Gerçek maçta bu şöyle göründü: ilk tur `ileri=100` ile tesadüfen hizalı (6 emir),
       sonraki 44 tur SESSİZCE boş — worker açık, hata yok, ama arama YOK.
       En kötü türden sessiz başarısızlık: her sayaç yeşil, iş yapılmıyor.

       Hizalama İŞÇİDE yapılır, köprüde değil: `LA_PERIYOT_TIK` burada kesin bilinir ve
       köprünün hesabı ne olursa olsun sonuç doğru olur. Kullanılan gerçek değer köprüye
       geri bildirilir ki hedef tik (emrin ineceği an) doğru hesaplansın. */
    var periyot = (typeof LA_PERIYOT_TIK !== 'undefined' && LA_PERIYOT_TIK > 0) ? LA_PERIYOT_TIK : 100;
    var ileri = Math.max(0, m.ileri | 0);
    var kalan = (SIM.tick + ileri) % periyot;
    if (kalan !== 0) ileri += (periyot - kalan);          // bir sonraki karar anına kadar sar
    var izler = [], dokum = null;
    for (var i = 0; i < ileri; i++) {
        s += BATTLE_TICK_MS;
        stepSim(s, BATTLE_TICK_SEC, battleControllersDrive, false);
        if (typeof updateSupport === 'function') updateSupport(BATTLE_TICK_SEC, s);
        if (m.izle) izler.push(battleStateHash() + '|' + (typeof battleStateHashParts === 'function' ? Object.values(battleStateHashParts()).join('.') : ''));
        if (m.dokumIx === i) dokum = laWorkerBirimDokumu();
    }
    /* ÖNGÖRÜ HASH'İ: köprü bunu, emir indiğinde ana iş parçacığının gerçek hash'iyle
       KARŞILAŞTIRIR. Tutmazsa öngörü sapmıştır (oyuncu girdisi) ve sayaç artar —
       worker sessizce yanlış emir vermez, ölçülür. */
    var ongoruHash = (typeof battleStateHash === 'function') ? battleStateHash() : null;
    /* PARÇA HASH'İ de gönderilir: öngörü tutmazsa "hangi bölüm" sorusu TAHMİNLE değil
       ÖLÇÜMLE cevaplanır (g=global b=maç u=birim t=siper/mayın s=destek/bekleyen).
       Bu gece aynı ders üç kez alındı: kontrolü koşmayan teşhis yanıltıyor. */
    var ongoruParca = (typeof battleStateHashParts === 'function') ? battleStateHashParts() : null;
    /* ÖNGÖRÜNÜN BÜYÜKLÜK ÖLÇÜSÜ — hash YETMEZ.
       KUSUR (kendi raporumda, 2026-08-18): "öngörü sapması 52/54" diye rapor ettim ve
       bundan "işçinin öngördüğü dünya neredeyse hiç gerçekleşmiyor" sonucunu çıkardım.
       Yanlış çıkarım: `battleStateHash` TAM EŞİTLİK arar; insan oynarken tek bir birimin
       konumu 0.01px kayınca hash tutmaz. Yani o sayı sapmanın BÜYÜKLÜĞÜNÜ değil, sadece
       "birebir aynı değil"i ölçüyordu — ve bir insan varken bu neredeyse garanti.
       Burada öngörülen dünyanın birim parmak izi de gönderilir; köprü hedef tikte gerçek
       dünyayla karşılaştırıp KAÇ PİKSEL saptığını ölçer. Karar buna göre verilir. */
    var ongoruBirim = [];
    for (var _i = 0; _i < SIM.units.length; _i++) {
        var _u = SIM.units[_i];
        if (_u.dead) continue;
        ongoruBirim.push([_u.id, Math.round(_u.x), Math.round(_u.y), Math.round(_u.hp)]);
    }

    LA_W_EMIRLER = [];
    var kararAni = (SIM.tick % periyot) === 0;   // hizalama tuttu mu (kapi icin)
    /* ARANAN BIRIM SAYISI: "isci tam ayarla mi kostu" sorusunu ham kayit KENDI cevaplasin.
       Telemetri ana ipligin LA_* degerlerini yaziyor ve onlar KISILMIS (ufuk 50/derin 1/
       birim 8) — isci onlari EZIYOR ama bu hicbir yere yazilmiyordu. Yani "worker tam
       gucte mi" sorusu ham kayittan cevaplanamiyordu; ancak koda bakarak varsayilabilirdi.
       BATTLE_LA_SAYAC.arananan farkini almak, gercekten kac birim icin rollout kosuldugunu
       verir (atlanan = yayilim kapisina takilanlar). */
    var _s0 = (typeof BATTLE_LA_SAYAC !== 'undefined')
        ? { aranan: BATTLE_LA_SAYAC.arananan | 0, atlanan: BATTLE_LA_SAYAC.atlanan | 0 } : null;
    battleLookaheadTick(s);
    var _s1 = (typeof BATTLE_LA_SAYAC !== 'undefined')
        ? { aranan: BATTLE_LA_SAYAC.arananan | 0, atlanan: BATTLE_LA_SAYAC.atlanan | 0 } : null;
    var t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    return { emirler: LA_W_EMIRLER.slice(), ongoruHash: ongoruHash, ongoruParca: ongoruParca,
        ayarSonra: laWorkerAyarOku(), izler: izler, dokum: dokum,
        gercekIleri: ileri, kararAni: kararAni, tik: SIM.tick,
        /* ISCININ GERCEKTEN KULLANDIGI AYAR — ana ipligin degil. */
        ongoruBirim: ongoruBirim,
        ayarKullanilan: { ufuk: LA_UFUK, derin: LA_DERIN, birim: LA_BIRIM,
                          turBirim: LA_TUR_BIRIM, tikBirim: LA_TIK_BIRIM, periyot: periyot },
        aranan: (_s0 && _s1) ? (_s1.aranan - _s0.aranan) : null,
        atlanan: (_s0 && _s1) ? (_s1.atlanan - _s0.atlanan) : null,
        sure: Math.round(t1 - t0) };
}

self.onmessage = function (ev) {
    var m = ev.data || {};
    try {
        if (m.tip === 'kur') { laWorkerKur(m.oturum || {}); self.postMessage({ tip: 'hazir', imza: laWorkerParmakIzi() }); return; }
        if (m.tip === 'ara') {
            if (!LA_W_HAZIR) { self.postMessage({ tip: 'hata', id: m.id, mesaj: 'isci HAZIR degil' }); return; }
            var r = laWorkerAra(m);
            self.postMessage({ tip: 'emir', id: m.id, emirler: r.emirler, ongoruHash: r.ongoruHash, ongoruParca: r.ongoruParca, ayarSonra: r.ayarSonra, izler: r.izler, dokum: r.dokum,
                gercekIleri: r.gercekIleri, kararAni: r.kararAni,
                ayarKullanilan: r.ayarKullanilan, aranan: r.aranan, atlanan: r.atlanan,
                ongoruBirim: r.ongoruBirim,
                sure: r.sure });
        }
    } catch (e) {
        self.postMessage({ tip: 'hata', id: m.id, mesaj: String(e && e.message || e) });
    }
};
