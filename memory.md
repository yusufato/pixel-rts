# Pixel RTS Geliştirici Günlüğü (Memory)

Bu dosya, projenin yüksek seviye tasarım kararlarını, alınan büyük hataların çözümlerini ve genel geliştirme geçmişini tutmak amacıyla oluşturulmuştur.

## [2026-06-21] Hibrit Memory Sistemi Kurulumu
Bugün oyun ve test arayüzümüz için üçlü bir hafıza (memory) sistemi kurduk.
- **`memory.json`**: Test aracımız (test harness) tarafından otomatik loglamalar (crash, success, tick counts) yapılması için eklendi.
- **`memory.md`**: Bu dosya, insan dilinde geliştirici günlüğünü tutmak için eklendi.
- **`task.md` & `implementation_plan.md`**: Asistanın planlama ve görev adımlarını tutması için IDE üzerinde oluşturuldu.

Bu sistem sayesinde testlerde çöken durumları geriye dönük inceleyebilecek ve yapay zeka (AI) gelişimini/hatalarını daha rahat takip edebileceğiz.
