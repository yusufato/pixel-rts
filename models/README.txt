YEREL LLM MODEL KLASÖRÜ
========================

Bu klasör "yapay anlatıcı" için yerel dil modelini tutar. İçindeki .gguf
dosyaları, masaüstü kurulumu derlenirken (npm run dist) uygulamayla BİRLİKTE
paketlenir ve kurulan bilgisayarda resources/models altına açılır.

KULLANIMI
---------
1. Bir .gguf modelini bu klasöre koy. Önerilen (ölçülerek seçildi):
      Turkish-Llama-8b-Instruct-v0.1.Q4_K_M.gguf   (~4.9 GB)
   Türkçe-ayarlı olduğu için akıcı Türkçe üretir; genel amaçlı modeller bu
   ölçekte bozuk Türkçe morfoloji üretiyordu (ölçüldü).

2. npm run dist  → model kuruluma dahil olur (kurulum ~5 GB olur).

Bu klasör BOŞSA (yalnız bu README varsa) kurulum modeli içermez ve küçük kalır
(~80 MB). Oyun yine çalışır; yapay anlatıcı ayarı model bulamadığını bildirir
ve komutan sohbetleri hazır şablonlardan yazılır.

MODEL NEREDEN BULUNUR (findModel arama sırası, electron/main.js)
----------------------------------------------------------------
  1) resources/models        ← paketlenmiş kurulum (bu klasörden gelir)
  2) <repo>/models           ← geliştirme (npm start)
  3) <userData>/models
  4) <kullanıcı ev>/models   ← C:\Users\<ad>\models

NOT: .gguf dosyaları .gitignore'da; depoya girmez (GB'larca).
