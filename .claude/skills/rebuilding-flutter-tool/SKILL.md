---
name: rebuilding-flutter-tool
description: Rebuilds the Flutter tool and CLI. Use when a user asks to compile, update, regenerate, or rebuild the Flutter tool or CLI.
---

# Rebuild Flutter Tool Workflow

You must strictly follow this workflow to rebuild the Flutter tool.

> **Kapsam / Ne zaman kullanılır:** Bu skill yalnızca **Flutter framework aracının (Flutter tool / CLI) yeniden derlenmesi** içindir. Normal uygulama geliştirmesinde **KULLANILMAZ**. Yalnızca şu durumlarda çalıştırın:
> - Flutter tool cache arızası (bozuk `flutter_tools.snapshot` / `flutter_tools.stamp`) giderilmesi gerektiğinde, veya
> - Flutter framework'ün kendisi üzerinde geliştirme yapılırken.
>
> Bu skill bir uygulama dosyasını, ekranı veya iş mantığını değiştirmez.

## Step 1: Execute
* **Action:** Bu skill dizininden (`.claude/skills/rebuilding-flutter-tool/`) SKILL.md'ye göre göreli yolla rebuild script'ini çalıştırın: `dart scripts/rebuild.dart`
* **Not:** Mutlak Windows yolu gömülmez; yol SKILL.md konumuna göre görelidir. Bu depodaki gerçek konum: `E:\flt\kodu cevir\.claude\skills\rebuilding-flutter-tool\scripts\rebuild.dart`.

## Step 2: Verification & Error Handling
After execution, verify the build output.
* If the script succeeds, print only "**Flutter tool rebuilt successfully!**" and then **STOP**.
* If the script fails, provide the user with the exact error output and **STOP**.
