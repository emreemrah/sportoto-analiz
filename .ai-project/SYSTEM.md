# Proje Süreklilik Sistemi

Bu klasör projenin kalıcı durumunu ve doğrulama kanıtlarını taşır. `runtime/` dışındaki dosyalar projeyle birlikte Git'e eklenmelidir.

- `FEATURES.json`: Değişmez özellik ve kabul ölçütleri
- `STATUS.json`: Özelliklerin gerçek durumları
- `TASKS.json`: Oturumdan bağımsız görev kaydı
- `CURRENT.md`: Şu anki iş ve sıradaki kesin adım
- `PROGRESS.md`: Eklemeli çalışma günlüğü
- `DECISIONS.md`: Kararlar ve gerekçeleri
- `VERIFICATION_PLAN.json`: Gerçek test/derleme komutları
- `VERIFICATION.json`: Son doğrulama sonucu ve kanıt bağlantıları
- `evidence/`: Test çıktıları ve diğer kanıtlar
- `runtime/`: Makineye özgü kurtarma kaydı; Git'e eklenmez

Bu dosyaların varlığı tek başına uygulamanın tamamlandığını göstermez. Yetkili doğrulama kaydı proje dışında, Project Worker kurulumunun korunan durum klasöründe tutulur ve kod parmak izi + gereksinimler + doğrulama planı + kanıt hashlerine bağlanır. Proje kopyalandığında yeni bilgisayarda yeniden doğrulama gerekir.

`FEATURES.json` içindeki `requirements_locked` ilk güvenilir doğrulamada kabul edildiğinde özellik kataloğu ve doğrulama planının hashleri makine dış kaydında başlangıç çizgisi olarak imzalanır. Bunun için en az bir eksiksiz özellik, her özellikte doğrulama görevi ve kabul ölçütleri, ayrıca açık bir JSON `ui_project` değeri gerekir. Sonradan sessizce küçültülen gereksinim veya zayıflatılan plan doğrulanmaz. Gerçek bir yeni gereksinim yalnız Claude sürecinin dışındaki açık kullanıcı/Codex onayı ve gerekçesiyle zincirli yeni baseline sürümü oluşturabilir; eski kanıtlar geçersizleşir. UI işi için planda `kind: "ui_e2e"` olan gerçek bir uçtan uca komut ve `ui_evidence_paths` altında gerçek ekran görüntüsü gerekir.

Bu sistem bir Windows güvenlik sandboxı değildir. Kullanıcı yalnız güvendiği proje klasörünü açmalı ve proje kodunu çalıştıran test için Claude Code'un normal izin kararını korumalıdır. Kötü niyetli yerel çalıştırılabilir koda karşı mutlak yayın güvencesi ayrı bir CI/merge/release kapısında kurulmalıdır.

İmzalı baseline, kilitlendikten sonraki sessiz kapsam/plan değişimini yakalar; ilk kataloğun bütün kullanıcı ihtiyaçlarını içerdiğini veya testlerin iş anlamında yeterli olduğunu kendi başına kanıtlamaz. `project_complete=true` yalnız tanımlı teknik kapıdır. Nihai kullanıcı kabulü ve yayın kararı ayrıdır.
