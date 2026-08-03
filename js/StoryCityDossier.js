// ═══════════════════════════════════════════════════════════════════════════
//  ŞEHİR DOSYASI — Faz 14.1
//  ---------------------------------------------------------------------------
//  Bu UI ham STORY.nodes veya StoryWorldStateV2 değerlerini doğrudan çizmez.
//  Görünen bütün bölge/karakter gerçekleri PlayerKnowledge üzerinden geçer.
//  UNKNOWN bilgi null kalır; "0" gibi sahte bir kesinlik üretilmez.
//
//  Kapsam sınırı:
//   • mevcut şehir üretim/bina/garnizon işlemleri yalnız oyuncunun şehrinde;
//   • yabancı şehir salt-okunur ve gizli idari/askerî değerleri göstermez;
//   • şirket/tesis/banka verisi bilgi filtresinden geçer; yerel kurum ve
//     doğrudan karakter görüşmesi henüz simüle edilmez.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_CITY_DOSSIER_SCHEMA_VERSION = 1;
const STORY_CITY_DOSSIER_TABS = Object.freeze([
    'genel', 'nufus', 'tarih', 'karakterler', 'binalar', 'ordu'
]);
const STORY_ECONOMY_TABS = Object.freeze([
    'genel', 'butce', 'sirketler', 'piyasa', 'lojistik', 'fraksiyonlar'
]);
const STORY_CITY_MODE_META = Object.freeze({
    LAND: { icon: '↔', label: 'KARA' },
    SEA: { icon: '≈', label: 'DENİZ' },
    ENERGY: { icon: 'ϟ', label: 'ENERJİ' },
    DATA: { icon: '⌁', label: 'VERİ' }
});

function storyCityDossierEnabled() {
    return typeof storyFeatureEnabled !== 'function' || storyFeatureEnabled('ui.cityDossier');
}

function storyCityDossierEscape(value) {
    if (typeof storyProjectionEscape === 'function') return storyProjectionEscape(value);
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function storyCityDossierClone(value) {
    if (typeof storyWorldV2Clone === 'function') return storyWorldV2Clone(value);
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyCityDossierLegacyId(regionId) {
    const match = /^region:(-?\d+)$/.exec(String(regionId || ''));
    return match ? Number(match[1]) : null;
}

function storyCityDossierFactCopy(fact) {
    if (!fact) return null;
    return {
        id: String(fact.id),
        subjectId: String(fact.subjectId),
        field: String(fact.field),
        value: fact.status === PLAYER_FACT_STATUS.UNKNOWN ? null : storyCityDossierClone(fact.value),
        status: String(fact.status),
        confidenceBps: Number(fact.confidenceBps) || 0,
        sourceType: String(fact.source && fact.source.type || 'UNKNOWN'),
        observedAt: Number(fact.observedAt) || 0
    };
}

function storyCityDossierCountryName(knowledge, countryId) {
    const country = (knowledge.countries || []).find(candidate => candidate.id === countryId);
    return country && country.name && country.name.value != null
        ? String(country.name.value)
        : 'Sahipsiz';
}

function storyCityDossierCollectHistory(regionId) {
    if (typeof storyPlayerProjectionCurrent !== 'function') return [];
    try {
        const projection = storyPlayerProjectionCurrent({ maxItems: 200, recentSeconds: 600 });
        return (projection.items || [])
            .filter(item => item.subjectId === regionId)
            .map(item => ({
                id: String(item.id),
                observedAt: Number(item.observedAt) || 0,
                subjectName: String(item.subjectName || ''),
                label: String(item.label || ''),
                domain: String(item.domain || ''),
                direction: String(item.direction || 'CHANGED'),
                badgeText: String(item.badge && item.badge.text || item.label || ''),
                precision: String(item.precision || 'OPAQUE'),
                causeSteps: item.cause && Array.isArray(item.cause.steps)
                    ? item.cause.steps.map(step => String(step.label || '')).filter(Boolean)
                    : []
            }));
    } catch (_error) {
        return [];
    }
}

function storyCityDossierCorridors(regionId, logisticsFact, world) {
    if (!logisticsFact || logisticsFact.status !== PLAYER_FACT_STATUS.VERIFIED
        || !logisticsFact.value || !Array.isArray(logisticsFact.value.corridorIds)
        || typeof storyInfrastructureSnapshot !== 'function') return [];
    const knownIds = new Set(logisticsFact.value.corridorIds.map(String));
    const regionNames = new Map((world.regions || []).map(region => [region.id, String(region.name || region.id)]));
    const snapshot = storyInfrastructureSnapshot();
    if (!snapshot || snapshot.disabled) return [];
    return (snapshot.corridors || [])
        .filter(corridor => knownIds.has(String(corridor.id))
            && (corridor.endpointRegionIds || []).includes(regionId))
        .map(corridor => {
            const destinationRegionId = (corridor.endpointRegionIds || []).find(id => id !== regionId) || null;
            return {
                id: String(corridor.id),
                mode: String(corridor.mode),
                destinationRegionId,
                destinationName: regionNames.get(destinationRegionId) || 'Bilinmeyen bağlantı',
                status: String(corridor.status || 'BLOCKED'),
                effectiveCapacity: Math.max(0, Number(corridor.effectiveCapacity) || 0),
                damageBps: Math.max(0, Math.min(10000, Number(corridor.damageBps) || 0)),
                latencySeconds: Math.max(0, Number(corridor.latencySeconds) || 0)
            };
        })
        .sort((a, b) => a.mode.localeCompare(b.mode)
            || a.destinationName.localeCompare(b.destinationName, 'tr'));
}

function storyCityDossierBuild(nodeId) {
    if (!storyCityDossierEnabled()) {
        return { schemaVersion: STORY_CITY_DOSSIER_SCHEMA_VERSION, disabled: true };
    }
    const legacyId = Number(nodeId);
    if (!Number.isInteger(legacyId)) throw new Error('Şehir dosyası için geçerli düğüm kimliği zorunlu.');
    const world = storyWorldV2ExportValidated();
    const playerCountryId = storyWorldV2CountryId(STORY.playerStateId);
    const knowledge = storyPlayerKnowledgeProject(world, playerCountryId);
    const regionId = storyWorldV2RegionId(legacyId);
    const worldRegion = (world.regions || []).find(region => region.id === regionId);
    const region = (knowledge.regions || []).find(candidate => candidate.id === regionId);
    if (!worldRegion || !region) throw new Error(`Şehir dosyası bölgesi bulunamadı: ${regionId}`);

    const ownerId = region.ownerId.value;
    const isOwn = ownerId === playerCountryId;
    const facts = {};
    for (const field of [
        'name', 'ownerId', 'neighborIds', 'level', 'garrison', 'infrastructure',
        'population', 'populationCohorts', 'needsWelfare', 'publicOpinion', 'collectiveAction', 'wealth', 'deposits', 'stocks', 'trade', 'market', 'companyEconomy', 'logistics'
    ]) facts[field] = storyCityDossierFactCopy(region[field]);
    const ownerCountry = (knowledge.countries || []).find(candidate => candidate.id === ownerId);
    facts.budget = storyCityDossierFactCopy(ownerCountry && ownerCountry.budget);
    facts.countryCompanies = storyCityDossierFactCopy(ownerCountry && ownerCountry.companyEconomy);
    facts.economicPolicy = storyCityDossierFactCopy(ownerCountry && ownerCountry.economicPolicy);

    const characters = (knowledge.characters || [])
        .filter(character => character.regionId
            && character.regionId.status !== PLAYER_FACT_STATUS.UNKNOWN
            && character.regionId.value === regionId)
        .map(character => ({
            id: String(character.id),
            name: storyCityDossierFactCopy(character.name),
            role: storyCityDossierFactCopy(character.role),
            loyalty: storyCityDossierFactCopy(character.loyalty),
            skills: storyCityDossierFactCopy(character.skills)
        }));

    const neighborIds = Array.isArray(facts.neighborIds.value) ? facts.neighborIds.value : [];
    const publicRegions = new Map((knowledge.regions || []).map(candidate => [
        candidate.id,
        {
            id: candidate.id,
            legacyId: storyCityDossierLegacyId(candidate.id),
            name: candidate.name.value,
            ownerId: candidate.ownerId.value
        }
    ]));

    const view = {
        schemaVersion: STORY_CITY_DOSSIER_SCHEMA_VERSION,
        disabled: false,
        generatedAt: Number(world.clock.gameTime) || 0,
        regionId,
        legacyId,
        playerCountryId,
        ownerId,
        ownerName: storyCityDossierCountryName(knowledge, ownerId),
        isOwn,
        facts,
        neighbors: neighborIds.map(id => publicRegions.get(id)).filter(Boolean),
        corridors: storyCityDossierCorridors(regionId, facts.logistics, world),
        history: storyCityDossierCollectHistory(regionId),
        characters,
        missingSystems: [
            { id: 'institutions', label: 'YEREL KURUMLAR', status: 'NOT_IMPLEMENTED' }
        ]
    };
    const validation = storyCityDossierValidate(view);
    if (!validation.ok) throw new Error(`Geçersiz şehir dosyası: ${validation.issues[0].code}`);
    return view;
}

function storyCityDossierValidate(view) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!view || typeof view !== 'object' || Array.isArray(view)) {
        return { ok: false, issues: [{ code: 'VIEW_REQUIRED', path: '$', message: 'Şehir dosyası nesnesi zorunlu.' }] };
    }
    if (view.schemaVersion !== STORY_CITY_DOSSIER_SCHEMA_VERSION) {
        add('SCHEMA_VERSION', '$.schemaVersion', 'Şehir dosyası sürümü uyuşmuyor.');
    }
    if (view.disabled) return { ok: issues.length === 0, issues };
    if (!/^region:-?\d+$/.test(String(view.regionId || ''))) add('REGION_ID', '$.regionId', 'Kalıcı bölge kimliği geçersiz.');
    if (!view.facts || typeof view.facts !== 'object') add('FACTS_REQUIRED', '$.facts', 'Bilgi görünümü zorunlu.');
    else {
        for (const [field, fact] of Object.entries(view.facts)) {
            const at = `$.facts.${field}`;
            if (!fact || typeof fact !== 'object') {
                add('FACT_REQUIRED', at, 'Alan PlayerVisibleFact taşımalı.');
                continue;
            }
            if (!Object.values(PLAYER_FACT_STATUS).includes(fact.status)) add('FACT_STATUS', `${at}.status`, 'Bilgi sınıfı geçersiz.');
            if (fact.status === PLAYER_FACT_STATUS.UNKNOWN && fact.value !== null) {
                add('UNKNOWN_VALUE_LEAK', `${at}.value`, 'Bilinmeyen şehir bilgisi değer taşıyamaz.');
            }
        }
    }
    if (!view.isOwn) {
        for (const field of ['level', 'garrison', 'infrastructure', 'population', 'populationCohorts', 'needsWelfare', 'publicOpinion', 'wealth', 'deposits', 'trade', 'market', 'logistics', 'budget']) {
            const fact = view.facts && view.facts[field];
            if (!fact || fact.status !== PLAYER_FACT_STATUS.UNKNOWN || fact.value !== null) {
                add('FOREIGN_SECRET_LEAK', `$.facts.${field}`, `Yabancı ${field} bilgisi gizli kalmalı.`);
            }
        }
        if ((view.corridors || []).length) add('FOREIGN_LOGISTICS_LEAK', '$.corridors', 'Yabancı lojistik ayrıntısı gösterilemez.');
        if ((view.characters || []).length) add('FOREIGN_CHARACTER_LOCATION_LEAK', '$.characters', 'Bilinmeyen yabancı karakter konumu gösterilemez.');
        const collective = view.facts && view.facts.collectiveAction;
        const collectiveText = collective && collective.value ? JSON.stringify(collective.value) : '';
        if (/mobilizationBps|radicalizationBps|organizationBps|suppressionMemoryBps/.test(collectiveText)) {
            add('FOREIGN_COLLECTIVE_INTELLIGENCE_LEAK', '$.facts.collectiveAction', 'Yabancı hareketin gizli örgütlenme/radikalleşme ölçüleri sızamaz.');
        }
    }
    if (!Array.isArray(view.missingSystems)
        || view.missingSystems.some(item => item.status !== 'NOT_IMPLEMENTED')) {
        add('MISSING_SYSTEM_STATUS', '$.missingSystems', 'Eksik sistemler açık NOT_IMPLEMENTED durumu taşımalı.');
    }
    return { ok: issues.length === 0, issues };
}

function storyCityDossierFactValue(fact, formatter) {
    if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN) {
        return '<span class="city-unknown">BİLGİ YOK</span>';
    }
    const value = formatter ? formatter(fact.value) : fact.value;
    return `<b>${storyCityDossierEscape(value)}</b>`;
}

function storyCityDossierNumber(value) {
    const number = Number(value);
    return Number.isFinite(number)
        ? (Math.abs(number) >= 100
            ? Math.round(number).toLocaleString('tr-TR')
            : Number(number.toFixed(1)).toLocaleString('tr-TR'))
        : '—';
}

function storyCityDossierTabs(view, active) {
    const tabs = [
        ['genel', 'GENEL'],
        ['nufus', 'NÜFUS'],
        ['tarih', 'TARİH'],
        ['karakterler', 'KARAKTERLER']
    ];
    if (view.isOwn) tabs.push(['binalar', 'BİNALAR'], ['ordu', 'ORDU']);
    return `<div class="city-dossier-tabs" role="tablist" aria-label="Şehir dosyası bölümleri">`
        + tabs.map(([id, label]) => `<button class="cb-sub${active === id ? ' active' : ''}" data-sub="${id}" role="tab" aria-selected="${active === id ? 'true' : 'false'}">${label}</button>`).join('')
        + `</div>`;
}

function storyCityDossierHeader(view, active) {
    const ownership = view.isOwn ? 'KENDİ YÖNETİMİN' : 'YABANCI BÖLGE';
    const neighbors = view.neighbors.map(region => (
        `<button class="city-chip city-route" data-region="${storyCityDossierEscape(region.id)}">${storyCityDossierEscape(region.name)}</button>`
    )).join('');
    return `<section class="city-dossier-head">`
        + `<div class="city-dossier-kicker">${ownership} · ${storyCityDossierEscape(view.ownerName)}</div>`
        + `<div class="city-dossier-name">${storyCityDossierEscape(view.facts.name.value)}</div>`
        + `<div class="city-dossier-source">${view.isOwn ? 'DOĞRULANMIŞ YÖNETİM KAYDI' : 'YALNIZ KAMUYA AÇIK HARİTA BİLGİSİ'}</div>`
        + (neighbors ? `<div class="city-dossier-neighbors"><span>KOMŞULAR</span><div class="city-chips">${neighbors}</div></div>` : '')
        + `</section>${storyCityDossierTabs(view, active)}`;
}

function storyCityDossierMissing(view) {
    return `<section class="city-dossier-sec"><h3>HENÜZ BAĞLANMAYAN KATMANLAR</h3>`
        + `<div class="city-missing-grid">${view.missingSystems.map(item => (
            `<div><b>${storyCityDossierEscape(item.label)}</b><span>SİSTEM HENÜZ YOK</span></div>`
        )).join('')}</div></section>`;
}

function storyCityDossierGeneral(view, node) {
    const facts = view.facts;
    let html = `<section class="city-dossier-sec"><h3>ŞEHİR ÖZETİ</h3><div class="city-fact-grid">`
        + `<div><span>SEVİYE</span>${storyCityDossierFactValue(facts.level, storyCityDossierNumber)}</div>`
        + `<div><span>NÜFUS (BİN)</span>${storyCityDossierFactValue(facts.population, storyCityDossierNumber)}</div>`
        + `<div><span>GARNİZON</span>${storyCityDossierFactValue(facts.garrison, storyCityDossierNumber)}</div>`
        + `<div><span>YÖNETİM</span><b>${view.isOwn ? 'DOĞRUDAN' : 'YABANCI'}</b></div>`
        + `</div><p class="city-hint">Bütçe, zenginlik, sanayi, stok, piyasa ve lojistik verileri EKONOMİ paneline taşındı.</p></section>`;
    if (view.isOwn && node) {
        const wallet = (STORY.commander && STORY.commander.res) || { oil: 0, manpower: 0, points: 0 };
        const gar = node.garrison | 0;
        const cap = typeof storyCityGarrisonCap === 'function' ? storyCityGarrisonCap(node) : gar;
        html += `<div class="prod-sec"><div class="prod-head"><span>🛡️ GARNİZON <b>${gar}/${cap}</b></span>`
            + `<button class="city-btn cb-gar" data-node="${node.id}" ${(gar >= cap || (wallet.manpower || 0) < CITY_GARRISON_COST) ? 'disabled' : ''}>+1 (${CITY_GARRISON_COST}👥)</button></div>`
            + `<div class="city-hint">Savunma düellosunda birlik olarak savaşır; kuşatma savunmasını güçlendirir.</div></div>`
            + (typeof prodPoolSection === 'function' ? prodPoolSection(node) : '');
    }
    return html + storyCityDossierMissing(view);
}

function storyEconomyRenderOverview(view) {
    const facts = view.facts;
    let html = '';
    const stateMatch = /^country:(-?\d+)$/.exec(String(view.ownerId || ''));
    const ownerState = stateMatch && typeof storyState === 'function' ? storyState(Number(stateMatch[1])) : null;
    if (view.isOwn && ownerState && typeof storyEconHtml === 'function') html += storyEconHtml(ownerState);
    html += `<section class="city-dossier-sec"><h3>BÖLGESEL EKONOMİ ÖZETİ</h3><div class="city-fact-grid">`
        + `<div><span>ZENGİNLİK</span>${storyCityDossierFactValue(facts.wealth, storyCityDossierNumber)}</div>`
        + `<div><span>FABRİKA</span>${storyCityDossierFactValue(facts.infrastructure, value => storyCityDossierNumber(value && value.factory))}</div>`
        + `<div><span>KIŞLA</span>${storyCityDossierFactValue(facts.infrastructure, value => storyCityDossierNumber(value && value.barracks))}</div>`
        + `<div><span>PETROL YATAĞI</span>${storyCityDossierFactValue(facts.deposits, value => storyCityDossierNumber(value && value.oil))}</div>`
        + `<div><span>ÜRETİM NOKTASI</span>${storyCityDossierFactValue(facts.deposits, value => storyCityDossierNumber(value && value.points))}</div>`
        + `</div></section><section class="city-dossier-sec"><h3>BÖLGESEL STOKLAR</h3>`;
    if (!facts.stocks || facts.stocks.status === PLAYER_FACT_STATUS.UNKNOWN) {
        html += `<div class="city-dossier-empty"><b>STOK İSTİHBARATI YOK</b><span>Yabancı bölgenin kanonik stokları doğrulanmadı.</span></div>`;
    } else {
        const quantities = facts.stocks.value && facts.stocks.value.quantities || {};
        const targets = facts.stocks.value && facts.stocks.value.safeTargets || {};
        const shortages = facts.stocks.value && facts.stocks.value.shortages || [];
        const labels = {
            food: 'GIDA', energy: 'ENERJİ', raw_materials: 'HAMMADDE',
            industrial_parts: 'SANAYİ PARÇASI', electronics: 'ELEKTRONİK',
            military_supplies: 'ASKERÎ MALZEME', labor: 'İŞ GÜCÜ', capital: 'SERMAYE'
        };
        html += `<div class="city-fact-grid">${Object.keys(labels).map(id => (
            `<div><span>${labels[id]}</span><b>${storyCityDossierNumber(quantities[id])}</b>`
            + `<small>Güvenli hedef ${storyCityDossierNumber(targets[id])}</small></div>`
        )).join('')}</div>`
            + `<p class="city-hint">${shortages.length ? `${shortages.length} karşılanmamış talep kaydı var.` : 'Kayıtlı karşılanmamış talep yok.'}</p>`;
    }
    return html + `</section>`;
}

function storyCityDossierRenderLogistics(view) {
    if (!view.isOwn) {
        return `<section class="city-dossier-empty"><b>ALTYAPI İSTİHBARATI YOK</b>`
            + `<span>Yabancı bölgenin kapasite, hasar ve hat durumu oyuncu tarafından doğrulanmadı.</span></section>`;
    }
    if (!view.corridors.length) {
        return `<section class="city-dossier-empty"><b>BAĞLANTI BULUNAMADI</b><span>Doğrulanmış koridor kaydı yok.</span></section>`;
    }
    const trade = view.facts.trade && view.facts.trade.value;
    const shipments = trade
        ? [...(trade.incoming || []), ...(trade.outgoing || [])]
            .filter((item, index, rows) => rows.findIndex(row => row.id === item.id) === index)
        : [];
    return `<section class="city-dossier-sec"><h3>AKTİF SİPARİŞ VE SEVKİYATLAR</h3>`
        + (shipments.length
            ? `<div class="city-route-list">${shipments.map(shipment => (
                `<article class="city-route-row ${String(shipment.status || 'held').toLowerCase()}">`
                + `<div><span>${storyCityDossierEscape(shipment.resourceId)}</span><b>${storyCityDossierNumber(shipment.quantity)}</b></div>`
                + `<div class="city-route-metrics"><span>${storyCityDossierEscape(shipment.status)}</span>`
                + `<span>${storyCityDossierEscape(shipment.currentRegionId)}</span>`
                + (shipment.marketQuote && shipment.marketQuote.status === 'INDICATIVE_INDEX_QUOTE'
                    ? `<span>FİYAT ${storyCityDossierNumber(shipment.marketQuote.unitIndex)} / ÖDEME BEKLİYOR</span>`
                    : '')
                + `</div></article>`
            )).join('')}</div>`
            : `<div class="city-dossier-empty"><b>AKTİF YÜK YOK</b><span>Bu bölgeye gelen veya buradan çıkan fiziksel sevkiyat bulunmuyor.</span></div>`)
        + `</section><section class="city-dossier-sec"><h3>ULAŞIM / ENERJİ / VERİ KORİDORLARI</h3><div class="city-route-list">`
        + view.corridors.map(corridor => {
            const meta = STORY_CITY_MODE_META[corridor.mode] || { icon: '·', label: corridor.mode };
            const damage = Math.round(corridor.damageBps / 100);
            return `<article class="city-route-row ${corridor.status.toLowerCase()}">`
                + `<div><span>${meta.icon} ${storyCityDossierEscape(meta.label)}</span><b>${storyCityDossierEscape(corridor.destinationName)}</b></div>`
                + `<div class="city-route-metrics"><span>KAP. ${storyCityDossierNumber(corridor.effectiveCapacity)}</span><span>HASAR %${damage}</span><span>${storyCityDossierEscape(corridor.status)}</span></div>`
                + `<button class="city-btn city-route" data-region="${storyCityDossierEscape(corridor.destinationRegionId)}">ROTAYA GİT</button>`
                + `</article>`;
        }).join('') + `</div><p class="city-hint">Ticaret bu kapasiteyi tüketir; dış ticaret bedeli sevkte bütçeden bloke edilir, fiziksel teslimatta satıcıya aktarılır.</p></section>`;
}

function storyCityDossierRenderBudget(view) {
    const fact = view.facts.budget;
    if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN || !fact.value) {
        return `<section class="city-dossier-empty"><b>BÜTÇE VERİSİ DOĞRULANMADI</b>`
            + `<span>Yabancı devletin nakit, borç ve ödeme defteri oyuncuya açık değildir.</span></section>`;
    }
    const budget = fact.value;
    const totals = budget.totals || {};
    return `<section class="city-dossier-sec"><h3>DEVLET BÜTÇESİ</h3><div class="city-fact-grid">`
        + `<div><span>NAKİT</span><b>${storyCityDossierNumber(budget.cash)}⭐</b></div>`
        + `<div><span>TİCARET BLOKESİ</span><b>${storyCityDossierNumber(budget.tradeEscrow)}⭐</b></div>`
        + `<div><span>BORÇ</span><b>${storyCityDossierNumber(budget.debt)}⭐</b><small>tavan ${storyCityDossierNumber(budget.debtCeiling)}</small></div>`
        + `<div><span>YILLIK FAİZ</span><b>%${storyCityDossierNumber((Number(budget.annualInterestBps) || 0) / 100)}</b></div>`
        + `<div><span>TOPLAM GELİR</span><b>${storyCityDossierNumber(totals.revenue)}⭐</b></div>`
        + `<div><span>TOPLAM GİDER</span><b>${storyCityDossierNumber(totals.expense)}⭐</b></div>`
        + `<div><span>BASILAN PARA</span><b>${storyCityDossierNumber(budget.moneyIssued)}⭐</b></div>`
        + `<div><span>DURUM</span><b>${storyCityDossierEscape(budget.status)}</b><small>gecikme ${storyCityDossierNumber(budget.missedPaymentDays)} gün</small></div>`
        + `</div><p class="city-hint">Komutan kasaları devlet nakdinin alt hesaplarıdır. Her gelir ve gider karşı hesapla kaydedilir; yetersiz bakiye varsa işlem reddedilir.</p></section>`;
}

function storyCityDossierRenderCompanies(view) {
    const fact = view.facts.companyEconomy;
    const countryFact = view.facts.countryCompanies;
    if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN || !fact.value) {
        return `<section class="city-dossier-empty"><b>ŞİRKET KAYDI DOĞRULANMADI</b>`
            + `<span>Yabancı şirketlerin nakit, borç, tesis ve yatırım kayıtları istihbarat olmadan açılmaz.</span></section>`;
    }
    const local = fact.value;
    const country = countryFact && countryFact.value;
    const bank = country && country.bank;
    const facilities = Array.isArray(local.facilities) ? local.facilities : [];
    const projects = Array.isArray(local.projects) ? local.projects : [];
    const policyFact = view.facts.economicPolicy;
    const policy = policyFact && policyFact.value;
    const decisions = policy && Array.isArray(policy.decisions) ? policy.decisions.slice(0, 8) : [];
    const rows = facilities.map(facility => {
        const company = facility.company || {};
        const debt = Math.max(0, -(Number(company.accounts && company.accounts['LIABILITY:DEBT']) || 0));
        const cash = Math.max(0, Number(company.accounts && company.accounts['ASSET:CASH']) || 0);
        const stateShare = (company.owners || []).find(owner => owner.ownerType === 'STATE');
        return `<article class="city-route-row ${String(company.status || 'operating').toLowerCase()}">`
            + `<div><span>${storyCityDossierEscape(company.sectorId)}</span><b>${storyCityDossierEscape(company.name)}</b></div>`
            + `<div class="city-route-metrics"><span>${storyCityDossierEscape(company.legalStatus)} / ${storyCityDossierEscape(company.licenseStatus)}</span>`
            + `<span>NAKİT ${storyCityDossierNumber(cash)}⭐</span><span>BORÇ ${storyCityDossierNumber(debt)}⭐</span>`
            + `<span>KAP. ${storyCityDossierNumber(facility.capacity)}</span>`
            + `<span>DEVLET PAYI %${storyCityDossierNumber((Number(stateShare && stateShare.shareBps) || 0) / 100)}</span></div></article>`;
    }).join('');
    const projectRows = projects.map(project => (
        `<div><span>${storyCityDossierEscape(project.sectorId)}</span><b>${storyCityDossierEscape(project.status)}</b>`
        + `<small>${storyCityDossierNumber(project.remainingDays)} gün · +${storyCityDossierNumber(project.capacityIncrease)} kapasite</small></div>`
    )).join('');
    const decisionRows = decisions.map(decision => {
        const selected = decision.selectedAction || 'HOLD';
        const execution = decision.execution || {};
        const outcome = decision.outcome || {};
        return `<div><span>${storyCityDossierEscape(decision.actorType)} · ${storyCityDossierEscape(selected)}</span>`
            + `<b>${storyCityDossierEscape(execution.status || 'HELD')}</b>`
            + `<small>puan ${storyCityDossierNumber(decision.selectedScore)} · ${storyCityDossierEscape(execution.code || '')}`
            + `${outcome.status ? ` · sonuç ${storyCityDossierEscape(outcome.status)}` : ''}</small></div>`;
    }).join('');
    return `<section class="city-dossier-sec"><h3>TESİS SAHİPLİĞİ VE ŞİRKETLER</h3>`
        + (rows ? `<div class="city-route-list">${rows}</div>` : `<div class="city-dossier-empty"><b>KAYITLI TESİS YOK</b><span>Bu bölgede çalışan sektör kapasitesi bulunmuyor.</span></div>`)
        + `</section><section class="city-dossier-sec"><h3>YATIRIM PROJELERİ</h3>`
        + (projectRows ? `<div class="city-fact-grid">${projectRows}</div>` : `<div class="city-hint">İnşa hâlinde veya tamamlanmış kayıtlı kapasite yatırımı yok.</div>`)
        + `</section><section class="city-dossier-sec"><h3>EKONOMİK KARAR GEREKÇELERİ</h3>`
        + (decisionRows ? `<div class="city-fact-grid">${decisionRows}</div>`
            : `<div class="city-hint">Henüz uygulanmış veya bekletilmiş kayıtlı ekonomik karar yok.</div>`)
        + `</section><section class="city-dossier-sec"><h3>YEREL BANKA</h3>`
        + (bank ? `<div class="city-fact-grid"><div><span>BANKA</span><b>${storyCityDossierEscape(bank.name)}</b></div>`
            + `<div><span>REZERV</span><b>${storyCityDossierNumber(bank.reserves)}⭐</b></div>`
            + `<div><span>KREDİLER</span><b>${storyCityDossierNumber(bank.loansReceivable)}⭐</b></div>`
            + `<div><span>DURUM</span><b>${storyCityDossierEscape(bank.status)}</b></div></div>`
            : `<div class="city-hint">Doğrulanmış banka kaydı yok.</div>`)
        + `<p class="city-hint">Şirket kasası devlet bütçesi değildir. Üretim gideri şirket nakdinden, kredi banka rezervinden, kapasite artışı fiziksel parça ve tamamlanma süresinden geçer.</p></section>`;
}

function storyCityDossierRenderMarket(view) {
    const fact = view.facts.market;
    if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN || !fact.value) {
        return `<section class="city-dossier-empty"><b>PİYASA VERİSİ DOĞRULANMADI</b>`
            + `<span>Bu bölgenin stok, talep ve lojistik riskinden türetilmiş fiyat defteri oyuncuya açık değil.</span></section>`;
    }
    const market = fact.value;
    const labels = {
        food: 'GIDA',
        energy: 'ENERJİ',
        raw_materials: 'HAMMADDE',
        industrial_parts: 'SANAYİ PARÇASI',
        electronics: 'ELEKTRONİK',
        military_supplies: 'ASKERÎ MALZEME',
        labor: 'İŞ GÜCÜ',
        capital: 'SERMAYE'
    };
    const rows = Object.keys(labels).map(resourceId => {
        const resource = market.resources && market.resources[resourceId];
        if (!resource) return '';
        if (resource.status === 'DEFERRED') {
            return `<div><span>${labels[resourceId]}</span><b>ERTELENDİ</b><small>iş gücü piyasası henüz modellenmedi</small></div>`;
        }
        if (resource.status === 'NUMERAIRE') {
            return `<div><span>${labels[resourceId]}</span><b>1,00</b><small>finansal sermaye piyasası henüz ayrı modellenmedi</small></div>`;
        }
        const change = Number(resource.lastChangeBps) || 0;
        const direction = change > 0 ? '+' : '';
        const stockRatio = resource.signals ? Number(resource.signals.stockCoverageRatio) : null;
        const stockDays = resource.signals && resource.signals.stockCoverageDays != null
            ? Number(resource.signals.stockCoverageDays)
            : null;
        return `<div><span>${labels[resourceId]}</span><b>${storyCityDossierNumber(resource.priceIndex)}</b>`
            + `<small>${storyCityDossierEscape(resource.band)} · ${direction}${storyCityDossierNumber(change / 100)}%`
            + `${Number.isFinite(stockRatio) ? ` · stok/hedef ${storyCityDossierNumber(stockRatio)}` : ''}`
            + `${Number.isFinite(stockDays) ? ` · ${storyCityDossierNumber(stockDays)} gün` : ''}</small></div>`;
    }).join('');
    return `<section class="city-dossier-sec"><h3>BÖLGESEL FİYAT ENDEKSLERİ</h3>`
        + `<div class="city-fact-grid">${rows}</div>`
        + `<p class="city-hint">Baz endeks 100'dür. Hane sepeti: <b>${storyCityDossierNumber(market.householdCpi)}</b>; üretici endeksi: <b>${storyCityDossierNumber(market.producerPriceIndex)}</b>. Dış ticaret ödemesi sevk anındaki endeksle kilitlenir.</p></section>`;
}

function storyCityDossierRenderHistory(view) {
    if (!view.history.length) {
        return `<section class="city-dossier-empty"><b>DOĞRULANMIŞ YAKIN OLAY YOK</b>`
            + `<span>Bu, şehirde hiçbir şey olmadığı anlamına gelmez; oyuncuya açılabilir nedensel kayıt henüz oluşmadı.</span></section>`;
    }
    return `<section class="city-dossier-sec"><h3>SON DOĞRULANMIŞ DEĞİŞİKLİKLER</h3><div class="city-history-list">`
        + view.history.map(item => {
            const detail = item.causeSteps.length
                ? `NEDEN DEĞİŞTİ?\n${item.causeSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`
                : 'Bu olay için oyuncunun doğrulayabildiği ayrıntılı neden zinciri yok.';
            return `<div class="city-history-row detail-hover" tabindex="0" data-story-tooltip="${storyCityDossierEscape(detail)}">`
            + `<span>${storyCityDossierEscape(item.domain.toLocaleUpperCase('tr'))}</span>`
            + `<b>${storyCityDossierEscape(item.badgeText)}</b>`
            + `<em>${Math.max(0, Math.round(view.generatedAt - item.observedAt))} sn önce</em></div>`;
        }).join('')
        + `</div></section>`;
}

function storyCityDossierRenderCharacters(view) {
    if (!view.isOwn) {
        return `<section class="city-dossier-empty"><b>KARAKTER KONUMLARI BİLİNMİYOR</b>`
            + `<span>Kamuya açık kimlik, doğrulanmış şehir konumu demek değildir.</span></section>`;
    }
    if (!view.characters.length) {
        return `<section class="city-dossier-empty"><b>DOĞRULANMIŞ KARAKTER YOK</b>`
            + `<span>Bu şehirde kendi komuta kayıtlarında görünen bir karakter bulunmuyor.</span></section>`;
    }
    return `<section class="city-dossier-sec"><h3>ŞEHİRDEKİ KARAKTERLER</h3><div class="city-character-list">`
        + view.characters.map(character => `<article class="city-character-row"><div>`
            + `<b>${storyCityDossierEscape(character.name.value)}</b>`
            + `<span>${storyCityDossierEscape(character.role.value)}</span></div>`
            + `<button class="city-btn city-character" data-character="${storyCityDossierEscape(character.id)}">SOHBET GİRİŞİ</button></article>`).join('')
        + `</div><p class="city-hint">Karaktere özel serbest sohbet sözleşmesi henüz yoktur; düğme mevcut sohbet merkezini bu karakter bağlamıyla açar.</p></section>`;
}

function storyCityDossierRenderCollective(view) {
    const fact = view.facts.collectiveAction;
    if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN || !fact.value) return '';
    const value = fact.value;
    const rows = Array.isArray(value.participations) ? value.participations : [];
    const problemLabels = {
        food: 'Gıda erişimi', energy: 'Enerji erişimi', income: 'Gelir güvencesi',
        employment: 'İşsizlik', security: 'Fiziksel güvenlik', publicServices: 'Kamu hizmetleri'
    };
    const stageLabels = { NONE: 'ÖRGÜTLENME', PROTEST: 'PROTESTO', STRIKE: 'GREV', UPRISING: 'AYAKLANMA' };
    const visible = view.isOwn ? rows : rows.filter(row => row.stage !== 'NONE');
    return `<section class="city-dossier-sec"><h3>TOPLUMSAL EYLEMLER</h3>`
        + (visible.length
            ? `<div class="city-character-list">${visible.slice(0, 4).map(row => `<article class="city-character-row"><div>`
                + `<b>${storyCityDossierEscape(stageLabels[row.stage] || row.stage)} · ${storyCityDossierEscape(problemLabels[row.problemType] || row.problemType)}</b>`
                + `<span>SORUMLU GÖRÜLEN: ${storyCityDossierEscape(typeof storyOpinionActorLabel === 'function' ? storyOpinionActorLabel(row.blamedActorId) : row.blamedActorId)}</span>`
                + (view.isOwn ? `<small>Yerel şiddet %${storyCityDossierNumber(row.localSeverityBps / 100)} · seferberlik %${storyCityDossierNumber(row.mobilizationBps / 100)} · radikalleşme %${storyCityDossierNumber(row.radicalizationBps / 100)}</small>` : '<small>Kamuya açık eylem; örgütlenme gücü ve radikalleşme bilinmiyor.</small>')
                + `</div></article>`).join('')}</div>`
            : `<div class="city-dossier-empty"><b>AKTİF KAMUSAL EYLEM YOK</b><span>${view.isOwn ? 'Şikâyetler henüz kalıcı seferberlik eşiğini aşmadı.' : 'Bu bölgede kamuya yansımış protesto, grev veya ayaklanma gözlenmedi.'}</span></div>`)
        + `<p class="city-hint">Protesto anlık şikâyetten doğmaz; süre, tekrar, etkilenen nüfus ve örgütlenme birlikte eşik aşar. Yabancı gizli radikal ağlar kesin sayı olarak gösterilmez.</p></section>`;
}

function storyCityDossierRenderPopulation(view) {
    const fact = view.facts.populationCohorts;
    if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN || !Array.isArray(fact.value)) {
        return `<section class="city-dossier-empty"><b>NÜFUS SAYIMI DOĞRULANMADI</b>`
            + `<span>Yabancı bölgenin yaş, gelir, meslek, eğitim ve kimlik dağılımı istihbarat olmadan gösterilmez.</span></section>`
            + storyCityDossierRenderCollective(view);
    }
    const rows = fact.value;
    const total = rows.reduce((sum, row) => sum + (Number(row.membersPeople) || 0), 0);
    const dimensions = [
        ['ageBand', 'YAŞ', { CHILD: 'Çocuk', YOUNG: 'Genç', ADULT: 'Yetişkin', SENIOR: 'Yaşlı' }],
        ['occupation', 'MESLEK', { DEPENDENT: 'Bağımlı', STUDENT: 'Öğrenci', AGRICULTURE: 'Tarım', INDUSTRY: 'Sanayi', SERVICES: 'Hizmet', PUBLIC: 'Kamu', DEFENSE: 'Savunma', UNEMPLOYED: 'İşsiz', RETIRED: 'Emekli' }],
        ['incomeBand', 'GELİR', { DEPENDENT: 'Bağımlı', LOW: 'Düşük', LOWER_MIDDLE: 'Alt orta', MIDDLE: 'Orta', UPPER_MIDDLE: 'Üst orta' }],
        ['education', 'EĞİTİM', { BASIC: 'Temel', PRIMARY: 'İlköğretim', SECONDARY: 'Ortaöğretim', TERTIARY: 'Yükseköğretim' }],
        ['identity', 'KİMLİK YÖNELİMİ', { LOCAL: 'Yerel', NATIONAL: 'Ulusal', COSMOPOLITAN: 'Kozmopolit' }]
    ];
    const sections = dimensions.map(([field, title, labels]) => {
        const totals = {};
        for (const row of rows) totals[row[field]] = (totals[row[field]] || 0) + (Number(row.membersPeople) || 0);
        const cards = Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([key, value]) => {
            const percent = total > 0 ? value / total * 100 : 0;
            return `<div><span>${storyCityDossierEscape(labels[key] || key)}</span><b>%${storyCityDossierNumber(percent)}</b>`
                + `<small>${Math.round(value).toLocaleString('tr-TR')} kişi</small></div>`;
        }).join('');
        return `<section class="city-dossier-sec"><h3>${title}</h3><div class="city-fact-grid">${cards}</div></section>`;
    }).join('');
    const labor = typeof storyPopulationLaborSupply === 'function'
        ? storyPopulationLaborSupply(view.regionId, 1)
        : null;
    const needsFact = view.facts.needsWelfare;
    const needs = needsFact && needsFact.status === PLAYER_FACT_STATUS.VERIFIED
        ? needsFact.value
        : null;
    const conditions = needs ? `<section class="city-dossier-sec"><h3>YAŞAM KOŞULLARI</h3><div class="city-fact-grid">`
        + `<div><span>GIDA ERİŞİMİ</span><b>%${storyCityDossierNumber(needs.foodAccessBps / 100)}</b></div>`
        + `<div><span>ENERJİ ERİŞİMİ</span><b>%${storyCityDossierNumber(needs.energyAccessBps / 100)}</b></div>`
        + `<div><span>GELİR GÜVENLİĞİ</span><b>%${storyCityDossierNumber(needs.incomeSecurityBps / 100)}</b><small>ücret değil, istihdam vekili</small></div>`
        + `<div><span>İŞSİZLİK RİSKİ</span><b>%${storyCityDossierNumber(needs.unemploymentRiskBps / 100)}</b></div>`
        + `<div><span>FİZİKSEL GÜVENLİK</span><b>%${storyCityDossierNumber(needs.securityBps / 100)}</b></div>`
        + `<div><span>KAMU HİZMETİ</span><b>%${storyCityDossierNumber(needs.publicServicesBps / 100)}</b></div>`
        + `<div><span>TOPLAM YAŞAM KOŞULU</span><b>%${storyCityDossierNumber(needs.wellbeingBps / 100)}</b></div>`
        + `</div><p class="city-hint">Aynı kaynak şoku bütün toplumu eşit etkilemez; aşağıdaki kohortların ihtiyaç ağırlıkları farklıdır. Bu anlık sonuçlar şikâyet hafızasına kaynak olur, fakat geçmiş tepkiyi tek başına silmez.</p></section>` : '';
    const opinionFact = view.facts.publicOpinion;
    const opinion = opinionFact && opinionFact.status === PLAYER_FACT_STATUS.VERIFIED
        ? opinionFact.value
        : null;
    const problemLabels = {
        food: 'Gıda erişimi', energy: 'Enerji erişimi', income: 'Gelir güvencesi',
        employment: 'İşsizlik', security: 'Fiziksel güvenlik', publicServices: 'Kamu hizmetleri'
    };
    const complaints = opinion ? `<section class="city-dossier-sec"><h3>BİRİKEN ŞİKÂYETLER</h3>`
        + `<div class="city-fact-grid"><div><span>TOPLUMSAL HAFIZA</span><b>%${storyCityDossierNumber(opinion.rememberedSeverityBps / 100)}</b>`
        + `<small>${opinion.affectedCohortCount}/${opinion.cohortCount} kohort etkileniyor</small></div></div>`
        + ((opinion.topIssues || []).length
            ? `<div class="city-character-list">${opinion.topIssues.slice(0, 4).map(issue => `<article class="city-character-row"><div>`
                + `<b>${storyCityDossierEscape(problemLabels[issue.problemType] || issue.problemType)} · %${storyCityDossierNumber(issue.severityBps / 100)}</b>`
                + `<span>SORUMLU GÖRÜLEN: ${storyCityDossierEscape(typeof storyOpinionActorLabel === 'function' ? storyOpinionActorLabel(issue.blamedActorId) : issue.blamedActorId)}</span>`
                + `<small>${Math.round(issue.affectedPeople).toLocaleString('tr-TR')} kişi · ${issue.activeCohortCount} aktif / ${issue.recoveringCohortCount} iyileşen kohort</small>`
                + `</div></article>`).join('')}</div>`
            : `<div class="city-dossier-empty"><b>BİRİKMİŞ ŞİKÂYET YOK</b><span>Anlık baskı hafıza eşiğini aşmadı veya tamamen unutuldu.</span></div>`)
        + `<p class="city-hint">Sorumluluk bir mahkeme gerçeği değil, mevcut doğrudan sağlayıcı veya kamu yetkisine dayanan toplumsal atıftır. Medya ve söylenti katmanları ileride bu algıyı değiştirebilir; temel fiziksel olay kaydı değişmez.</p></section>` : '';
    return `<section class="city-dossier-sec"><h3>NÜFUS SAYIMI</h3><div class="city-fact-grid">`
        + `<div><span>TOPLAM</span><b>${Math.round(total).toLocaleString('tr-TR')}</b><small>tam kişi uzlaştırması</small></div>`
        + `<div><span>ÇALIŞMA ÇAĞI</span><b>${labor ? Math.round(labor.workingAgePeople).toLocaleString('tr-TR') : '—'}</b></div>`
        + `<div><span>KULLANILABİLİR ÇALIŞAN</span><b>${labor ? Math.round(labor.availableWorkersPeople).toLocaleString('tr-TR') : '—'}</b><small>ücret modeli henüz yok</small></div>`
        + `</div><p class="city-hint">Bu değerler dekoratif değildir: bölgesel üretimin iş gücü tavanını doğrudan belirler. Ücret endeksi Faz 28'e kadar kesin değer olarak gösterilmez.</p></section>${conditions}${complaints}${storyCityDossierRenderCollective(view)}${sections}`;
}

function storyCityDossierRender(view, active, node) {
    if (view.disabled) return '<div class="city-hint">Şehir dosyası özellik bayrağıyla kapalı.</div>';
    let content = '';
    if (active === 'nufus') content = storyCityDossierRenderPopulation(view);
    else if (active === 'tarih') content = storyCityDossierRenderHistory(view);
    else if (active === 'karakterler') content = storyCityDossierRenderCharacters(view);
    else if (active === 'binalar' && view.isOwn && node) {
        const wallet = (STORY.commander && STORY.commander.res) || { oil: 0, manpower: 0, points: 0 };
        content = prodBuildingSection(node, 'fac', wallet, true)
            + prodBuildingSection(node, 'bar', wallet, true)
            + `<div class="city-hint">Bina seviyesi şehir seviyesini en fazla 1 aşar.</div>`;
    } else if (active === 'ordu' && view.isOwn && node) {
        const wallet = (STORY.commander && STORY.commander.res) || { oil: 0, manpower: 0, points: 0 };
        content = prodBuildingSection(node, 'fac', wallet, false)
            + prodBuildingSection(node, 'bar', wallet, false)
            + prodQueueSection(node);
    } else content = storyCityDossierGeneral(view, node);
    return storyCityDossierHeader(view, active) + content;
}

function storyEconomyTabs(active) {
    const tabs = [
        ['genel', 'ÖZET'], ['butce', 'BÜTÇE'], ['sirketler', 'ŞİRKETLER'],
        ['piyasa', 'PİYASA'], ['lojistik', 'LOJİSTİK'], ['fraksiyonlar', 'FRAKSİYONLAR']
    ];
    return `<div class="city-dossier-tabs economy-tabs" role="tablist" aria-label="Ekonomi bölümleri">`
        + tabs.map(([id, label]) => `<button class="economy-sub${active === id ? ' active' : ''}" data-sub="${id}" role="tab" aria-selected="${active === id ? 'true' : 'false'}">${label}</button>`).join('')
        + `</div>`;
}

function storyEconomyRender(view, active) {
    let content = '';
    if (active === 'butce') content = storyCityDossierRenderBudget(view);
    else if (active === 'sirketler') content = storyCityDossierRenderCompanies(view);
    else if (active === 'piyasa') content = storyCityDossierRenderMarket(view);
    else if (active === 'lojistik') content = storyCityDossierRenderLogistics(view);
    else if (active === 'fraksiyonlar') {
        const match = /^country:(-?\d+)$/.exec(String(view.ownerId || ''));
        const ownerState = match && typeof storyState === 'function' ? storyState(Number(match[1])) : null;
        content = view.isOwn && ownerState && typeof storyFacHtml === 'function'
            ? storyFacHtml(ownerState)
            : `<section class="city-dossier-empty"><b>TOPLUMSAL DENGE DOĞRULANMADI</b><span>Yabancı devletin fraksiyon bağlılıkları açık bilgi değildir.</span></section>`;
    } else content = storyEconomyRenderOverview(view);
    return `<section class="city-dossier-head economy-dossier-head">`
        + `<div class="city-dossier-kicker">${view.isOwn ? 'ULUSAL VE BÖLGESEL DEFTER' : 'KAMUYA AÇIK EKONOMİK GÖRÜNÜM'}</div>`
        + `<div class="city-dossier-name">${storyCityDossierEscape(view.facts.name.value)}</div>`
        + `<div class="city-dossier-source">${storyCityDossierEscape(view.ownerName)} · ${view.isOwn ? 'DOĞRULANMIŞ KAYIT' : 'SINIRLI İSTİHBARAT'}</div>`
        + `</section>${storyEconomyTabs(active)}${content}`;
}

function storyEconomyUpdate() {
    if (!STORY._economyOpen) return;
    const body = document.getElementById('economy-body');
    if (!body) return;
    const node = typeof storyCityFocus === 'function' ? storyCityFocus() : null;
    const title = document.getElementById('economy-title');
    if (!node) {
        if (title) title.textContent = 'EKONOMİ';
        body.innerHTML = '<div class="city-dossier-empty"><b>BÖLGE SEÇİLMEDİ</b><span>Haritadan bir şehir seç.</span></div>';
        return;
    }
    try {
        const view = storyCityDossierBuild(node.id);
        const active = STORY_ECONOMY_TABS.includes(STORY._economySub) ? STORY._economySub : 'genel';
        STORY._economySub = active;
        STORY._economyView = view;
        if (title) title.textContent = `EKONOMİ / ${String(view.facts.name.value).toLocaleUpperCase('tr')}`;
        body.innerHTML = storyEconomyRender(view, active);
        if (typeof storyActivateDetailTooltips === 'function') storyActivateDetailTooltips(body);
    } catch (error) {
        body.innerHTML = `<div class="city-dossier-empty"><b>EKONOMİ DOSYASI OLUŞTURULAMADI</b><span>${storyCityDossierEscape(error && error.message || error)}</span></div>`;
    }
}

function storyCityDossierUpdate() {
    if (!STORY._cityOpen) return;
    const body = document.getElementById('city-body');
    if (!body) return;
    const node = typeof storyCityFocus === 'function' ? storyCityFocus() : null;
    const title = document.getElementById('city-title');
    if (!node) {
        if (title) title.textContent = 'ŞEHİR DOSYASI';
        body.innerHTML = '<div class="city-dossier-empty"><b>ŞEHİR SEÇİLMEDİ</b><span>Haritadan bir şehir seç.</span></div>';
        return;
    }
    let view;
    try {
        view = storyCityDossierBuild(node.id);
    } catch (error) {
        body.innerHTML = `<div class="city-dossier-empty"><b>DOSYA OLUŞTURULAMADI</b><span>${storyCityDossierEscape(error && error.message || error)}</span></div>`;
        return;
    }
    if (title) title.textContent = `${String(view.facts.name.value).toLocaleUpperCase('tr')} / DOSYA`;
    let active = STORY_CITY_DOSSIER_TABS.includes(STORY._citySub) ? STORY._citySub : 'genel';
    if (!view.isOwn && (active === 'binalar' || active === 'ordu')) active = 'genel';
    STORY._citySub = active;
    STORY._cityDossierView = view;
    body.innerHTML = storyCityDossierRender(view, active, node);
    if (typeof storyActivateDetailTooltips === 'function') storyActivateDetailTooltips(body);
}

function storyCityDossierOpenRegion(regionId) {
    const legacyId = storyCityDossierLegacyId(regionId);
    const node = legacyId == null ? null : storyNode(legacyId);
    if (!node) return false;
    STORY.selectedNodeId = node.id;
    STORY._citySub = 'genel';
    if (typeof storyCamCenterOn === 'function') storyCamCenterOn(node);
    storyCityDossierUpdate();
    return true;
}

function storyCityDossierOpenEvent(changeId) {
    return !!String(changeId || '');
}

function storyCityDossierOpenCharacter(characterId) {
    const view = STORY._cityDossierView;
    const character = view && (view.characters || []).find(candidate => candidate.id === String(characterId));
    if (!character) return false;
    STORY._talkFocusCharacterId = character.id;
    STORY._talkFocusCharacterName = character.name.value;
    STORY._talkFocusRegionId = view.regionId;
    if (typeof storyTalkOpen === 'function') {
        storyTalkOpen();
        return true;
    }
    return false;
}
