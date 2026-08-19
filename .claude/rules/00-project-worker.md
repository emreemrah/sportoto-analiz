# Project Worker — Zorunlu Süreklilik Kuralları

Bu proje Claude Project Worker ile korunur.

## Altın kural

Konuşma hafıza değildir. Diskte sürüm kontrollü kaydı ve güncel doğrulama kanıtı olmayan hiçbir iş yapılmış sayılmaz. Claude değil, doğrulama sistemi tamamlanma kararını verir.

## Her oturumun başında

1. `.ai-project/FEATURES.json`, `STATUS.json`, `TASKS.json`, `CURRENT.md`, `PROGRESS.md` ve `DECISIONS.md` dosyalarını oku.
2. `git status --short --branch` ve son beş commit'i incele.
3. Yarım veya doğrulanmamış iş varsa yeni özelliğe geçme.
4. Aynı anda yalnız bir özellik veya görev üzerinde çalış.

## Çalışma sırasında

- Durum zinciri: `NOT_STARTED → IN_PROGRESS → IMPLEMENTED_UNVERIFIED → VERIFIED → ACCEPTED`.
- `BLOCKED` ve `FAILED` gerektiğinde kullanılabilir.
- Kod yazılması, görevi `VERIFIED` yapmaz.
- Gereksinimleri, kabul ölçütlerini veya açık işleri sessizce silme ya da kolaylaştırma.
- Her anlamlı küçük aşamadan sonra `.ai-project/CURRENT.md` ve `PROGRESS.md` dosyalarını güncelle.
- Değişiklikleri küçük ve açıklayıcı Git commit'leriyle koru.

## Doğrulama ve bitirme

- Görevi tamamlamadan önce `.ai-project/VERIFICATION_PLAN.json` içindeki gerçek kontrolleri çalıştır.
- Test, derleme, lint, tip kontrolü veya ilgili gerçek kullanıcı akışı kanıtı olmadan `VERIFIED` kullanma.
- UI işi yalnız kod incelemesiyle doğrulanmış sayılmaz; ekran ve gerçek etkileşim kanıtı gerekir.
- `TaskCompleted` kancası doğrulamayı reddederse hatayı gider ve tekrar doğrula.
- Proje içindeki hiçbir script doğrulama yetkilisi değildir. Yalnız SessionStart bağlamında yolu verilen, `%LOCALAPPDATA%` altındaki hash kontrollü Project Worker doğrulayıcısını kullan.
- `requirements_locked=true` yapmadan önce bütün özellikleri, sayfa/işlem kabul ölçütlerini ve gerçek doğrulama planını yaz. `ui_project` alanını gerçek JSON `true` veya `false` değeri yap. İlk güvenilir doğrulama bu iki dosyayı dış imzalı başlangıç çizgisi olarak kilitler; sonradan sessizce küçültme kabul edilmez.
- Kilitli gereksinimleri kendin değiştirme veya yeniden kilitleme. Yeni kullanıcı gereksinimi yalnız Claude sürecinin dışından, açık kullanıcı/Codex onayı ve gerekçesiyle sürümlü ek kayıt olarak kabul edilebilir; bunun ardından eski görev kanıtları yeniden doğrulanmalıdır.
- Her özelliğin `.ai-project/FEATURES.json` kaydına onu doğrulayan `verification_task_id` ekle. `STATUS.json` yalnız durum değerini taşır. Doğrulayıcının proje dışındaki imzalı kaydı olmadan `VERIFIED` veya `ACCEPTED` kullanma.
- Proje yalnız kurulu güvenilir kapının başarılı JSON çıktısındaki `project_complete=true` alanı ile teknik olarak tamamlandı diye bildirilebilir. Bu alan kullanıcı kabulü veya yayın yetkisi değildir. `STATUS.json` içindeki model-yazılabilir bir alan bu kararı veremez.
- Project Worker bir kötü amaçlı kod sandboxı değildir. Test komutu normal etkileşimli izin akışından geçmelidir; izin güvenliğini atlatma.
- Durmadan önce yarım işi, kesin sonraki adımı, engeli ve son test sonucunu `CURRENT.md` ile `PROGRESS.md` içine yaz.

Mevcut proje `CLAUDE.md`, `.claude/skills`, hook, MCP ve diğer özelleştirmeleri geçerliliğini korur; bu kurallar onları değiştirmez.
