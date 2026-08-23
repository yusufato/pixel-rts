# RCA — Yeni şema-4 konuşma oturumu nullable olay alanlarını üretmiyor

## 1) Verdict

- **Root cause:** storyConversationSessionBegin yeni şema-4 oturum nesnesinde sourceEventAnchor ve eventDecision anahtarlarını baştan oluşturmuyor.
- **Confidence:** Confirmed.
- Göç düzeltmesi bu alanları yükleme sırasında ekleyince kayıt öncesi ve sonrası snapshot farklılaşıyor.

## 2) Failure Definition

- Beklenen: Yeni oturum ve yüklenmiş aynı oturum birebir aynı kanonik şekle sahip olmalı.
- Gerçek: Yeni oturumda anahtarlar yok; restore göçü bunları null olarak ekliyor; exact=false.
- Etki: Değişiklik yapılmadan yapılan save/load bile nesne şeklini değiştiriyor.
- Blast radius yeni konuşma oturumlarının kalıcılık eşitliğidir.

## 3) Timeline

| Zaman | Olay | Kanıt |
|---|---|---|
| Şema 4 | Olay alanları sözleşmeye girdi | Göç ve olay-bağlı prob sözleşmesi |
| Oturum üretimi | Constructor alanları eklemedi | storyConversationSessionBegin nesne literali |
| Göç düzeltmesi | Eksik alanlar restore sırasında null oldu | Yeni exact=false sonucu |

## 4) Hypotheses (ranked)

1. **Constructor ile migrator şekli farklı.** Supported: constructor alanları yok; migrator açık null ekliyor.
2. **Kaydetme başka veriyi bozuyor.** Refuted: müzakere exact=true ve tek değişiklik iki yeni backfill alanı.
3. **Exact assertion gereksiz katı.** Refuted: deterministik kayıt/yükleme sözleşmesi aynı güncel şemada şekil değiştirmemeli.

## 5) Mechanism

1. Yeni şema-4 oturum iki nullable anahtar olmadan oluşturulur.
2. Snapshot bu eksik şekli kaydeder.
3. Restore her kaydı migratordan geçirir.
4. Migrator iki anahtarı null yapar.
5. Semantik aynı olsa da JSON şekli değişir ve exact kapısı düşer.
- Root cause constructor/migrator drift; contributing factor nullable alanların merkezî şema üreticisinden gelmemesi; detection failure göç backfilli eklenene dek missing-missing eşitliğinin hatayı gizlemesidir.

## 6) Remediation Options

### Mitigation

- Exact testi gevşetmek kanonik şema sürüklenmesini gizler; uygulanmamalı.

### Fix

- Yeni oturum nesnesine sourceEventAnchor: null ve eventDecision: null ekle.
- Olay-bağlı akışlar daha sonra doğrulanmış değerleri bu alanlara yazabilsin.

### Prevention

- Constructor ve migrator için kanonik anahtar kümesi eşitlik testi ekle.
- Nullable alan eklenirken create, migrate, validate ve persistence yüzeylerini birlikte güncelle.

## 7) Verification Plan

- Güncel konuşma probunda restoredSession.exact=true olmalı.
- Eski göçte defaultsPresent=true kalmalı.
- Sequential assertion zinciri devam etmeli.
- Tam kayıt/yükleme ve fallback testleri geçmeli.