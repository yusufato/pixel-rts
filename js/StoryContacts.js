// ============================================================================
//  KARAKTER / TEMAS DIZINI VE AJAN OPERASYON YUZEYI — Faz 37
//  ---------------------------------------------------------------------------
//  Bu UI ham dünyayı okumaz. Yabancı isim/rol/unvan kamusal sicilden,
//  temaslar oyuncu ilişki hafızasından, operasyon varlıkları ise yalnız
//  PlayerKnowledge içindeki PUBLIC_INFRASTRUCTURE_MAP olgularından gelir.
//  Yabancı konum, kapasite, hasar, servis ve kariyer değerleri açılmaz.
// ============================================================================

const STORY_CONTACT_DIRECTORY_VERSION = 1;
let STORY_CONTACT_DIRECTORY_CACHE = null;

function storyContactDirectoryClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyContactDirectoryFactValue(fact) {
    return fact && fact.status !== 'UNKNOWN' ? fact.value : null;
}

function storyContactDirectoryEscape(value) {
    return typeof storyProjectionEscape === 'function'
        ? storyProjectionEscape(String(value == null ? '' : value))
        : String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
}

function storyContactDirectoryContext() {
    const perf = { worldCacheHits: 0, worldBuilds: 0 };
    if (typeof storyCityDossierPanelWorldContext === 'function') {
        return storyCityDossierPanelWorldContext(perf);
    }
    const world = storyWorldV2ExportValidated();
    return {
        world,
        knowledge: storyPlayerKnowledgeProject(world, storyWorldV2CountryId(STORY.playerStateId))
    };
}

function storyContactDirectoryRolePriority(role) {
    const key = String(role || '').toUpperCase();
    return ({ EXECUTIVE: 0, POLITICAL_FIGURE: 1, COMMANDER: 2, AGENT: 3,
        COMPANY_EXECUTIVE: 4, POLITICAL_CANDIDATE: 5 })[key] ?? 9;
}

function storyContactDirectoryBuild() {
    const revision = typeof storyCityDossierPanelWorldRevision === 'function'
        ? storyCityDossierPanelWorldRevision() : `${Number(STORY.clock) || 0}`;
    const cacheKey = `${revision}|registry:${STORY._contactDirectoryRegistryOpen ? 1 : 0}`;
    if (STORY_CONTACT_DIRECTORY_CACHE && STORY_CONTACT_DIRECTORY_CACHE.key === cacheKey) {
        return STORY_CONTACT_DIRECTORY_CACHE.view;
    }
    const context = storyContactDirectoryContext();
    const knowledge = context.knowledge;
    const playerCountryId = storyWorldV2CountryId(STORY.playerStateId);
    const playerActorId = STORY.commander
        ? `character:${STORY.playerStateId | 0}:${STORY.commander.id}` : null;
    const countryNames = new Map((knowledge.countries || []).map(row => [
        row.id, storyContactDirectoryFactValue(row.name) || row.id
    ]));
    const directContactIds = new Set();
    for (const edge of (knowledge.characterRelationships || [])) {
        if (edge.fromActorId === playerActorId) directContactIds.add(edge.toActorId);
        if (edge.toActorId === playerActorId) directContactIds.add(edge.fromActorId);
    }
    const characters = (knowledge.characters || []).map(row => {
        const ownerId = (context.world.characters.find(actor => actor.id === row.id) || {}).ownerId || null;
        const own = ownerId === playerCountryId;
        const directContact = directContactIds.has(row.id);
        const regionValue = storyContactDirectoryFactValue(row.regionId);
        return {
            id: row.id,
            ownerId,
            countryName: countryNames.get(ownerId) || ownerId,
            name: storyContactDirectoryFactValue(row.name) || 'Bilinmeyen kişi',
            role: storyContactDirectoryFactValue(row.role) || 'CHARACTER',
            publicTitle: storyContactDirectoryFactValue(row.publicTitle) || '',
            own,
            directContact,
            contactable: own || directContact,
            // Bu alan yalnız sızıntı probu içindir; yabancı için daima null.
            visibleRegionId: own ? regionValue : null
        };
    }).sort((a, b) => Number(b.directContact) - Number(a.directContact)
        || Number(b.own) - Number(a.own)
        || a.countryName.localeCompare(b.countryName, 'tr')
        || storyContactDirectoryRolePriority(a.role) - storyContactDirectoryRolePriority(b.role)
        || a.name.localeCompare(b.name, 'tr'));

    const player = characters.find(row => row.id === playerActorId) || null;
    const isAgent = !!(player && String(player.role).toUpperCase() === 'AGENT');
    const officialsByCountry = new Map();
    for (const character of characters) {
        if (character.ownerId === playerCountryId) continue;
        const rows = officialsByCountry.get(character.ownerId) || [];
        rows.push(character);
        officialsByCountry.set(character.ownerId, rows);
    }
    for (const rows of officialsByCountry.values()) rows.sort((a, b) => (
        storyContactDirectoryRolePriority(a.role) - storyContactDirectoryRolePriority(b.role)
        || a.id.localeCompare(b.id, 'en')
    ));

    const regionNames = new Map((knowledge.regions || []).map(row => [
        row.id, storyContactDirectoryFactValue(row.name) || row.id
    ]));
    const operations = [];
    const perCountry = new Map();
    if (isAgent) {
        for (const asset of (knowledge.infrastructureAssets || [])) {
            const topology = storyContactDirectoryFactValue(asset.topology);
            if (!topology || topology.mode !== 'LAND') continue;
            const ownerIds = (topology.ownerCountryIds || []).filter(Boolean);
            if (!ownerIds.length || ownerIds.includes(playerCountryId)) continue;
            const targetCountryId = ownerIds.slice().sort((a, b) => a.localeCompare(b, 'en'))[0];
            if ((perCountry.get(targetCountryId) || 0) >= 2) continue;
            const target = (officialsByCountry.get(targetCountryId) || [])[0];
            if (!target) continue;
            const domainContext = {
                assetType: 'INFRASTRUCTURE_CORRIDOR', targetAssetId: asset.id
            };
            const candidate = storyCharacterActionCandidate({
                actionType: 'SABOTAGE', actorId: playerActorId,
                targetActorId: target.id, decisionSource: 'PLAYER_UI', domainContext
            });
            operations.push({
                assetId: asset.id,
                assetType: domainContext.assetType,
                mode: topology.mode,
                endpointNames: (topology.endpointRegionIds || []).map(id => regionNames.get(id) || id),
                targetCountryId,
                targetCountryName: countryNames.get(targetCountryId) || targetCountryId,
                targetActorId: target.id,
                targetActorName: target.name,
                allowed: candidate.allowed,
                reasons: candidate.reasons.slice(),
                cost: storyContactDirectoryClone(candidate.cost)
            });
            perCountry.set(targetCountryId, (perCountry.get(targetCountryId) || 0) + 1);
        }
    }

    const view = {
        schemaVersion: STORY_CONTACT_DIRECTORY_VERSION,
        playerActorId,
        playerCountryId,
        isAgent,
        registryOpen: !!STORY._contactDirectoryRegistryOpen,
        contacts: characters.filter(row => row.contactable && row.id !== playerActorId).slice(0, 24),
        publicCharacters: characters.filter(row => row.id !== playerActorId),
        operations,
        diagnostics: {
            foreignLocationLeakCount: characters.filter(row => !row.own && row.visibleRegionId != null).length,
            operationSecretFieldCount: JSON.stringify(operations).match(/damageBps|effectiveCapacity|capacity|access|enabled/g)?.length || 0
        }
    };
    STORY_CONTACT_DIRECTORY_CACHE = { key: cacheKey, view };
    return view;
}

function storyContactDirectoryCharacterRow(row) {
    const esc = storyContactDirectoryEscape;
    const badge = row.own ? 'KENDİ ÜLKEN' : (row.directContact ? 'DOĞRULANMIŞ TEMAS' : 'KAMUSAL SİCİL');
    return `<div class="contact-directory-row">`
        + `<div><b>${esc(row.name)}</b><span>${esc(row.publicTitle || row.role)} · ${esc(row.countryName)}</span>`
        + `<small>${badge}</small></div>`
        + (row.contactable
            ? `<button class="story-btn" data-contact-character="${esc(row.id)}" data-contact-name="${esc(row.name)}">EYLEMLERİ AÇ</button>`
            : `<span class="contact-directory-locked">TEMAS YOK</span>`)
        + `</div>`;
}

function storyContactDirectoryRenderHtml(view) {
    if (!view) return '';
    const esc = storyContactDirectoryEscape;
    const contacts = view.contacts.map(storyContactDirectoryCharacterRow).join('')
        || '<div class="talk-note">Doğrulanmış doğrudan temas bulunmuyor.</div>';
    const registry = view.registryOpen
        ? `<div class="contact-directory-scroll">${view.publicCharacters.map(storyContactDirectoryCharacterRow).join('')}</div>`
        : '';
    const operationHtml = view.isAgent
        ? `<div class="talk-card contact-operation-card"><div class="talk-card-h"><span>AJAN OPERASYON DOSYASI</span>`
            + `<span class="talk-age">${view.operations.length} kamusal hedef</span></div>`
            + `<div class="talk-note">Yalnız açık kaynak fiziksel yol topolojisi gösterilir. Hasar, kapasite ve yabancı karakter konumu gizlidir.</div>`
            + `<div class="contact-operation-list">${view.operations.map(op => {
                const cost = Number(op.cost && op.cost.amount) || 0;
                const reason = op.allowed ? `${cost} ajan kapasitesi · 30 sn operasyon`
                    : `Kullanılamıyor: ${op.reasons[0] || 'UNKNOWN'}`;
                return `<div class="contact-operation-row"><div><b>${esc(op.targetCountryName)}</b>`
                    + `<span>${esc(op.endpointNames.join(' ↔ '))}</span><small>${esc(reason)}</small></div>`
                    + `<button class="story-btn" data-character-action="SABOTAGE" data-character-target="${esc(op.targetActorId)}" `
                    + `data-character-target-name="${esc(op.targetActorName)}" data-character-asset="${esc(op.assetId)}" `
                    + `data-character-asset-type="${esc(op.assetType)}"${op.allowed ? '' : ' disabled'}>SABOTAJ PLANLA</button></div>`;
            }).join('') || '<div class="talk-note">Güvenli ve doğrulanmış yabancı fiziksel hedef yok.</div>'}</div></div>`
        : '';
    return `<div class="talk-sec contact-directory"><div class="talk-h">👤 KARAKTERLER VE TEMASLAR</div>`
        + `<div class="talk-note">Varsayılan liste yalnız kendi kurumlarını ve doğrulanmış temaslarını gösterir. Yabancı konumlar açılmaz.</div>`
        + `<div class="contact-directory-list">${contacts}</div>`
        + `<button class="story-btn contact-registry-toggle" data-contact-registry-toggle="1">`
        + `${view.registryOpen ? 'KAMUSAL SİCİLİ KAPAT' : `KAMUSAL SİCİLİ AÇ · ${view.publicCharacters.length}`}</button>`
        + registry + operationHtml + `</div>`;
}

function storyContactDirectoryToggleRegistry() {
    STORY._contactDirectoryRegistryOpen = !STORY._contactDirectoryRegistryOpen;
    STORY_CONTACT_DIRECTORY_CACHE = null;
    if (typeof storyTalkUpdate === 'function') storyTalkUpdate();
    return STORY._contactDirectoryRegistryOpen;
}

function storyContactDirectoryOpenCharacter(actorId, name) {
    const view = storyContactDirectoryBuild();
    const row = view.publicCharacters.find(candidate => candidate.id === String(actorId));
    if (!row || !row.contactable) return false;
    STORY._talkFocusCharacterId = row.id;
    STORY._talkFocusCharacterName = String(name || row.name);
    STORY._talkFocusRegionId = null;
    if (typeof storyTalkUpdate === 'function') storyTalkUpdate();
    return true;
}
