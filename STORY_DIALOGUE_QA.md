# Hikâye Sohbeti QA Kaydı

Gerçek EXE üzerinden yapılan görünür karakter konuşmaları ilk mesajdan itibaren
`qa-runtime/story-dialogue-log.jsonl` dosyasına satır satır yazılır. Dosya 8 MB'a
ulaşınca önceki parça `story-dialogue-log.jsonl.1` adına döndürülür.

Her satır bir JSON nesnesidir. `TURN_CREATED` oyuncuya ilk gösterilen güvenli
cevabı, `RESPONSE_ENRICHED` ise yerel LLM aynı cevabı sonradan iyileştirdiğinde
son halini taşır. `sessionId` ve `responseId` iki kaydı birleştirmek içindir.

Kayıt yalnız oyuncunun yazdığı metni, oyuncuya gösterilen karakter cevabını ve
dar tanı künyesini içerir. Sistem istemleri, gizli karakter eksenleri, ham dünya
gerçekleri, erişilmeyen anılar ve model dosyası bilgileri kayda yazılmaz.
