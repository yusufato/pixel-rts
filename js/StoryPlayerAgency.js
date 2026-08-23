// Player-facing access contract for 18 canonical story-system families.
const STORY_PLAYER_AGENCY_SCHEMA_VERSION=1;
const STORY_PLAYER_AGENCY_RECEIPT_LIMIT=240;
const STORY_PLAYER_AGENCY_FAMILIES=Object.freeze([
['TRADE','Ticaret'],['PRODUCTION','Uretim'],['MARKET','Stok ve fiyatlama'],
['INVESTMENT','Yatirim ve insaat'],['COMPANY','Sirket yonetimi'],
['BANKING','Bankacilik ve finans'],['BUDGET','Devlet butcesi, vergi ve para'],
['INFRASTRUCTURE','Altyapi'],['MIGRATION','Goc'],['LABOR','Nufus ve emek'],
['POWER_CENTERS','Guc merkezleri'],['INSTITUTIONS','Kurumlar'],
['ELECTIONS','Secimler'],['INVESTIGATIONS','Sorusturmalar'],
['DIPLOMACY','Diplomasi'],['MEDIA','Medya'],
['MILITARY_STRATEGY','Stratejik askeri yonetim'],['TECHNOLOGY','Teknoloji ve AR-GE']
].map(([id,name])=>Object.freeze({id,name})));
const STORY_PLAYER_AGENCY_BINDINGS=Object.create(null);
function storyPlayerAgencyClone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function storyPlayerAgencyLedgerCreate(){return {schemaVersion:1,sequence:0,receipts:[],diagnostics:{rejectedActions:0}};}
function storyPlayerAgencyValidate(ledger){
 const issues=[];
 if(!ledger||typeof ledger!=='object'||Array.isArray(ledger))return {ok:false,issues:[{code:'AGENCY_LEDGER_REQUIRED',path:'$'}]};
 if(ledger.schemaVersion!==1)issues.push({code:'AGENCY_SCHEMA_VERSION',path:'$.schemaVersion'});
 if(!Number.isInteger(ledger.sequence)||ledger.sequence<0)issues.push({code:'AGENCY_SEQUENCE',path:'$.sequence'});
 if(!Array.isArray(ledger.receipts)||ledger.receipts.length>240)issues.push({code:'AGENCY_RECEIPTS_BOUNDED',path:'$.receipts'});
 else{
  const ids=new Set();
  ledger.receipts.forEach((r,i)=>{
   if(!r||!r.id||ids.has(r.id))issues.push({code:'AGENCY_RECEIPT_ID',path:`$.receipts[${i}].id`});else ids.add(r.id);
   if(!STORY_PLAYER_AGENCY_FAMILIES.some(f=>f.id===r.familyId))issues.push({code:'AGENCY_RECEIPT_FAMILY',path:`$.receipts[${i}].familyId`});
   if(r.worldMutation!==true||!r.canonicalReceipt)issues.push({code:'AGENCY_RECEIPT_NOT_PHYSICAL',path:`$.receipts[${i}]`});
  });
 }
 return {ok:issues.length===0,issues};
}
function storyPlayerAgencyEnsure(){if(!STORY.playerAgency)STORY.playerAgency=storyPlayerAgencyLedgerCreate();return STORY.playerAgency;}
function storyPlayerAgencyReset(){STORY.playerAgency=storyPlayerAgencyLedgerCreate();return STORY.playerAgency;}
function storyPlayerAgencyRestore(saved){
 if(!saved||!storyPlayerAgencyValidate(saved).ok)return storyPlayerAgencyReset();
 STORY.playerAgency=storyPlayerAgencyClone(saved);return STORY.playerAgency;
}
function storyPlayerAgencyForSave(){
 const ledger=storyPlayerAgencyEnsure(),v=storyPlayerAgencyValidate(ledger);
 if(!v.ok)throw new Error(`PLAYER_AGENCY_INVALID:${v.issues[0].code}`);
 return storyPlayerAgencyClone(ledger);
}
function storyPlayerAgencyRegister(binding){
 const familyId=String(binding&&binding.familyId||'');
 if(!STORY_PLAYER_AGENCY_FAMILIES.some(f=>f.id===familyId))throw new Error(`PLAYER_AGENCY_UNKNOWN_FAMILY:${familyId}`);
 if(!binding.actionId||typeof binding.preview!=='function'||typeof binding.execute!=='function')throw new Error(`PLAYER_AGENCY_INVALID_BINDING:${familyId}`);
 const key=`${familyId}:${binding.actionId}`;
 if(STORY_PLAYER_AGENCY_BINDINGS[key])throw new Error(`PLAYER_AGENCY_DUPLICATE_BINDING:${key}`);
 STORY_PLAYER_AGENCY_BINDINGS[key]=Object.freeze(Object.assign({},binding,{familyId}));
 return STORY_PLAYER_AGENCY_BINDINGS[key];
}
function storyPlayerAgencyBinding(familyId,actionId){return STORY_PLAYER_AGENCY_BINDINGS[`${familyId}:${actionId}`]||null;}
function storyPlayerAgencyPreview(familyId,actionId,input){
 const b=storyPlayerAgencyBinding(familyId,actionId);
 if(!b)return {allowed:false,code:'PLAYER_ACTION_NOT_BOUND',reasons:['Gercek motor komutu baglanmadi.']};
 return Object.assign({allowed:false,reasons:[]},b.preview(input||{})||{},{familyId:b.familyId,actionId:b.actionId,actionName:b.name,owner:b.owner});
}
function storyPlayerAgencyExecute(familyId,actionId,input){
 const ledger=storyPlayerAgencyEnsure(),b=storyPlayerAgencyBinding(familyId,actionId),preview=storyPlayerAgencyPreview(familyId,actionId,input);
 if(!b||!preview.allowed){ledger.diagnostics.rejectedActions++;return {ok:false,code:preview.code||'PLAYER_ACTION_DENIED',preview};}
 const result=b.execute(input||{},preview)||{};
 if(!result.ok||result.worldMutation!==true||!result.canonicalReceipt){ledger.diagnostics.rejectedActions++;return {ok:false,code:result.code||'CANONICAL_MUTATION_NOT_PROVEN',preview,result};}
 const receipt={id:`player-action:${++ledger.sequence}`,familyId:b.familyId,actionId:b.actionId,actorId:preview.actorId||null,authoritySource:preview.authoritySource||null,cost:storyPlayerAgencyClone(preview.cost||null),createdAt:Math.round((Number(STORY.clock)||0)*1e6)/1e6,worldMutation:true,canonicalReceipt:storyPlayerAgencyClone(result.canonicalReceipt)};
 ledger.receipts.push(receipt);if(ledger.receipts.length>240)ledger.receipts.shift();
 return {ok:true,receipt,result};
}
function storyPlayerAgencyFamilyView(){
 const bindings=Object.values(STORY_PLAYER_AGENCY_BINDINGS);
 return STORY_PLAYER_AGENCY_FAMILIES.map(f=>{
  const actions=bindings.filter(b=>b.familyId===f.id).map(b=>storyPlayerAgencyPreview(b.familyId,b.actionId,{}));
  const grounded=actions.filter(a=>a.owner&&a.owner!=='UNASSIGNED');
  return {id:f.id,name:f.name,status:grounded.length?'ACTIONABLE':'NO_PLAYER_COMMAND',actionCount:grounded.length,actions};
 });
}
function storyPlayerAgencyAcceptance(){
 const families=storyPlayerAgencyFamilyView(),actionable=families.filter(f=>f.status==='ACTIONABLE').length;
 return {total:families.length,actionable,closed:actionable===families.length,missing:families.filter(f=>f.status!=='ACTIONABLE').map(f=>f.id),families};
}


function storyPlayerAgencyEscape(value) {
    return typeof storyProjectionEscape === 'function'
        ? storyProjectionEscape(String(value == null ? '' : value))
        : String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
}
function storyPlayerAgencyCostLabel(cost) {
    if (!cost) return 'Dogrudan maliyet yok';
    return Object.entries(cost).map(([key, value]) => `${key}: ${value}`).join(' / ');
}
function storyPlayerAgencyRenderHtml(families) {
    const rows = (families || storyPlayerAgencyFamilyView()).map(family => {
        const action = family.actions[0];
        if (!action) return `<article class="agency-card locked"><h4>${storyPlayerAgencyEscape(family.name)}</h4><p>Gercek komut baglanmadi.</p></article>`;
        const reasons = (action.reasons || []).join(' ');
        const armedKey = `${action.familyId}:${action.actionId}`;
        const destructive = action.actionId === 'RESIGN_OFFICE';
        const armed = STORY._playerAgencyConfirmKey === armedKey;
        return `<article class="agency-card${action.allowed ? '' : ' locked'}">`
            + `<h4>${storyPlayerAgencyEscape(family.name)}</h4><b>${storyPlayerAgencyEscape(action.actionName)}</b>`
            + `<small>BEDEL - ${storyPlayerAgencyEscape(storyPlayerAgencyCostLabel(action.cost))}</small>`
            + (action.allowed
                ? `<button class="story-btn agency-execute${armed ? ' armed' : ''}" data-agency-family="${action.familyId}" data-agency-action="${action.actionId}">${destructive && !armed ? 'ONAY HAZIRLA' : 'UYGULA'}</button>`
                : `<p class="governance-lock">${storyPlayerAgencyEscape(reasons || 'Bu rolde kullanilamaz.')}</p>`)
            + `</article>`;
    }).join('');
    return `<section class="player-agency-workspace"><h3>OYUNCU EYLEM ALANLARI - 18 SISTEM</h3>`
        + `<p class="agency-intro">Yalniz rolunun gercek yetkisi olan eylemler acilir. Her sonuc kanonik deftere makbuz yazar.</p>`
        + `<div class="agency-grid">${rows}</div></section>`;
}
function storyPlayerAgencyHandleClick(event) {
    const button = event && event.target && event.target.closest
        ? event.target.closest('[data-agency-family][data-agency-action]') : null;
    if (!button || button.disabled) return false;
    const familyId = button.dataset.agencyFamily;
    const actionId = button.dataset.agencyAction;
    const key = `${familyId}:${actionId}`;
    if (actionId === 'RESIGN_OFFICE' && STORY._playerAgencyConfirmKey !== key) {
        STORY._playerAgencyConfirmKey = key;
        if (typeof storyFlash === 'function') storyFlash('Makam kalici olarak devredilecek. Ikinci kez UYGULA.');
        if (typeof storyGovernanceUpdate === 'function') storyGovernanceUpdate();
        return { ok: false, code: 'CONFIRMATION_REQUIRED' };
    }
    STORY._playerAgencyConfirmKey = null;
    const result = storyPlayerAgencyExecute(familyId, actionId, {});
    if (typeof storyFlash === 'function') {
        storyFlash(result.ok ? 'Eylem kanonik deftere uygulandi ve makbuzlandi.'
            : ((result.preview && result.preview.reasons && result.preview.reasons[0])
                || result.code || 'Eylem uygulanamadi.'));
    }
    if (typeof storyGovernanceUpdate === 'function') storyGovernanceUpdate();
    return result;
}
