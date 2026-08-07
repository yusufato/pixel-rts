<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>Pixel RTS — Taktik Hologram Avrupa (1C)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<script src="https://unpkg.com/d3@7.9.0/dist/d3.min.js" integrity="sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i" crossorigin="anonymous"></script>
<script src="https://unpkg.com/topojson-client@3.1.0/dist/topojson-client.min.js" integrity="sha384-Ukv1p/xTma6P4/2bY5KzWBw+ydSpXmhCMtyciIQVDJ1RmOxtCYNMF1uXT9T63H67" crossorigin="anonymous"></script>
<style>
  :root{ --ac:#ffb000; --ac2:#4ade80; --red:#ff6b6b; --line:rgba(255,176,0,.22); --panel:rgba(8,12,6,.9); }
  html,body{ margin:0; height:100%; }
  body{ background:#060a06; font-family:'Share Tech Mono',monospace; color:#ffd27a; overflow:hidden; }
  a{ color:var(--ac); } a:hover{ color:#ffe9bf; }
  .screen{ height:100vh; display:flex; flex-direction:column; }
  .topbar{ height:62px; flex:none; display:flex; align-items:stretch; border-bottom:1px solid var(--line); background:rgba(8,12,6,.95); z-index:10; }
  .logo{ padding:12px 18px; display:flex; flex-direction:column; justify-content:center; }
  .logo b{ font-family:'Press Start 2P',monospace; font-size:14px; color:#ffe9bf; letter-spacing:3px; }
  .logo b em{ font-style:normal; color:var(--ac); }
  .logo span{ font-size:9px; color:#6e6330; letter-spacing:2px; margin-top:5px; }
  .stat{ border-left:1px solid var(--line); padding:10px 18px; display:flex; flex-direction:column; justify-content:center; min-width:80px; }
  .stat i{ font-style:normal; font-size:9px; color:#8c7a3e; letter-spacing:2px; }
  .stat b{ font-size:15px; color:#ffe9bf; margin-top:4px; font-weight:normal; }
  .stat.green b{ color:var(--ac2); }
  .tbtns{ margin-left:auto; display:flex; align-items:center; gap:8px; padding-right:14px; }
  .tbtn{ border:1px solid var(--line); background:rgba(20,16,4,.6); color:#ffd27a; font-size:11px; letter-spacing:2px; padding:8px 12px; cursor:pointer; }
  .tbtn:hover{ border-color:var(--ac); color:#ffe9bf; }
  .main{ flex:1; display:flex; min-height:0; }
  .maparea{ flex:1; position:relative; overflow:hidden; background:#03080f; }
  #cv{ position:absolute; inset:0; width:100%; height:100%; cursor:grab; }
  #cv.drag{ cursor:grabbing; }
  .scan{ position:absolute; inset:0; z-index:5; pointer-events:none; background:repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px); }
  .grid{ position:absolute; inset:0; z-index:4; pointer-events:none;
    background:linear-gradient(rgba(255,176,0,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,176,0,.045) 1px, transparent 1px);
    background-size:60px 60px; }
  .vig{ position:absolute; inset:0; z-index:5; pointer-events:none; background:radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,.5)); }
  .horiz{ position:absolute; inset:0; z-index:3; pointer-events:none; background:linear-gradient(rgba(255,176,0,.07), transparent 18%); }
  .tag{ position:absolute; top:14px; left:14px; z-index:6; background:rgba(8,12,6,.85); border:1px solid var(--line); color:#ffd27a; font-size:10px; letter-spacing:2px; padding:6px 10px; max-width:calc(100% - 280px); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .zoomlvl{ position:absolute; top:14px; right:14px; z-index:6; background:rgba(8,12,6,.85); border:1px solid var(--line); color:#8c7a3e; font-size:10px; letter-spacing:2px; padding:6px 10px; }
  .zoomlvl b{ color:var(--ac); font-weight:normal; }
  .fkeys{ position:absolute; bottom:38px; left:14px; z-index:6; display:flex; gap:8px; }
  .fkey{ background:rgba(8,12,6,.88); border:1px solid var(--line); color:#ffd27a; font-size:10px; letter-spacing:2px; padding:9px 12px; cursor:pointer; }
  .fkey:hover{ border-color:var(--ac); }
  .fkey.on{ border-color:var(--ac); color:#ffe9bf; background:rgba(50,36,4,.85); }
  .maphint{ position:absolute; bottom:10px; left:14px; z-index:6; font-size:9px; letter-spacing:2px; color:#6e6330; }
  .legend{ position:absolute; bottom:10px; right:14px; z-index:6; font-size:9px; letter-spacing:1px; color:#8c7a3e; display:flex; gap:14px; background:rgba(8,12,6,.7); padding:5px 9px; border:1px solid rgba(255,176,0,.12); }
  .legend s{ text-decoration:none; display:inline-flex; align-items:center; gap:5px; }
  .dotc{ width:7px; height:7px; display:inline-block; }
  .side{ width:322px; flex:none; border-left:1px solid var(--line); background:rgba(6,10,6,.97); display:flex; flex-direction:column; z-index:10; overflow-y:auto; }
  .side h3{ font-size:11px; letter-spacing:3px; color:var(--ac); margin:0; padding:16px 16px 3px; font-weight:normal; }
  .side .era{ font-size:9px; letter-spacing:2px; color:#6e6330; padding:0 16px 10px; border-bottom:1px solid var(--line); }
  .cityrow{ display:flex; align-items:center; justify-content:space-between; padding:14px 16px 10px; gap:8px; }
  .cityrow b{ font-family:'Press Start 2P',monospace; font-size:12px; color:#ffe9bf; font-weight:normal; }
  .chip{ font-size:8px; letter-spacing:1px; padding:4px 6px; white-space:nowrap; }
  .chip.g{ color:var(--ac2); border:1px solid rgba(74,222,128,.5); }
  .chip.r{ color:var(--red); border:1px solid rgba(255,107,107,.5); }
  .fields{ padding:4px 16px; display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .field{ border:1px solid var(--line); padding:8px 10px; }
  .field i{ font-style:normal; display:block; font-size:8px; letter-spacing:2px; color:#8c7a3e; }
  .field b{ display:block; font-size:12px; color:#ffe9bf; margin-top:4px; font-weight:normal; }
  .field b.g{ color:var(--ac2); } .field b.r{ color:var(--red); }
  .note{ margin:10px 16px 0; border-left:2px solid var(--ac); background:rgba(50,36,4,.35); font-size:10px; color:#cfa14c; padding:8px 10px; line-height:1.5; }
  .bigbtn{ margin:12px 16px 0; border:1px solid var(--ac); color:var(--ac); text-align:center; font-size:11px; letter-spacing:3px; padding:13px 0; background:rgba(50,36,4,.25); cursor:pointer; }
  .bigbtn:hover{ background:rgba(80,56,4,.45); color:#ffe9bf; }
  .bigbtn.red{ border-color:var(--red); color:var(--red); background:rgba(60,10,10,.25); }
  .bigbtn.red:hover{ background:rgba(90,16,16,.4); color:#ffb0b0; }
  .bigbtn.dim{ border-color:#4a4020; color:#6e6330; cursor:default; background:transparent; }
  .loghead{ margin-top:14px; font-size:10px; letter-spacing:3px; color:var(--ac); background:rgba(50,36,4,.4); border-top:1px solid var(--line); border-bottom:1px solid var(--line); padding:8px 16px; }
  .logbody{ padding:10px 16px; font-size:11px; color:#8c7a3e; line-height:1.6; flex:1; }
  .logbody div{ margin-bottom:6px; }
  .logbody div:first-child{ color:#cfa14c; }
  .modal{ position:fixed; inset:0; z-index:50; background:rgba(2,4,2,.7); display:flex; align-items:center; justify-content:center; }
  .mbox{ width:420px; background:var(--panel); border:1px solid var(--ac); box-shadow:0 0 40px rgba(255,176,0,.15); padding:0 0 18px; }
  .mhead{ font-family:'Press Start 2P',monospace; font-size:11px; color:#ffe9bf; padding:16px; border-bottom:1px solid var(--line); letter-spacing:1px; }
  .mbody{ padding:14px 16px; font-size:12px; color:#cfa14c; line-height:1.6; }
  .mrow{ display:flex; gap:10px; padding:0 16px; }
  .mrow .bigbtn{ flex:1; margin:8px 0 0; }
  .hidden{ display:none !important; }
</style>
</head>
<body>
<div class="screen">
  <div class="topbar">
    <div class="logo"><b>PIXEL <em>AVRUPA</em></b><span>TAKTİK HOLOGRAM · MODERN ÇAĞ</span></div>
    <div class="stat green"><i>DEVLET</i><b>Türk Cumhuriyeti</b></div>
    <div class="stat"><i>PETROL</i><b id="r-oil">200</b></div>
    <div class="stat"><i>İNSAN</i><b id="r-man">200</b></div>
    <div class="stat"><i>PUAN</i><b id="r-pts">300</b></div>
    <div class="stat"><i>GÜN</i><b id="r-day">1</b></div>
    <div class="tbtns"><span class="tbtn">DURAKLAT</span><span class="tbtn">KAYDET</span><span class="tbtn">MENÜ</span></div>
  </div>
  <div class="main">
    <div class="maparea">
      <canvas id="cv"></canvas>
      <div class="horiz"></div><div class="grid"></div><div class="scan"></div><div class="vig"></div>
      <div class="tag">TACNET AVRUPA — HOLO-PROJEKSİYON</div>
      <div class="zoomlvl">LOD <b id="lodname">STRATEJİK</b> · ZOOM <b id="zoomval">1.0×</b></div>
      <div class="fkeys"><span class="fkey">01 KONSEY</span><span class="fkey">02 ORDU</span><span class="fkey">03 AR-GE</span><span class="fkey on">04 ŞEHİR</span><span class="fkey">05 KOMUTAN</span></div>
      <div class="maphint">SÜRÜKLE: KAMERA · TEKERLEK: ZOOM · ŞEHİR: BRİFİNG</div>
      <div class="legend">
        <s><span class="dotc" style="background:#4cff7c"></span>DOST</s>
        <s><span class="dotc" style="background:#ff5a5a"></span>CEPHE</s>
        <s><span class="dotc" style="background:#c8b070"></span>FABRİKA</s>
        <s><span class="dotc" style="background:#4ade80"></span>KIŞLA</s>
        <s><span class="dotc" style="background:#3cdc6e"></span>MADEN</s>
        <s><span class="dotc" style="background:#ff8a00"></span>PETROL</s>
      </div>
    </div>
    <div class="side" id="side"></div>
  </div>
</div>
<div class="modal hidden" id="modal"></div>

<script>
// ── VERİ ─────────────────────────────────────────────────────────────────────
const BLOC = {
  turk:{c:'#4cff7c',n:'Türk Cumhuriyeti'}, iber:{c:'#ff8a3c',n:'İber Federasyonu'},
  brit:{c:'#e34c4c',n:'Britanya Topluluğu'}, germ:{c:'#e0d24c',n:'Cermen Federasyonu'},
  nord:{c:'#4cc8ff',n:'Kuzey Paktı'}, slav:{c:'#b07cff',n:'Slav Federasyonu'},
  magr:{c:'#d98cc0',n:'Mağrip Konseyi'}, arab:{c:'#cfa14c',n:'Arap Koalisyonu'}
};
const CB = {
  'Turkey':'turk','Greece':'turk','Bulgaria':'turk','Cyprus':'turk','N. Cyprus':'turk','Albania':'turk','Macedonia':'turk','North Macedonia':'turk','Serbia':'turk','Kosovo':'turk','Montenegro':'turk','Bosnia and Herz.':'turk','Georgia':'turk','Armenia':'turk','Azerbaijan':'turk',
  'Spain':'iber','Portugal':'iber','France':'iber','Italy':'iber','Malta':'iber',
  'United Kingdom':'brit','Ireland':'brit','Iceland':'brit',
  'Germany':'germ','Netherlands':'germ','Belgium':'germ','Luxembourg':'germ','Switzerland':'germ','Austria':'germ','Czechia':'germ','Czech Rep.':'germ','Poland':'germ','Denmark':'germ','Hungary':'germ','Slovakia':'germ','Slovenia':'germ','Croatia':'germ',
  'Norway':'nord','Sweden':'nord','Finland':'nord','Estonia':'nord','Latvia':'nord','Lithuania':'nord',
  'Russia':'slav','Ukraine':'slav','Belarus':'slav','Moldova':'slav','Romania':'slav',
  'Morocco':'magr','Algeria':'magr','Tunisia':'magr','Libya':'magr','W. Sahara':'magr',
  'Egypt':'arab','Israel':'arab','Palestine':'arab','Jordan':'arab','Syria':'arab','Lebanon':'arab','Iraq':'arab','Saudi Arabia':'arab','Kuwait':'arab'
};
const blocOf = f => CB[f.properties.name] || null;

// [ad, lon, lat, tier(3 başkent/2 büyük/1 kasaba), fabrika, petrol, blok]
const CITIES = [
 // Türk bloğu
 ['Ankara',32.85,39.93,3,2,0,'turk'],['İstanbul',28.97,41.01,2,3,0,'turk'],['İzmir',27.14,38.42,2,1,0,'turk'],
 ['Bursa',29.06,40.19,1,1,0,'turk'],['Konya',32.48,37.87,1,0,0,'turk'],['Antalya',30.71,36.89,1,0,0,'turk'],
 ['Adana',35.32,37.00,1,1,0,'turk'],['Gaziantep',37.38,37.07,1,1,0,'turk'],['Trabzon',39.72,41.00,1,0,0,'turk'],
 ['Erzurum',41.27,39.90,1,0,0,'turk'],['Diyarbakır',40.23,37.91,1,0,1,'turk'],['Lefkoşa',33.37,35.17,1,0,0,'turk'],
 ['Atina',23.73,37.98,2,1,0,'turk'],['Selanik',22.94,40.64,1,1,0,'turk'],['Üsküp',21.43,42.00,1,0,0,'turk'],
 ['Tiran',19.82,41.33,1,0,0,'turk'],['Saraybosna',18.41,43.86,1,0,0,'turk'],['Belgrad',20.46,44.79,2,1,0,'turk'],
 ['Sofya',23.32,42.70,2,1,0,'turk'],['Filibe',24.75,42.14,1,0,0,'turk'],['Varna',27.91,43.21,1,0,0,'turk'],
 ['Batum',41.63,41.65,1,0,1,'turk'],['Tiflis',44.79,41.72,2,1,0,'turk'],['Erivan',44.51,40.18,1,0,0,'turk'],['Bakü',49.60,40.41,2,1,1,'turk'],
 // İber
 ['Madrid',-3.70,40.42,3,2,0,'iber'],['Barselona',2.17,41.39,2,2,0,'iber'],['Valensiya',-0.38,39.47,1,0,0,'iber'],
 ['Zaragoza',-0.88,41.65,1,0,0,'iber'],['Bilbao',-2.93,43.26,1,1,0,'iber'],['Sevilla',-5.98,37.39,1,1,0,'iber'],
 ['Granada',-3.60,37.18,1,0,0,'iber'],['Lizbon',-9.14,38.72,2,1,0,'iber'],['Porto',-8.61,41.15,1,1,0,'iber'],
 ['Paris',2.35,48.86,2,3,0,'iber'],['Lyon',4.84,45.76,1,2,0,'iber'],['Marsilya',5.37,43.30,2,1,0,'iber'],
 ['Toulouse',1.44,43.60,1,1,0,'iber'],['Bordeaux',-0.58,44.84,1,0,0,'iber'],['Nantes',-1.55,47.22,1,0,0,'iber'],
 ['Lille',3.06,50.63,1,1,0,'iber'],['Strasbourg',7.75,48.58,1,0,0,'iber'],['Nice',7.27,43.70,1,0,0,'iber'],
 ['Roma',12.50,41.90,2,1,0,'iber'],['Milano',9.19,45.46,2,3,0,'iber'],['Torino',7.69,45.07,1,2,0,'iber'],
 ['Venedik',12.34,45.44,1,0,0,'iber'],['Bologna',11.34,44.49,1,0,0,'iber'],['Floransa',11.26,43.77,1,0,0,'iber'],
 ['Napoli',14.25,40.85,1,1,0,'iber'],['Palermo',13.36,38.12,1,0,0,'iber'],['Cenova',8.93,44.41,1,1,0,'iber'],
 // Britanya
 ['Londra',-0.13,51.51,3,3,0,'brit'],['Birmingham',-1.90,52.48,1,2,0,'brit'],['Manchester',-2.24,53.48,2,3,0,'brit'],
 ['Leeds',-1.55,53.80,1,1,0,'brit'],['Glasgow',-4.25,55.86,1,1,0,'brit'],['Edinburgh',-3.19,55.95,1,0,0,'brit'],
 ['Cardiff',-3.18,51.48,1,0,0,'brit'],['Belfast',-5.93,54.60,1,0,0,'brit'],['Dublin',-6.26,53.35,2,1,0,'brit'],['Cork',-8.47,51.90,1,0,0,'brit'],
 // Cermen
 ['Berlin',13.40,52.52,3,3,0,'germ'],['Hamburg',9.99,53.55,2,2,0,'germ'],['Münih',11.58,48.14,2,2,0,'germ'],
 ['Köln',6.96,50.94,1,2,0,'germ'],['Frankfurt',8.68,50.11,1,2,0,'germ'],['Stuttgart',9.18,48.78,1,2,0,'germ'],
 ['Dresden',13.74,51.05,1,0,0,'germ'],['Leipzig',12.37,51.34,1,1,0,'germ'],['Hannover',9.73,52.37,1,1,0,'germ'],
 ['Nürnberg',11.08,49.45,1,0,0,'germ'],['Amsterdam',4.90,52.37,2,2,0,'germ'],['Rotterdam',4.48,51.92,1,2,0,'germ'],
 ['Anvers',4.40,51.22,1,1,0,'germ'],['Brüksel',4.35,50.85,1,1,0,'germ'],['Zürih',8.54,47.37,1,1,0,'germ'],
 ['Cenevre',6.14,46.20,1,0,0,'germ'],['Basel',7.59,47.56,1,0,0,'germ'],['Viyana',16.37,48.21,2,2,0,'germ'],
 ['Graz',15.44,47.07,1,0,0,'germ'],['Prag',14.42,50.09,2,2,0,'germ'],['Brno',16.61,49.20,1,0,0,'germ'],
 ['Bratislava',17.11,48.15,1,0,0,'germ'],['Budapeşte',19.04,47.50,2,1,0,'germ'],['Varşova',21.01,52.23,2,2,0,'germ'],
 ['Krakov',19.94,50.06,1,1,0,'germ'],['Gdansk',18.65,54.35,1,1,0,'germ'],['Wroclaw',17.03,51.11,1,0,0,'germ'],
 ['Poznan',16.93,52.41,1,0,0,'germ'],['Kopenhag',12.57,55.68,2,1,0,'germ'],['Aarhus',10.20,56.16,1,0,0,'germ'],
 ['Zagreb',15.98,45.81,1,0,0,'germ'],['Ljubljana',14.51,46.05,1,0,0,'germ'],
 // Kuzey
 ['Stokholm',18.07,59.33,3,2,0,'nord'],['Göteborg',11.97,57.71,1,1,0,'nord'],['Malmö',13.00,55.60,1,0,0,'nord'],
 ['Oslo',10.75,59.91,2,1,0,'nord'],['Bergen',5.32,60.39,1,0,0,'nord'],['Helsinki',24.94,60.17,2,1,0,'nord'],
 ['Tampere',23.76,61.50,1,0,0,'nord'],['Turku',22.27,60.45,1,0,0,'nord'],['Tallinn',24.75,59.44,1,0,0,'nord'],
 ['Riga',24.11,56.95,2,1,0,'nord'],['Vilnius',25.28,54.69,1,0,0,'nord'],['Kaunas',23.90,54.90,1,0,0,'nord'],
 // Slav
 ['Moskova',37.62,55.76,3,3,0,'slav'],['St. Petersburg',30.34,59.93,2,2,0,'slav'],['Smolensk',32.05,54.78,1,0,0,'slav'],
 ['Tula',37.62,54.20,1,1,0,'slav'],['Voronej',39.20,51.66,1,0,0,'slav'],['Rostov',39.70,47.24,1,1,0,'slav'],
 ['Krasnodar',38.98,45.04,1,0,1,'slav'],['Volgograd',44.50,48.70,1,1,1,'slav'],['Kazan',49.11,55.79,1,1,0,'slav'],
 ['N. Novgorod',43.94,56.33,1,2,0,'slav'],['Minsk',27.56,53.90,2,1,0,'slav'],['Kiev',30.52,50.45,2,2,0,'slav'],
 ['Lviv',24.03,49.84,1,0,0,'slav'],['Odesa',30.73,46.48,1,1,0,'slav'],['Harkiv',36.23,49.99,1,2,0,'slav'],
 ['Dnipro',35.05,48.47,1,1,0,'slav'],['Kişinev',28.86,47.01,1,0,0,'slav'],['Bükreş',26.10,44.43,2,1,1,'slav'],
 ['Kluj',23.60,46.77,1,0,0,'slav'],['Köstence',28.63,44.17,1,0,1,'slav'],['Yaş',27.60,47.16,1,0,0,'slav'],
 // Mağrip
 ['Cezayir',3.06,36.75,3,1,1,'magr'],['Oran',-0.64,35.70,1,0,1,'magr'],['Kazablanka',-7.59,33.57,2,1,0,'magr'],
 ['Rabat',-6.85,34.02,1,0,0,'magr'],['Marakeş',-8.00,31.63,1,0,0,'magr'],['Fes',-5.00,34.03,1,0,0,'magr'],
 ['Tanca',-5.80,35.78,1,0,0,'magr'],['Tunus',10.17,36.80,2,1,0,'magr'],['Trablus',13.19,32.90,2,0,1,'magr'],['Bingazi',20.07,32.12,1,0,1,'magr'],
 // Arap
 ['Kahire',31.24,30.04,2,2,0,'arab'],['İskenderiye',29.92,31.20,1,1,0,'arab'],['Port Said',32.30,31.26,1,0,0,'arab'],
 ['Şam',36.29,33.51,2,1,0,'arab'],['Halep',37.16,36.20,1,1,0,'arab'],['Beyrut',35.50,33.89,1,0,0,'arab'],
 ['Kudüs',35.21,31.77,1,0,0,'arab'],['Tel Aviv',34.78,32.08,1,1,0,'arab'],['Amman',35.93,31.95,1,0,0,'arab'],
 ['Bağdat',44.36,33.31,2,1,1,'arab'],['Musul',43.13,36.34,1,0,1,'arab'],['Basra',47.78,30.51,1,0,1,'arab'],
 ['Kuveyt',47.98,29.38,1,0,1,'arab'],['Riyad',46.72,24.63,3,1,1,'arab'],['Tebük',36.57,28.38,1,0,0,'arab']
];
const CI={}; CITIES.forEach((c,i)=>CI[c[0]]=i);
// ⛏ MADEN (puan) yatakları olan şehirler
const MINE_CITIES=new Set(['Manchester','Köln','Krakov','Dnipro','Harkiv','Bilbao','Torino','Leipzig','Tula','Erzurum','Marakeş','Tunus']);
const CORRIDORS = [
 ['Kazablanka','Cezayir'],['Cezayir','Tunus'],['Tunus','Trablus'],['Trablus','Kahire'],['Trablus','Bingazi'],
 ['Kahire','Amman'],['Amman','Şam'],['Şam','Bağdat'],['Bağdat','Riyad'],['Şam','Adana'],['Bağdat','Basra'],
 ['Adana','Ankara'],['Ankara','İstanbul'],['Ankara','İzmir'],['İstanbul','Sofya'],['Sofya','Atina'],
 ['Sofya','Belgrad'],['Belgrad','Budapeşte'],['Budapeşte','Viyana'],['Viyana','Prag'],['Viyana','Münih'],
 ['Prag','Berlin'],['Berlin','Varşova'],['Varşova','Minsk'],['Minsk','Moskova'],['Moskova','St. Petersburg'],
 ['St. Petersburg','Helsinki'],['Stokholm','Oslo'],['Kopenhag','Hamburg'],['Hamburg','Berlin'],
 ['Hamburg','Amsterdam'],['Amsterdam','Brüksel'],['Brüksel','Paris'],['Paris','Frankfurt'],['Frankfurt','Münih'],
 ['Paris','Lyon'],['Lyon','Marsilya'],['Zürih','Milano'],['Milano','Roma'],['Roma','Napoli'],
 ['Marsilya','Barselona'],['Barselona','Madrid'],['Madrid','Lizbon'],['Madrid','Sevilla'],
 ['Londra','Manchester'],['Londra','Paris'],['Dublin','Manchester'],['Napoli','Palermo'],['Palermo','Tunus'],
 ['Kiev','Moskova'],['Kiev','Varşova'],['Kiev','Bükreş'],['Bükreş','Sofya'],['Moskova','Volgograd'],['Lyon','Zürih'],
 ['Ankara','Trabzon'],['Trabzon','Batum'],['Batum','Tiflis'],['Tiflis','Bakü'],['Tiflis','Erivan'],
 ['Atina','Selanik'],['Selanik','Üsküp'],['Kopenhag','Malmö'],['Helsinki','Tallinn'],['İzmir','Atina'],
 ['Erzurum','Tiflis'],['Diyarbakır','Musul'],['Kahire','İskenderiye'],['Kudüs','Tel Aviv'],['Antalya','Lefkoşa'],['Lefkoşa','Beyrut']
];
const RANGES = [
 [[[5.5,44.2],[7,45.5],[9,46.3],[11,46.8],[13.5,47.0],[15,47.3]],1.0,1.0],
 [[[-1.5,42.9],[0.5,42.7],[2.5,42.4]],0.7,.8],
 [[[19.5,49.3],[22,49.0],[24,48.2],[25.5,47.0],[25,45.6],[23,45.4]],0.9,.8],
 [[[15.5,45.2],[17.5,43.8],[19.5,42.8],[20.5,41.8]],0.7,.7],
 [[[9.5,44.4],[11.5,43.5],[13.5,42.2],[15,41.2]],0.6,.6],
 [[[6,59.5],[7.5,61],[10,62.5]],1.1,.8],
 [[[30,37.3],[33,37.0],[36,37.5],[39,38.5],[41,39.5],[43,39.8]],0.9,.9],
 [[[35,40.8],[39,40.6]],0.6,.6],
 [[[40,43.3],[44,42.8],[47,42.0]],0.9,1.0],
 [[[-7,31.2],[-4,32.5],[-1,34.0],[2,35.0],[6,35.5],[9,35.8]],0.9,.9],
 [[[44,37.5],[46,35.0],[47.5,33.0]],0.9,.8],
 [[[-5.5,43.0],[-3,42.8]],0.6,.6],[[[-3.2,37.1]],0.5,.6],
 [[[23,42.8],[25.5,42.7]],0.6,.6],[[[3,45.2]],0.7,.5],
 [[[13.5,50.7],[16,50.4]],0.5,.4]
];
const RIVERS = [
 [[8.7,47.6],[7.75,48.58],[7.5,49.4],[6.96,50.94],[6.1,51.8],[4.5,51.9]],
 [[8.6,48.4],[10.5,48.5],[13,48.5],[16.37,48.2],[19,47.4],[19.5,46],[20.5,44.8],[24.5,44.0],[28.0,45.3]],
 [[31.2,30.1],[31.6,28.5],[32.6,26.0],[32.9,24.0]],
 [[2.35,48.86],[1.2,49.35],[0.3,49.45]],
 [[37.6,55.4],[40,54.0],[42.5,50.6],[44.5,48.7],[46.5,47.2]]
];
const BBOX=[[-12,22],[50,63]];
const MAP_NAMES=['Üç Sırt','Açık Ova','Orman Labirenti','Dağ Geçitleri','Merkez Kale','Çifte Koridor','Köşe Kaleleri','Çapraz Sırtlar','Dağınık Tepeler','Geniş Cephe'];

// ── OYUN DURUMU ──────────────────────────────────────────────────────────────
const G = {
  res:{oil:200,man:200,pts:300}, day:1,
  cities: CITIES.map((c,i)=>({id:i,name:c[0],lon:c[1],lat:c[2],tier:c[3],fac:c[4],bar:c[3]>=2?1:0,oil:c[5],mine:MINE_CITIES.has(c[0])?1:0,owner:c[6],garrison:c[3],nb:[]})),
  cmd: CI['Ankara'], sel: CI['Ankara'],
  builtRoads: [], roadMode:false,
  log:['Türk Cumhuriyeti harekâtı başladı. Komşu düşman şehirlere saldırarak genişle.'],
  clock:0
};
function d2(a,b){const dx=a.lon-b.lon,dy=a.lat-b.lat;return dx*dx+dy*dy;}
function addEdge(a,b){ if(a===b)return; if(G.cities[a].nb.indexOf(b)<0)G.cities[a].nb.push(b); if(G.cities[b].nb.indexOf(a)<0)G.cities[b].nb.push(a); }
(function buildGraph(){
  for(const [a,b] of CORRIDORS) addEdge(CI[a],CI[b]);
  for(const c of G.cities){ // 2 en-yakın komşu
    const near=G.cities.filter(o=>o!==c).sort((x,y)=>d2(c,x)-d2(c,y)).slice(0,2);
    for(const n of near) addEdge(c.id,n.id);
  }
  // kopuk bileşenleri bağla
  const comp=new Array(G.cities.length).fill(-1); let nc=0;
  for(let s=0;s<G.cities.length;s++){ if(comp[s]>=0)continue; const q=[s]; comp[s]=nc;
    while(q.length){const u=q.pop(); for(const v of G.cities[u].nb) if(comp[v]<0){comp[v]=nc;q.push(v);}} nc++; }
  for(let c=1;c<nc;c++){ let bi=-1,bj=-1,bd=1e9;
    for(let i=0;i<G.cities.length;i++){ if(comp[i]!==c)continue;
      for(let j=0;j<G.cities.length;j++){ if(comp[j]===c)continue; const d=d2(G.cities[i],G.cities[j]); if(d<bd){bd=d;bi=i;bj=j;} } }
    if(bi>=0){ addEdge(bi,bj); const mg=comp[bj]; for(let i=0;i<G.cities.length;i++) if(comp[i]===c)comp[i]=mg; } }
})();

// ── DÜNYA KATMANLARI (statik offscreen) ──────────────────────────────────────
const WW=4500; let WH=3600, proj, worldBase, worldRoads;
function bboxPts(b){ return {type:'MultiPoint',coordinates:[[b[0][0],b[0][1]],[b[1][0],b[0][1]],[b[1][0],b[1][1]],[b[0][0],b[1][1]]]}; }
function renderWorld(world){
  proj = d3.geoMercator().fitWidth(WW, bboxPts(BBOX));
  const bnd = d3.geoPath(proj).bounds(bboxPts(BBOX));
  WH = Math.ceil(bnd[1][1]);
  worldBase=document.createElement('canvas'); worldBase.width=WW; worldBase.height=WH;
  worldRoads=document.createElement('canvas'); worldRoads.width=WW; worldRoads.height=WH;
  const ctx=worldBase.getContext('2d'), path=d3.geoPath(proj,ctx);
  const P=(lon,lat)=>proj([lon,lat]);
  const pxDeg=Math.abs(P(11,48)[0]-P(10,48)[0]);
  // deniz
  const sg=ctx.createLinearGradient(0,0,0,WH);
  sg.addColorStop(0,'#03080f'); sg.addColorStop(.55,'#061423'); sg.addColorStop(1,'#0a1e33');
  ctx.fillStyle=sg; ctx.fillRect(0,0,WW,WH);
  // deniz yapısı: dalga dokusu (yatay kısa çizgiler) + kıyı sığlık bandı
  ctx.strokeStyle='rgba(120,180,220,.055)'; ctx.lineWidth=1;
  for(let wy=0;wy<WH;wy+=22){
    ctx.beginPath();
    for(let wx=((wy*7)%44);wx<WW;wx+=44){ ctx.moveTo(wx,wy+Math.sin(wx*.01+wy)*2); ctx.lineTo(wx+16,wy+Math.sin(wx*.01+wy)*2); }
    ctx.stroke();
  }
  ctx.save(); ctx.beginPath(); path(world.coastMesh);
  ctx.strokeStyle='rgba(80,170,220,.10)'; ctx.lineWidth=22; ctx.stroke();
  ctx.strokeStyle='rgba(110,190,235,.14)'; ctx.lineWidth=10; ctx.stroke();
  ctx.restore();
  // derinlik ekstrüzyonu
  ctx.fillStyle='#01060c';
  for(let d=10;d>=1;d--){ ctx.save(); ctx.translate(0,d); ctx.beginPath(); path(world.land); ctx.fill(); ctx.restore(); }
  // arazi
  ctx.save(); ctx.beginPath(); path(world.land); ctx.clip();
  const yT=P(0,BBOX[1][1])[1], yB=P(0,BBOX[0][1])[1];
  const lg=ctx.createLinearGradient(0,yT,0,yB);
  lg.addColorStop(0,'rgb(16,34,26)'); lg.addColorStop(.5,'rgb(20,42,30)'); lg.addColorStop(1,'rgb(34,40,26)');
  ctx.fillStyle=lg; ctx.fillRect(0,0,WW,WH);
  const y35=P(0,35)[1], y28=P(0,28)[1];
  const dg=ctx.createLinearGradient(0,y35,0,y28);
  dg.addColorStop(0,'rgba(64,58,34,0)'); dg.addColorStop(1,'rgba(72,64,36,.9)');
  ctx.fillStyle=dg; ctx.fillRect(0,y35,WW,WH-y35);
  const y57=P(0,57)[1];
  const fg=ctx.createLinearGradient(0,y57,0,0);
  fg.addColorStop(0,'rgba(10,30,22,0)'); fg.addColorStop(1,'rgba(8,26,20,.75)');
  ctx.fillStyle=fg; ctx.fillRect(0,0,WW,y57+2);
  for(const [pts,r,str] of RANGES){ // dağlar: amber kontur ışıması + gölge
    const rr=r*pxDeg;
    for(let i=0;i<pts.length;i++){
      const segs=i<pts.length-1?3:1;
      for(let s=0;s<segs;s++){
        const t=s/segs,a=pts[i],b=pts[Math.min(i+1,pts.length-1)];
        const p=P(a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t);
        let g2=ctx.createRadialGradient(p[0],p[1],0,p[0],p[1],rr);
        g2.addColorStop(0,`rgba(46,58,38,${.9*str})`); g2.addColorStop(1,'rgba(46,58,38,0)');
        ctx.fillStyle=g2; ctx.fillRect(p[0]-rr,p[1]-rr,rr*2,rr*2);
        g2=ctx.createRadialGradient(p[0]-rr*.25,p[1]-rr*.25,0,p[0]-rr*.25,p[1]-rr*.25,rr*.6);
        g2.addColorStop(0,`rgba(255,190,60,${.32*str})`); g2.addColorStop(1,'rgba(255,190,60,0)');
        ctx.fillStyle=g2; ctx.fillRect(p[0]-rr*2,p[1]-rr*2,rr*3.2,rr*3.2);
        g2=ctx.createRadialGradient(p[0]+rr*.3,p[1]+rr*.3,0,p[0]+rr*.3,p[1]+rr*.3,rr*.9);
        g2.addColorStop(0,`rgba(0,0,0,${.45*str})`); g2.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g2; ctx.fillRect(p[0]-rr,p[1]-rr,rr*2.5,rr*2.5);
      }
    }
  }
  // doku
  const rnd=(sx=>()=> (sx=(sx*1103515245+12345)&0x7fffffff)/0x7fffffff)(7);
  ctx.fillStyle='rgba(0,0,0,.06)'; for(let i=0;i<9000;i++) ctx.fillRect(rnd()*WW,rnd()*WH,3,3);
  ctx.fillStyle='rgba(255,190,80,.03)'; for(let i=0;i<5000;i++) ctx.fillRect(rnd()*WW,rnd()*WH,3,3);
  // politik
  for(const f of world.features){
    const b=blocOf(f); ctx.beginPath(); path(f);
    if(b){ ctx.fillStyle=BLOC[b].c; ctx.globalAlpha=.15; ctx.fill(); }
    else{ ctx.fillStyle='#777'; ctx.globalAlpha=.04; ctx.fill(); }
    ctx.globalAlpha=1;
  }
  ctx.restore();
  // nehirler
  ctx.strokeStyle='rgba(60,150,200,.5)'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.lineJoin='round';
  for(const rv of RIVERS){ ctx.beginPath(); rv.forEach((pt,i)=>{const p=P(pt[0],pt[1]); i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]);}); ctx.stroke(); }
  // sınırlar + kıyı + cephe
  ctx.beginPath(); path(world.innerMesh); ctx.strokeStyle='rgba(255,176,0,.12)'; ctx.lineWidth=1; ctx.stroke();
  ctx.beginPath(); path(world.coastMesh); ctx.strokeStyle='rgba(255,176,0,.55)'; ctx.lineWidth=1.4; ctx.stroke();
  ctx.save(); ctx.beginPath(); path(world.frontMesh);
  ctx.strokeStyle='#ff4646'; ctx.lineWidth=2.6; ctx.setLineDash([9,5]); ctx.shadowColor='#ff4646'; ctx.shadowBlur=8; ctx.stroke(); ctx.restore();
  // yol katmanı
  const rc=worldRoads.getContext('2d');
  rc.strokeStyle='rgba(255,176,0,.6)'; rc.lineWidth=1.6; rc.setLineDash([6,4]); rc.lineCap='round';
  const drawn=new Set();
  for(const c of G.cities) for(const n of c.nb){
    const key=Math.min(c.id,n)+'-'+Math.max(c.id,n); if(drawn.has(key))continue; drawn.add(key);
    const o=G.cities[n], p=P(c.lon,c.lat), q=P(o.lon,o.lat);
    const mx=(p[0]+q[0])/2,my=(p[1]+q[1])/2-Math.hypot(q[0]-p[0],q[1]-p[1])*.07;
    rc.beginPath(); rc.moveTo(p[0],p[1]); rc.quadraticCurveTo(mx,my,q[0],q[1]); rc.stroke();
  }
}

// ── KAMERA + PERSPEKTİF WARP ─────────────────────────────────────────────────
const cv=document.getElementById('cv'), g=cv.getContext('2d');
const cam={x:0,y:0,z:.5};
const PP=.8;
let CW=800,CH=600;
const sxOf=u=>(1+PP*u)*(1+PP*u)/(1+PP);
const vyOf=u=>CH*(1+PP)*u/(1+PP*u);
const uOfVy=vy=>{const v=vy/CH; return v/(1+PP-PP*v);};
function s2w(X,Y){ const u=Y/CH, vy=vyOf(u), vx=(X-CW/2)/sxOf(u)+CW/2; return [cam.x+vx/cam.z, cam.y+vy/cam.z]; }
function w2s(wx,wy){ const vx=(wx-cam.x)*cam.z, vy=(wy-cam.y)*cam.z; const u=uOfVy(vy);
  return [ (vx-CW/2)*sxOf(u)+CW/2, u*CH, u ]; }
function resize(){ const r=cv.parentElement.getBoundingClientRect(); CW=cv.width=r.width; CH=cv.height=r.height; dirty=true; }
window.addEventListener('resize',resize);
function fitCam(){ cam.z=CW/WW*1.02; cam.x=(WW-CW/cam.z)/2; cam.y=(WH-vyOf(1)/cam.z)/2*0.9; clampCam(); }
function minZ(){ return CW/WW*0.95; }
function clampCam(){
  cam.z=Math.max(minZ(),Math.min(5,cam.z));
  const vw=CW/cam.z/Math.min(1,sxOf(0)); // en geniş görünür şerit
  cam.x=Math.max(-vw*.25,Math.min(WW-vw*.6,cam.x));
  const vh=vyOf(1)/cam.z;
  cam.y=Math.max(-vh*.15,Math.min(WH-vh*.7,cam.y));
}
function lod(){ const rel=cam.z/minZ(); return rel<1.9?0:rel<3.6?1:2; }

// ── ÇİZİM ────────────────────────────────────────────────────────────────────
let dirty=true, pulses=[];
function draw(ts){
  requestAnimationFrame(draw);
  G.clock=ts/1000;
  if(!worldBase) return;
  if(!dirty && !pulses.length && !anim.length) { /* nabız için yine akıt */ }
  dirty=false;
  g.clearRect(0,0,CW,CH);
  g.fillStyle='#03080f'; g.fillRect(0,0,CW,CH);
  g.imageSmoothingEnabled=true;
  const L=lod(), band=3;
  const roadA=L===0?.28:L===1?.6:1;
  for(let ys=0;ys<CH;ys+=band){
    const u0=ys/CH,u1=Math.min(1,(ys+band)/CH);
    const wy0=cam.y+vyOf(u0)/cam.z, wy1=cam.y+vyOf(u1)/cam.z;
    const sxc=sxOf((u0+u1)/2);
    const srcX=cam.x+(CW/2*(1-1/sxc))/cam.z, srcW=CW/(sxc*cam.z);
    const sh=Math.max(.01,wy1-wy0);
    try{
      g.drawImage(worldBase,srcX,wy0,srcW,sh,0,ys,CW,band+.5);
      if(roadA>0){ g.globalAlpha=roadA; g.drawImage(worldRoads,srcX,wy0,srcW,sh,0,ys,CW,band+.5); g.globalAlpha=1; }
    }catch(e){}
  }
  // oyuncu yolları (altın, dolu çizgi)
  g.save(); g.strokeStyle='#ffd27a'; g.lineWidth=2; g.shadowColor='#ffb000'; g.shadowBlur=6;
  for(const [a,b] of G.builtRoads){ warpLine(G.cities[a],G.cities[b]); }
  g.restore();
  // yol modu adayları
  if(G.roadMode){
    const s=G.cities[G.sel];
    g.save(); g.strokeStyle='rgba(76,200,255,.9)'; g.setLineDash([4,4]); g.lineWidth=1.6;
    for(const t of roadCandidates(s)){ warpLine(s,G.cities[t]); }
    g.restore();
  }
  const cmdC=G.cities[G.cmd];
  // şehirler
  g.textAlign='center';
  for(const c of G.cities){
    const pw=proj([c.lon,c.lat]);
    const [X,Y,u]=w2s(pw[0],pw[1]);
    if(u<-0.04||u>1.05||X<-30||X>CW+30) continue;
    if(L===0&&c.tier<2&&c.id!==G.cmd&&c.id!==G.sel) continue;
    const sc=.7+sxOf(u)*.5;
    const col=BLOC[c.owner].c;
    const isNb=cmdC.nb.indexOf(c.id)>=0;
    const ph=(4+c.tier*7)*sc;
    // şehir görseli: pixel bina kümesi (tier: 2/4/6 bina, amber pencereler)
    const nB=c.tier*2, bw=5*sc, bx0=X-(nB*bw)/2;
    for(let b=0;b<nB;b++){
      const bh=(3+((b*7+c.id)%3)+(b===Math.floor(nB/2)?c.tier:0))*sc;
      const bx=bx0+b*bw;
      g.fillStyle='rgba(4,10,8,.9)'; g.fillRect(bx,Y-bh,bw-1,bh);
      g.strokeStyle='rgba(255,176,0,.35)'; g.lineWidth=.8; g.strokeRect(bx,Y-bh,bw-1,bh);
      g.fillStyle='rgba(255,208,110,.8)';
      for(let wy2=Y-bh+1.5*sc;wy2<Y-1.5*sc;wy2+=2.4*sc){ if(((b+c.id+Math.round(wy2))%3)!==0) g.fillRect(bx+1.4*sc,wy2,1.1*sc,1.1*sc); }
    }
    // sütun
    g.save(); g.strokeStyle=col; g.shadowColor=col; g.shadowBlur=8; g.lineWidth=2*sc; g.globalAlpha=.95;
    g.beginPath(); g.moveTo(X,Y); g.lineTo(X,Y-ph); g.stroke();
    g.fillStyle=c.tier===3?'#ffe9bf':col; g.fillRect(X-3*sc,Y-ph-3*sc,6*sc,6*sc);
    g.restore();
    g.beginPath(); g.ellipse(X,Y,5*sc,2.2*sc,0,0,7); g.strokeStyle=col; g.globalAlpha=.5; g.lineWidth=1; g.stroke(); g.globalAlpha=1;
    // erişim halkaları
    if(isNb&&c.owner!=='turk'){ const pu=3+2*(1+Math.sin(G.clock*4+c.id));
      g.strokeStyle='rgba(255,70,70,.95)'; g.lineWidth=2; g.strokeRect(X-(6+pu)*sc,Y-(6+pu)*sc*.6,12*sc+pu*2,(12*sc+pu*2)*.6); }
    else if(isNb&&c.owner==='turk'){ g.strokeStyle='rgba(120,235,160,.75)'; g.lineWidth=1.6;
      g.strokeRect(X-8*sc,Y-5*sc,16*sc,10*sc); }
    // fabrika
    if(c.fac>0&&(L===2||(L===1&&c.tier>=2)||c.tier===3)){
      const fx=X+9*sc, fy=Y-2;
      g.fillStyle='rgba(0,0,0,.65)'; g.fillRect(fx-1,fy-6*sc,10*sc,7*sc);
      g.fillStyle='#c8b070'; g.fillRect(fx,fy-5*sc,8*sc,5.5*sc);
      for(let k=0;k<Math.min(c.fac,3);k++){ g.fillRect(fx+(1+k*3)*sc,fy-9*sc,2*sc,4*sc); g.fillStyle='#ffb000'; g.fillRect(fx+(1+k*3)*sc,fy-10*sc,2*sc,1.4*sc); g.fillStyle='#c8b070'; }
    }
    if(c.oil&&(L>=1||c.tier>=2)){
      const ox=X-11*sc, oy=Y-2;
      g.strokeStyle='#ff8a00'; g.lineWidth=1.4;
      g.beginPath(); g.moveTo(ox-4*sc,oy+4*sc); g.lineTo(ox,oy-6*sc); g.lineTo(ox+4*sc,oy+4*sc); g.stroke();
      g.fillStyle='#ff8a00'; g.fillRect(ox-1.5,oy-7*sc,3,3);
    }
    // maden (puan yatağı): yeşil çapraz kazma
    if(c.mine&&(L>=1||c.tier>=2)){
      const mx=X-(c.oil?18:11)*sc, my=Y-2;
      g.strokeStyle='#3cdc6e'; g.lineWidth=1.6;
      g.beginPath(); g.moveTo(mx-4*sc,my-4*sc); g.lineTo(mx+4*sc,my+4*sc); g.moveTo(mx+4*sc,my-4*sc); g.lineTo(mx-4*sc,my+4*sc); g.stroke();
      g.fillStyle='#3cdc6e'; g.fillRect(mx-1.5,my-1.5,3,3);
    }
    // kışla: yeşil flama
    if(c.bar>0&&(L===2||c.tier>=2)){
      const kx=X+9*sc, ky=Y+3;
      g.strokeStyle='#4ade80'; g.lineWidth=1.2;
      g.beginPath(); g.moveTo(kx,ky+5*sc); g.lineTo(kx,ky-4*sc); g.stroke();
      g.fillStyle='#4ade80';
      g.beginPath(); g.moveTo(kx,ky-4*sc); g.lineTo(kx+6*sc,ky-2.2*sc); g.lineTo(kx,ky-.5*sc); g.closePath(); g.fill();
    }
    // etiket
    const showL = L===2 || (L===1&&c.tier>=1&&u>0.15) || c.tier>=2;
    if(showL){
      const fs=(c.tier===3?11:c.tier===2?10:9)*Math.min(1.25,.8+sc*.35);
      g.font=(c.tier===3?'bold ':'')+fs.toFixed(0)+'px "Share Tech Mono"';
      g.lineWidth=3; g.strokeStyle='rgba(0,4,8,.95)';
      const ly=Y-ph-6;
      g.strokeText(c.name.toUpperCase(),X,ly); g.fillStyle='#ffe9bf'; g.fillText(c.name.toUpperCase(),X,ly);
    }
    // seçim
    if(c.id===G.sel){ g.strokeStyle='#ffb000'; g.lineWidth=2;
      g.strokeRect(X-12*sc,Y-ph-8,24*sc,ph+14);
      g.font='9px "Share Tech Mono"'; g.fillStyle='#ffb000'; g.fillText('SELECT',X,Y-ph-12); }
    // komutan
    if(c.id===G.cmd){ g.fillStyle='#060a06'; g.fillRect(X-12,Y+4,24,11);
      g.strokeStyle='#ffb000'; g.lineWidth=1; g.strokeRect(X-12,Y+4,24,11);
      g.fillStyle='#ffd27a'; g.font='bold 8px "Share Tech Mono"'; g.fillText('CMD',X,Y+12.5); }
  }
  // nabızlar (fetih)
  pulses=pulses.filter(p=>p.t>0);
  for(const p of pulses){
    const c=G.cities[p.id], pw=proj([c.lon,c.lat]); const [X,Y]=w2s(pw[0],pw[1]);
    const t=p.t/30, r=14+(1-t)*30;
    g.strokeStyle=`rgba(76,255,124,${(t*.9).toFixed(2)})`; g.lineWidth=3;
    g.beginPath(); g.ellipse(X,Y,r,r*.55,0,0,7); g.stroke(); p.t--;
  }
}
let anim=[];
function warpLine(a,b){
  const p=proj([a.lon,a.lat]), q=proj([b.lon,b.lat]);
  g.beginPath();
  for(let i=0;i<=10;i++){ const t=i/10;
    const wx=p[0]+(q[0]-p[0])*t, wy=p[1]+(q[1]-p[1])*t - Math.hypot(q[0]-p[0],q[1]-p[1])*.07*Math.sin(Math.PI*t);
    const [X,Y]=w2s(wx,wy); i?g.lineTo(X,Y):g.moveTo(X,Y); }
  g.stroke();
}
function roadCandidates(s){
  return G.cities.filter(o=>o.id!==s.id&&s.nb.indexOf(o.id)<0).sort((x,y)=>d2(s,x)-d2(s,y)).slice(0,4).map(o=>o.id);
}

// ── ETKİLEŞİM ────────────────────────────────────────────────────────────────
let drag=null;
cv.addEventListener('mousedown',e=>{ drag={x:e.offsetX,y:e.offsetY,moved:false}; cv.classList.add('drag'); });
window.addEventListener('mouseup',()=>{ if(drag&&!drag.moved){} drag=null; cv.classList.remove('drag'); });
cv.addEventListener('mousemove',e=>{
  if(!drag) return;
  const a=s2w(drag.x,drag.y), b=s2w(e.offsetX,e.offsetY);
  if(Math.abs(e.offsetX-drag.x)+Math.abs(e.offsetY-drag.y)>3) drag.moved=true;
  cam.x+=a[0]-b[0]; cam.y+=a[1]-b[1]; drag.x=e.offsetX; drag.y=e.offsetY;
  clampCam(); dirty=true;
});
cv.addEventListener('wheel',e=>{
  e.preventDefault();
  const w=s2w(e.offsetX,e.offsetY);
  cam.z*=e.deltaY<0?1.18:1/1.18; cam.z=Math.max(minZ(),Math.min(5,cam.z));
  const u=e.offsetY/CH, vy=vyOf(u), vx=(e.offsetX-CW/2)/sxOf(u)+CW/2;
  cam.x=w[0]-vx/cam.z; cam.y=w[1]-vy/cam.z;
  clampCam(); updHud(); dirty=true;
},{passive:false});
cv.addEventListener('click',e=>{
  if(drag&&drag.moved) return;
  // en yakın şehir (ekran uzayında)
  let best=-1,bd=20*20;
  for(const c of G.cities){
    const pw=proj([c.lon,c.lat]); const [X,Y,u]=w2s(pw[0],pw[1]);
    if(u<-.02||u>1.03)continue;
    const d=(X-e.offsetX)**2+(Y-e.offsetY)**2;
    if(d<bd){bd=d;best=c.id;}
  }
  if(best<0){ if(G.roadMode){ G.roadMode=false; panel(); dirty=true; } return; }
  if(G.roadMode){
    const s=G.cities[G.sel];
    if(roadCandidates(s).indexOf(best)>=0) buildRoad(G.sel,best);
    G.roadMode=false; panel(); dirty=true; return;
  }
  if(best!==G.sel) buildView=false;
  G.sel=best; panel(); dirty=true;
});

// ── OYUN AKSİYONLARI ─────────────────────────────────────────────────────────
function log(m){ G.log.unshift(m); if(G.log.length>8)G.log.length=8; }
function pay(o,m,p){ if(G.res.oil<o||G.res.man<m||G.res.pts<p) return false; G.res.oil-=o;G.res.man-=m;G.res.pts-=p; updHud(); return true; }
function updHud(){
  document.getElementById('r-oil').textContent=G.res.oil;
  document.getElementById('r-man').textContent=G.res.man;
  document.getElementById('r-pts').textContent=G.res.pts;
  document.getElementById('r-day').textContent=G.day;
  document.getElementById('zoomval').textContent=(cam.z/minZ()).toFixed(1)+'×';
  document.getElementById('lodname').textContent=['STRATEJİK','OPERATİF','TAKTİK'][lod()];
}
function moveCmd(id){ G.cmd=id; G.day++; log('Komutan '+G.cities[id].name+' şehrine ilerledi.'); updHud(); panel(); dirty=true; }
function attack(id){
  const c=G.cities[id];
  showModal('SALDIRI — '+c.name.toUpperCase(),
    BLOC[c.owner].n+' kontrolündeki şehre taarruz. Muharebe sahası: <b style="color:#ffe9bf">'+MAP_NAMES[id%10]+'</b>.<br>Garnizon gücü: '+c.garrison+' · Sağ kalanlar gazi olur.',
    [['ÇATIŞ','red',()=>{ resolveBattle(id); }],['VAZGEÇ','',closeModal]]);
}
function resolveBattle(id){
  const c=G.cities[id];
  const win=Math.random()<0.72;
  G.day++; G.res.man=Math.max(0,G.res.man-30);
  if(win){
    c.owner='turk'; c.garrison=1; G.cmd=id; G.sel=id;
    G.res.pts+=40; G.res.oil+=c.oil?60:15;
    pulses.push({id,t:30});
    log('⚔️ ZAFER — '+c.name+' ele geçirildi! (+40 puan'+(c.oil?', +60 petrol':'')+')');
    showModal('ZAFER — '+c.name.toUpperCase(),'Şehir Türk Cumhuriyeti kontrolüne geçti. Sağ kalan birlikler gazi statüsü kazandı.',[['DEVAM','',()=>{closeModal();panel();}]]);
  } else {
    log('✖ BOZGUN — '+c.name+' taarruzu püskürtüldü. (−30 insan gücü)');
    showModal('BOZGUN','Taarruz püskürtüldü. Birlikler geri çekildi (−30 insan gücü). Şehirlerinde üretim yapıp tekrar dene.',[['DEVAM','',()=>{closeModal();panel();}]]);
  }
  updHud(); dirty=true;
}
function buildFac(){ const c=G.cities[G.sel]; if(c.fac>=3){return;} if(!pay(40,0,120)){log('⚠️ Yetersiz kaynak (fabrika: 120 puan + 40 petrol).');panel();return;} c.fac++; G.day++; log('🏭 '+c.name+' fabrikası Sv.'+c.fac+' oldu.'); updHud(); panel(); dirty=true; }
function buildBar(){ const c=G.cities[G.sel]; if(c.bar>=3){return;} if(!pay(0,20,90)){log('⚠️ Yetersiz kaynak (kışla: 90 puan + 20 insan).');panel();return;} c.bar++; c.garrison++; G.day++; log('⛨ '+c.name+' kışlası Sv.'+c.bar+' oldu.'); updHud(); panel(); dirty=true; }
function buildRoad(a,b){
  if(!pay(0,20,60)){ log('⚠️ Yetersiz kaynak (yol: 60 puan + 20 insan).'); panel(); return; }
  addEdge(a,b); G.builtRoads.push([a,b]); G.day++;
  log('🛣 '+G.cities[a].name+' — '+G.cities[b].name+' ikmal yolu açıldı.');
  updHud(); dirty=true;
}
function showModal(head,body,btns){
  const m=document.getElementById('modal');
  m.innerHTML='<div class="mbox"><div class="mhead">'+head+'</div><div class="mbody">'+body+'</div><div class="mrow">'+
    btns.map((b,i)=>'<div class="bigbtn '+b[1]+'" data-i="'+i+'">'+b[0]+'</div>').join('')+'</div></div>';
  m.classList.remove('hidden');
  m.querySelectorAll('.bigbtn').forEach(el=>el.onclick=()=>btns[+el.dataset.i][2]());
}
function closeModal(){ document.getElementById('modal').classList.add('hidden'); }

// ── YAN PANEL ────────────────────────────────────────────────────────────────
let buildView=false;
function panel(){
  const c=G.cities[G.sel], own=c.owner==='turk';
  const cmdC=G.cities[G.cmd], adj=cmdC.nb.indexOf(c.id)>=0, here=c.id===G.cmd;
  const side=document.getElementById('side');
  const chip=own?'<span class="chip g">'+(c.id===G.cmd?'KOMUTA NOKTASI':'DOST ŞEHİR')+'</span>':'<span class="chip r">'+BLOC[c.owner].n.toUpperCase()+'</span>';
  let actions='';
  if(!buildView){
    if(here) actions='<div class="bigbtn dim">KOMUTA MERKEZİNDESİN</div>';
    else if(adj&&own) actions='<div class="bigbtn" onclick="moveCmd('+c.id+')">İLERLE →</div>';
    else if(adj&&!own) actions='<div class="bigbtn red" onclick="attack('+c.id+')">⚔ SALDIR</div>';
    else actions='<div class="bigbtn dim">MENZİL DIŞI — SADECE KOMŞU ŞEHİR</div>';
    if(own) actions+='<div class="bigbtn" onclick="buildView=true;panel()">ŞEHRE GİR — İNŞA</div>';
    side.innerHTML=`
      <h3>HAREKÂT BRİFİNGİ</h3><div class="era">MODERN ÇAĞ · GÜN ${G.day}</div>
      <div class="cityrow"><b>${c.name.toUpperCase()}</b>${chip}</div>
      <div class="fields">
        <div class="field"><i>TÜR</i><b>${c.tier===3?'KARARGAH':c.tier===2?'BÜYÜK ŞEHİR':'KASABA'}</b></div>
        <div class="field"><i>KONTROL</i><b class="${own?'g':'r'}">${BLOC[c.owner].n}</b></div>
        <div class="field"><i>MUHAREBE SAHASI</i><b>${MAP_NAMES[c.id%10]}</b></div>
        <div class="field"><i>GARNİZON / GÜÇ</i><b>${c.garrison}</b></div>
        <div class="field"><i>FABRİKA</i><b>${c.fac?'Sv.'+c.fac:'YOK'}</b></div>
        <div class="field"><i>KIŞLA</i><b>${c.bar?'Sv.'+c.bar:'YOK'}</b></div>
      </div>
      ${c.oil?'<div class="note">⛽ PETROL YATAĞI: bu şehir petrol geliri üretir.</div>':''}
      ${c.mine?'<div class="note" style="border-left-color:#3cdc6e">⛏ MADEN YATAĞI: bu şehir puan geliri üretir.</div>':''}
      ${actions}
      <div class="loghead">MUHAREBE KAYDI</div>
      <div class="logbody">${G.log.map(l=>'<div>'+l+'</div>').join('')}</div>`;
  } else {
    side.innerHTML=`
      <h3>ŞEHİR YÖNETİMİ</h3><div class="era">${c.name.toUpperCase()} · GÜN ${G.day}</div>
      <div class="cityrow"><b>${c.name.toUpperCase()}</b>${chip}</div>
      <div class="fields">
        <div class="field"><i>FABRİKA</i><b>${c.fac?'Sv.'+c.fac:'YOK'} ${c.fac<3?'→ Sv.'+(c.fac+1):'(MAX)'}</b></div>
        <div class="field"><i>KIŞLA</i><b>${c.bar?'Sv.'+c.bar:'YOK'} ${c.bar<3?'→ Sv.'+(c.bar+1):'(MAX)'}</b></div>
      </div>
      ${c.fac<3?'<div class="bigbtn" onclick="buildFac()">🏭 FABRİKA YÜKSELT — 120 PUAN + 40 PETROL</div>':'<div class="bigbtn dim">🏭 FABRİKA MAX SEVİYE</div>'}
      ${c.bar<3?'<div class="bigbtn" onclick="buildBar()">⛨ KIŞLA YÜKSELT — 90 PUAN + 20 İNSAN</div>':'<div class="bigbtn dim">⛨ KIŞLA MAX SEVİYE</div>'}
      <div class="bigbtn" onclick="G.roadMode=true;buildView=false;panel();dirty=true">🛣 YOL İNŞA — 60 PUAN + 20 İNSAN</div>
      <div class="note">Yol inşa: mavi kesikli adaylardan birine tıkla. Yol, komutan hareket ağına kalıcı eklenir.</div>
      <div class="bigbtn" onclick="buildView=false;panel()">← BRİFİNGE DÖN</div>
      <div class="loghead">MUHAREBE KAYDI</div>
      <div class="logbody">${G.log.map(l=>'<div>'+l+'</div>').join('')}</div>`;
  }
  if(G.roadMode){
    side.insertAdjacentHTML('afterbegin','<div class="note" style="margin-top:14px">🛣 YOL MODU AKTİF — haritada mavi kesikli hedefe tıkla (iptal: boş alana tıkla)</div>');
  }
}

// ── BAŞLAT ───────────────────────────────────────────────────────────────────
(async function(){
  const topo=await (await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json')).json();
  const obj=topo.objects.countries;
  const world={
    features:topojson.feature(topo,obj).features,
    land:topojson.merge(topo,obj.geometries),
    frontMesh:topojson.mesh(topo,obj,(a,b)=>a!==b&&blocOf(a)!==blocOf(b)),
    innerMesh:topojson.mesh(topo,obj,(a,b)=>a!==b&&blocOf(a)===blocOf(b)),
    coastMesh:topojson.mesh(topo,obj,(a,b)=>a===b)
  };
  renderWorld(world);
  resize(); fitCam(); updHud(); panel();
  requestAnimationFrame(draw);
})();
</script>
</body>
</html>
