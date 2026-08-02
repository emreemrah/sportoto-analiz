// KAYAN ŞERİT TESTLERİ — "durmasın" davranışının kilidi.
//
// NEDEN VAR: bu bileşen iki kez üst üste bozuldu ve ikisinde de HATA
// SESSİZDİ — ekranda hiçbir uyarı çıkmıyor, sadece şerit donuyor.
//   1. Dokunmayla duraklatma: kullanıcı sayfayı dikey kaydırınca "parmak
//      kalktı" olayı gelmiyor, bayrak kalkık kalıyor ve şerit KALICI duruyor.
//   2. Yerel sürücü: animasyon görünümden kopunca sessizce ölüyor, JS'e haber
//      gelmiyor, kendini onarma mekanizması hiç tetiklenmiyor.
// Aşağıdaki testler bu ikisini de doğrudan hedefler.
//
// Sürüm notu için bkz. ekranlar.test.jsx (RNTL 13.x kullanılır, 14.x DEĞİL).
import React from 'react';
import { Text, Animated } from 'react-native';
import { render, screen, act } from '@testing-library/react-native';

import KayanSerit from '../src/components/KayanSerit';

// onLayout kendiliğinden tetiklenmez; genişliği testte biz veririz —
// bileşen genişliği bilmeden animasyonu HİÇ kurmaz (doğru davranış).
function genislikVer(w = 300) {
  const olcum = screen.getByTestId('serit-olcum');
  act(() => {
    olcum.props.onLayout({ nativeEvent: { layout: { width: w, height: 40 } } });
  });
}

describe('KayanSerit', () => {
  test('içeriği çiziyor ve etiketi taşıyor', () => {
    render(
      <KayanSerit testID="serit" accessibilityLabel="Şerit içeriği">
        <Text>Bir</Text>
      </KayanSerit>,
    );
    expect(screen.getByTestId('serit')).toBeTruthy();
    expect(screen.getByLabelText('Şerit içeriği')).toBeTruthy();
  });

  test('DOKUNMA ile duraklatma YOK — şeridi kalıcı donduran hataydı', () => {
    // Kullanıcı sayfayı dikey kaydırınca dokunuş şeritte başlayıp üstteki
    // liste tarafından devralınıyor; "parmak kalktı" olayı hiç gelmiyordu.
    // Bu testin amacı o duraklatmanın geri EKLENMESİNİ engellemek.
    render(<KayanSerit testID="serit"><Text>Bir</Text></KayanSerit>);
    const kap = screen.getByTestId('serit');
    expect(kap.props.onTouchStart).toBeUndefined();
    expect(kap.props.onTouchEnd).toBeUndefined();
  });

  test('animasyon JS sürücüsüyle kuruluyor — yoksa duruş ÖLÇÜLEMEZ', () => {
    // useNativeDriver:true olsaydı değer JS'e hiç ulaşmaz, bekçi de körleşirdi.
    // Bu yüzden sürücü seçimi bir tercih değil, doğruluk şartı.
    const timing = jest.spyOn(Animated, 'timing');
    render(<KayanSerit testID="serit"><Text>Bir</Text></KayanSerit>);
    genislikVer();

    expect(timing).toHaveBeenCalled();
    const [, ayar] = timing.mock.calls[timing.mock.calls.length - 1];
    expect(ayar.useNativeDriver).toBe(false);
    timing.mockRestore();
  });

  test('BEKÇİ: ölmüş animasyonu fark edip döngüyü YENİDEN kuruyor', () => {
    jest.useFakeTimers();
    // ÖLÜ ANİMASYON TAKLİDİ: start() çağrılır ama hiçbir şey ilerlemez ve
    // hiçbir geri çağrı gelmez — gerçekte animasyon görünümden koptuğunda
    // olan tam budur. Sessizdir; bu yüzden bekçi olmadan fark edilemez.
    const oluDongu = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    const loop = jest.spyOn(Animated, 'loop').mockReturnValue(oluDongu);
    try {
      render(<KayanSerit testID="serit"><Text>Bir</Text></KayanSerit>);
      genislikVer();

      expect(loop).toHaveBeenCalledTimes(1);    // ilk kurulum oldu
      expect(oluDongu.start).toHaveBeenCalledTimes(1);

      act(() => { jest.advanceTimersByTime(7000); });

      // Bekçi duruşu görüp yeniden kurmuş olmalı.
      expect(loop.mock.calls.length).toBeGreaterThan(1);
    } finally {
      loop.mockRestore();
      jest.useRealTimers();
    }
  });
});
