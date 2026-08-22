# Oyunun 5 GB bellek yükü — kök neden ve düzeltme

Tarih: 2026-08-05 · Kullanıcı gözlemi: *"bu oyun çalışınca rama 5 gb yük biniyor"* ve
*"LLM çalışıyor bence"* — **ikisi de doğruymuş.**

---

## 1. Yeniden üretim

Oyun normal başlatıldı (test bayrağı yok, tam ekran) ve **menüde bekletildi**, hiçbir şey oynanmadı:

```
BASLANGIC kullanilabilir: 9.40 GB
t0s 8.25 · t3s 7.19 · t6s 4.01 · t9s 4.03 · ... · t51s 4.04   → 6. saniyede PLATO
OYUN ACIKKEN TUKETIM: 5.38 GB
KAPANDIKTAN SONRA:    9.40 GB   (tamamen geri veriliyor)
```

Plato yapıyor ve kapanışta geri veriyor → **sızıntı değil, açılışta alınan tahsis.**

## 2. Kök neden: dil modeli, istenmeden yükleniyordu

Süreç dağılımı (oyun menüdeyken):

| süreç | bellek |
|---|---|
| **llm-host** | **4900 MB** |
| gpu-process | 508 MB |
| renderer (oyunun kendisi) | 134 MB |
| ana (browser) | 94 MB |
| utility | 48 MB |

Yükün **%85'i dil modeliydi.** Zincir:

```
js/LLM.js  (DOMContentLoaded'da "sessizce yokla")
   └→ llmProbe() → PIXEL.llm.status() → ipcMain 'llm:status'
        └→ llmStart() → fork(llm-host.js) → Turkish-Llama-8b Q4_K_M.gguf → ~4.9 GB
```

Yani **kullanıcı yapay anlatıcıyı hiç açmasa bile**, oyunun her açılışında 8 milyar
parametreli model belleğe yükleniyordu. `llm:status` adı "durum sorgusu" olmasına rağmen
yan etkisi modeli yüklemekti.

Not: bu, ölçüm tezgâhındaki karışıklığın da bir kısmını açıklıyor — `llm-host` süreci
Electron'dan `fork` edildiği için `electron.exe` adıyla görünüyor ve süreç-türü ayrıştırmasında
"browser" kovasına düşüyordu; "ana süreç 4.9GB tutuyor" izlenimi buradan geliyordu.

## 3. Düzeltme

| dosya | değişiklik |
|---|---|
| `electron/main.js` | `llm:status` artık **salt bilgi** döndürür (`ready/error/model/yuklendi/modelVar`), model yüklemez. Yeni `llm:start` IPC'si açık istekle yükler. `llmStart()` içine **test kipi koruması** (başsız testlerde model asla yüklenmez). |
| `electron/preload.js` | Köprüye `start()` eklendi; `status()` açıklaması "yüklemez" olarak düzeltildi. |
| `js/LLM.js` | `llmProbe()` yalnız durum okur. Yeni `llmEnsure()` açıkça yükler. Açılış yoklaması artık model yüklemiyor. |
| `js/WarRoomUI.js` | Kullanıcı anlatıcıyı açtığında `llmEnsure()` çağrılır (zaten "Model yükleniyor…" yazıyordu; artık gerçekten o an yükleniyor). |

`llm:generate` **tembel yüklemeyi korur** → anlatıcı gerçekten kullanıldığında model yine yüklenir.

## 4. Sonuç

| | önce | sonra |
|---|---|---|
| oyun açık, menüde bekliyor | **5.38 GB** | **0.59 GB** |
| llm-host süreci | 4900 MB | **yok** |
| gpu / renderer / ana | 508 / 134 / 94 MB | 505 / 135 / 96 MB |

**~9 kat azalma.** Model yalnız anlatıcı açıldığında ya da ilk metin üretiminde yüklenir.

## 5. Doğrulama

- `--llm-selftest` ✓ — model hâlâ yükleniyor ve Türkçe üretiyor
  (`Turkish-Llama-8b-Instruct-v0.1.Q4_K_M.gguf`, iki replik doğru biçimde geldi)
- `--forktest` ✓ · `--liverepro` ✓ · `--defertest` ✓
- jsdom tezgâhı aynı sonucu veriyor (3 tohum, 0/3, marj −3654) → simülasyon etkilenmedi

## 6. Geri çekilen ara iddia

Bu kovalamaca sırasında "Electron'da maç başına ~1.4 GB geri verilmiyor" demiştim.
**Yanlıştı** — Windows'un `WorkingSet` toplamı süreçler arasında paylaşılan sayfaları
tekrar tekrar sayıyor. Electron'un kendi muhasebesiyle ölçünce 4 maç boyunca bellek
**sabit** çıktı (Browser 195MB, GPU ~450MB, Tab ~400-490MB, JS yığın 17MB), çizim açıkken
de öyle. Maç döngüsünde sızıntı **yok**; tek sorun açılıştaki model yüklemesiydi.
