// ILERI MODEL KAPISI — ayni fork'tan yapilan rollout'lar BIREBIR ayni mi?
//
// NEDEN AYRI BIR KAPI: --forktest bir fork'u BIR KEZ oynatir; "geleceği gorme"
// (arama) ise AYNI durumu DEFALARCA oynatir. Ikincisini sinamayan kapi, arama icin
// olumcul bir kusuru gozden kacirir. Nitekim kacirdi: SIM.spatialGrid restore'da
// yeniden kurulmuyordu ve AI, stepSim sirasi geregi (driveController ONCE, grid
// SONRA) bir onceki rollout'un izgarasini okuyordu.
//
// KAPSAM: 3 tohum x 3 fork ani (400/1200/2000 tik) x 3 rollout uzunlugu (2/10/30sn)
// = 27 sinama; her biri 3 kez kosulup hash esitligi aranir.
//
//   node tools/ileri-model-kapisi.js
const vm=require('node:vm');
const {tezgahKur}=require('c:/Users/osman/Documents/GitHub/pixel-rts/tools/muharebe-tezgah.js');
const {ctx}=tezgahKur();
const r=vm.runInContext(`(() => {
  const sonuc=[];
  for (const seed of [100777, 100778, 100779]) {
    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
    openBattlefieldSession({mode:'quick',mapId:-2,seed:seed,attackerSide:true,durationSec:360,playerMoney:6500,enemyMoney:6500,show:false});
    BATTLE_REPLAY.telemetry=null;
    const mv=battleBuildArmyManifest(6500,{maxUnits:48,combatFocused:true,varied:true,brainIntel4:true,isAttacker:false});
    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
    battleDeployManifest(mv,false,{source:'ss',ally:true});
    startBattle(); SIM.headless=true;
    let st=0;
    for (const forkTik of [400, 1200, 2000]) {
      while (SIM.tick < forkTik && phase===PHASE.BATTLE) { st+=BATTLE_TICK_MS; stepSim(st,BATTLE_TICK_SEC,battleControllersDrive,false); }
      if (phase!==PHASE.BATTLE) break;
      const f=battleForkCapture();
      for (const uzunluk of [40, 200, 600]) {
        const h=[];
        for (let k=0;k<3;k++){ battleForkRestore(f); let s2=st;
          for(let i=0;i<uzunluk;i++){ s2+=BATTLE_TICK_MS; stepSim(s2,BATTLE_TICK_SEC,battleControllersDrive,false); }
          h.push(String(battleStateHash())); }
        sonuc.push({ seed, forkTik, uzunluk, ayni: (h[0]===h[1] && h[1]===h[2]) });
      }
      battleForkRestore(f);
    }
  }
  const basarisiz = sonuc.filter(x=>!x.ayni);
  return { toplamSinama: sonuc.length, gecen: sonuc.length-basarisiz.length, basarisiz };
})()`,ctx,{filename:'ss'});
console.log('ILERI MODEL KAPISI — ' + r.gecen + '/' + r.toplamSinama + ' sinama gecti');
if (r.basarisiz.length) {
    console.log('BASARISIZ (ayni fork, farkli sonuc):');
    for (const x of r.basarisiz) console.log('  tohum ' + x.seed + '  fork@' + x.forkTik + '  rollout ' + x.uzunluk + ' tik');
    console.log('ILERIMODEL_PROBLEM');
    process.exit(1);
}
console.log('ILERIMODEL_OK');
