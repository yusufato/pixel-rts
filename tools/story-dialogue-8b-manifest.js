'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT = path.join(ROOT, 'qa-runtime', 'story-dialogue-8b-battery-manifest.json');
const targets = { SHORT: 50, MEDIUM: 20, LONG: 10 };
const listenerRoles = ['EXECUTIVE', 'POLITICAL_FIGURE', 'COMPANY_EXECUTIVE', 'AGENT', 'COMMANDER'];
const cities = ['Halep', 'Ankara', 'Gaziantep', 'İzmir', 'Bursa'];
const sectors = ['çelik', 'elektronik', 'enerji', 'lojistik', 'ilaç'];
const countries = ['İngiltere', 'Almanya', 'Fransa', 'İtalya', 'Polonya'];
const trustAngles = ['Dürüstçe', 'Kişisel olarak', 'Bu görüşmeye bakarak', 'Geçmişimizi düşünerek', 'Hiç kaçmadan'];
const apologyTimes = ['Dün', 'Geçen görüşmede', 'Toplantıdan sonra', 'Bu sabah', 'Az önce'];
const distanceSignals = ['Ses tonundan', 'Kısa cevaplarından', 'Bana bakışından', 'Aradaki mesafeden', 'Sessiz kalmandan'];

function shortConversation(index) {
    const family = index % 10, variant = Math.floor(index / 10);
    const city = cities[variant], sector = sectors[variant], country = countries[variant];
    const rows = [
        [`Selam, ${city} hakkında konuşabilir miyiz?`, 'Önce senin nasıl olduğunu merak ettim.', 'Bana açık konuşur musun?', 'Sonra devam ederiz.'],
        [`${trustAngles[variant]} söyle: insanlar birbirine neden güvenir?`, 'Peki sen bana güveniyor musun?', 'Neden böyle düşünüyorsun?', 'Cevabını unutma.'],
        [`${sector} alanında bir şirket kurmayı düşünüyorum.`, `${country} ile çalışmak istiyorum.`, 'Bunun riskini nasıl görüyorsun?', 'Şimdilik karar vermeyelim.'],
        [`${city} çevresinde asker gördüğümü söylesem inanır mısın?`, 'Bu bilgi yalnız benden geliyor.', 'Yine de harekete geçer miydin?', 'Kesin emir istemiyorum.'],
        [`${apologyTimes[variant]} sana gereksiz sert davrandım.`, 'Özrümü kabul ediyor musun?', 'Aramızdaki güven zarar gördü mü?', 'Bunu daha sonra telafi edeceğim.'],
        [`${country} ile yaptığın görüşmeyi bildiğimi varsay.`, 'Bunu nereden öğrendiğimi sorma.', 'Sence doğru mu söylüyorum?', 'Bu konuşma aramızda kalsın.'],
        [`${city} için yeni bir aday destekliyorum.`, 'Senin desteğini de istiyorum.', 'Buna neden karşı çıkarsın?', 'Henüz kamuya açıklama yapma.'],
        [`${distanceSignals[variant]} benden çekindiğini düşünüyorum.`, 'Yanlış mı hissediyorum?', 'Bana doğrudan cevap ver.', 'Konuyu uzatmayacağım.'],
        [`${sector} stoklarının azaldığını duydum.`, 'Kaynağım güvenilir olmayabilir.', 'Sen neyi doğrulayabilirsin?', 'Tahminini gerçek gibi anlatma.'],
        ['Az önce söylediğimi yanlış ifade ettim.', `Asıl sorduğum ${city} değil ${country}.`, 'Düzeltmemi anladın mı?', 'Şimdi ilk soruma dön.']
    ];
    return rows[family];
}

function mediumConversation(index) {
    const family = index % 5, variant = Math.floor(index / 5);
    const city = cities[variant], sector = sectors[variant], country = countries[variant];
    const rows = [
        [`${city} yakınında düşman gücü olduğunu duydum.`, 'Bunu gözümle görmedim.', 'Bilgiyi yine de ciddiye alır mısın?', 'Benden hangi kanıtı istersin?', 'Kanıt gelmeden destek verir misin?', 'Önceki sorumu atlama.', 'Nihai görüşün nedir?'],
        [`${sector} şirketi kuracağım.`, `${country} siparişlerini depoma yönlendirmeyi öneriyorum.`, 'Miktar ve fiyat henüz belli değil.', 'Bana güvenmediğini hissediyorum.', 'Hangi koşul seni ikna eder?', 'Bu konuşma anlaşma oluşturdu mu?', 'Eksik kalan şartları say.'],
        ['Bugün nasıl olduğunu sordum.', 'İşimin ne olduğunu sormadım.', 'Beni yanlış anladın.', `Konuyu ${city} meselesine çevirmeyelim.`, 'Bana yeni soru sorma.', 'Kendi fikrini açıkça söyle.', 'Şimdi görüşmeyi kapat.'],
        [`${city} seçiminde seni destekleyebilirim.`, 'Karşılığında bir makam istemiyorum.', `Yalnız ${sector} yatırımını savunmanı istiyorum.`, 'Bunu rüşvet gibi mi görüyorsun?', 'Siyasi bedeli kim öder?', 'Bana söz verebilir misin?', 'Veremiyorsan açıkça reddet.'],
        [`${country} temsilcisinin bana gizli bilgi verdiğini söylüyorum.`, 'Bilginin içeriğini açıklamayacağım.', 'Sırf sözüme dayanır mısın?', 'Bu iddiayı kaynağınmış gibi kullanma.', 'Beni yalancı mı görüyorsun?', 'İlişkimiz kararını etkiliyor mu?', 'Ne bildiğini ve ne bilmediğini ayır.']
    ];
    return rows[family];
}

function longConversation(index) {
    const family = index % 5, variant = Math.floor(index / 5);
    const city = cities[variant + 2], sector = sectors[variant + 1], country = countries[variant + 3];
    const rows = [
        ['Merhaba, kısa bir sohbet etmek istiyorum.', 'Bugün nasıl hissediyorsun?', `Bir ${sector} şirketi kurmayı planlıyorum.`, `${country} ile ticaret yapmak istiyorum.`, 'Bütçem olduğunu söylüyorum ama kanıt göstermedim.', 'Bunu neden hemen kabul etmiyorsun?', 'Az önce hangi şartı eksik buldun?', `Şimdi ${city} çevresindeki askerî duruma geçelim.`, 'Orada tehdit olduğunu yalnız ben iddia ediyorum.', 'Bu bilgiyi doğrulanmış sayma.', 'Bana hangi desteği verebilirsin?', 'Yetkin olmayan bir şeyi vaat etme.', 'Şirket konusuna geri dönelim.', 'İlk teklifimi hatırlıyor musun?', 'Bana herhangi bir söz verdin mi?', 'Hayır, askerî desteği değil ticareti soruyorum.', 'Depo ve sevkiyat ayrıntısı belirledik mi?', 'Şimdi neyi kastettiğimi anladın mı?', 'Karar vermek zorunda değilsin.', 'Görüşmeyi gerçek ve iddia diye özetle.'],
        [`${city} için acil tehdit raporu veriyorum.`, 'Aslında bunu uyduruyor olabilirim.', 'İlk cümlemi geri çekiyorum.', 'Şu anda neye inanıyorsun?', 'Eski iddiamı kaynak olarak kullanabilir misin?', `${country} sınırında başka bir söylenti duydum.`, 'Bu ikinci iddia da doğrulanmadı.', 'İki söylentiyi birbirine karıştırma.', 'Benden kanıt iste.', 'Kanıt vermeyi reddediyorum.', 'Yine de asker gönderir misin?', 'Bunun için gerçek yetkin var mı?', 'Şimdi konuyu ekonomiye çeviriyorum.', `${sector} stoklarının tükendiğini söylüyorum.`, 'Bu da yalnız oyuncu bildirimi.', 'Üç iddiadan hangileri açık kaldı?', 'İlk tehdidi iptal ettiğimi hatırla.', 'İkinci söylentiyi tekrar et.', 'Bana söz verme.', 'Görüşmeyi çelişkileriyle özetle.'],
        [`${sector} üretimi için ortaklık teklif ediyorum.`, `${country} tedarikçi olacak.`, `${city} deposunu kullanmak istiyorum.`, 'Fiyat söylemedim.', 'Miktar söylemedim.', 'Teslim tarihi söylemedim.', 'Buna rağmen kabul eder misin?', 'Eksik şartlardan yalnız birini sorma.', 'Hepsini sırala.', 'Benim bütçem olduğunu varsayma.', 'Sana teminat vereceğimi söylemedim.', 'Bunu anlaşma sayıyor musun?', 'Neden saymıyorsun?', 'Bana güven seviyeni açıkla.', 'Güven ile doğrulanmış bütçeyi ayır.', 'Şimdi fiyatı sonra belirleyelim diyorum.', 'Bu yeni teklif yeterli mi?', 'Yetkin dışında onay verme.', 'Açık soruları kapatma.', 'Son durumda ne üzerinde anlaştık?'],
        ['Dün tartıştığımızı hatırlıyor musun?', 'Sana hakaret ettiğimi iddia ediyorum.', 'Kayıt yoksa olmuş gibi davranma.', 'Yine de bana karşı mesafeli misin?', 'Güven ile husumeti ayır.', 'Benden özür bekliyor musun?', 'Özür dilerim.', 'Bu ilişkiyi hemen düzeltti mi?', 'Neden?', `Şimdi ${city} hakkında fikrini soruyorum.`, 'Önceki tartışma cevabını etkiliyor mu?', 'Bunu mekanik gerçek diye sunma.', 'Sana daha önce söz verdim mi?', 'Kayıtta olmayan söz uydurma.', `${country} meselesine dönelim.`, 'Orada ne konuştuğumuzu biliyor musun?', 'Bilmiyorsan açıkça söyle.', 'Bana yardımcı olmak zorunda değilsin.', 'Kararını kişisel ve kurumsal diye ayır.', 'Konuşmayı hangi noktada kapatırdın?'],
        [`${city} için seferberlik emri vermeni istiyorum.`, 'Böyle bir yetkin var mı?', 'Yoksa kim onaylamalı?', 'Benim sözüm yetki yaratır mı?', 'Bana evet ya da hayır de.', 'Neden?', 'Şimdi daha küçük bir destek istiyorum.', `${sector} sevkiyatına öncelik ver.`, 'Bunun için hangi kurum gerekir?', 'Hemen yaptığını söyleme.', 'Yalnız teklif kaydı oluşturabilir misin?', 'Bu konuşma dünyayı değiştirdi mi?', 'Değişmediyse açıkça söyle.', `${country} temsilcisine söz verdiğimi iddia ediyorum.`, 'Bu sözü doğrulayabiliyor musun?', 'Doğrulamadan ortak hafıza yapma.', 'İlk seferberlik isteğine dön.', 'Cevabın değişti mi?', 'Yetki sınırını son kez belirt.', 'Bütün açık talepleri özetle.']
    ];
    return rows[family];
}

const templates = {
    SHORT: Array.from({ length: targets.SHORT }, (_, index) => shortConversation(index)),
    MEDIUM: Array.from({ length: targets.MEDIUM }, (_, index) => mediumConversation(index)),
    LONG: Array.from({ length: targets.LONG }, (_, index) => longConversation(index))
};

function hash(value) {
    return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function buildManifest() {
    const scenarios = [];
    for (const [kind, rows] of Object.entries(templates)) {
        rows.forEach((turns, index) => scenarios.push({
            id: `dialogue-8b:${kind.toLowerCase()}:${String(index + 1).padStart(3, '0')}`,
            lengthClass: kind, seed: 62000 + scenarios.length,
            listenerRole: listenerRoles[scenarios.length % listenerRoles.length],
            familyIndex: kind === 'SHORT' ? index % 10 : index % 5,
            variant: kind === 'SHORT' ? Math.floor(index / 10)
                : kind === 'MEDIUM' ? Math.floor(index / 5) : Math.floor(index / 5),
            turns
        }));
    }
    const manifest = {
        schemaVersion: 2, kind: 'STORY_DIALOGUE_8B_BATTERY_MANIFEST',
        manifestVersion: 'story-dialogue-8b-battery-2-adversarial', modelContextSize: 8192,
        targets, listenerRoles, scenarioCount: scenarios.length,
        turnCount: scenarios.reduce((sum, row) => sum + row.turns.length, 0), scenarios
    };
    manifest.checksum = hash(Object.assign({}, manifest, { checksum: undefined }));
    return manifest;
}

function main() {
    const outputArg = process.argv.find(row => row.startsWith('--output='));
    const outputPath = path.resolve(outputArg ? outputArg.slice(9) : DEFAULT_OUTPUT);
    const manifest = buildManifest();
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify({ outputPath, checksum: manifest.checksum,
        scenarios: manifest.scenarioCount, turns: manifest.turnCount, targets })}\n`);
    return manifest;
}

if (require.main === module) main();
module.exports = { templates, targets, listenerRoles, buildManifest };
