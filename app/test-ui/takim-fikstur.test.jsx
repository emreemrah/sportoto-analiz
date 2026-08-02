// TAKIM FİKSTÜR MODALI TESTLERİ.
//
// NEDEN VAR: takım kartı eskiden sezon istatistiği açıyordu, kullanıcı
// kararıyla fikstüre çevrildi. Buradaki riskler sessiz: oynanmamış maça skor
// basmak, veri alınamadığında "maçı yok" gibi görünmek, ve yanlış takımın
// kimliğiyle rakibin fikstürünü açmak.
//
// Sürüm notu için bkz. ekranlar.test.jsx (RNTL 13.x kullanılır, 14.x DEĞİL).
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

import TakimFiksturModal, { tarihEtiketi } from '../src/components/TakimFiksturModal';

const cagrilan = { url: null };
function mockUc(yanit, { hata = null } = {}) {
  global.fetch.mockImplementation(async (url) => {
    cagrilan.url = String(url);
    if (hata) return { ok: false, status: 502, json: async () => ({ error: hata }), text: async () => hata };
    return { ok: true, status: 200, json: async () => yanit, text: async () => JSON.stringify(yanit) };
  });
}

const TAKIM = { teamId: 2521, seasonId: 17091, name: 'Randers', logo: null, league: 'Denmark Superliga' };

const YANIT = {
  takimId: 2521, seasonId: 17091, takimAdi: 'Randers FC', toplam: 3, oynanan: 1,
  fikstur: [
    { footyMatchId: 1, dateUnix: 1785171600, home: 'Randers', away: 'Silkeborg', evde: true, rakip: 'Silkeborg', oynandi: true, score: { home: 1, away: 1 }, sonuc: 'B' },
    { footyMatchId: 2, dateUnix: 1785690000, home: 'Nordsjælland', away: 'Randers', evde: false, rakip: 'Nordsjælland', oynandi: false, score: null, sonuc: null },
    { footyMatchId: 3, dateUnix: 1786294800, home: 'Randers', away: 'Lyngby', evde: true, rakip: 'Lyngby', oynandi: false, score: null, sonuc: null },
  ],
};

describe('tarihEtiketi', () => {
  test('tarihi kısa Türkçe biçime çeviriyor', () => {
    // 1785171600 = 27 Temmuz 2026
    expect(tarihEtiketi(1785171600)).toMatch(/^27 Tem$/);
  });

  test('tarih yoksa uydurma tarih basmıyor', () => {
    expect(tarihEtiketi(null)).toBe('—');
    expect(tarihEtiketi(undefined)).toBe('—');
  });
});

describe('TakimFiksturModal', () => {
  test('DOĞRU takımın ve sezonun fikstürünü istiyor', async () => {
    // Yanlış kimlikle çağrı, sessizce RAKİBİN fikstürünü açardı.
    mockUc(YANIT);
    render(<TakimFiksturModal visible takim={TAKIM} onClose={() => {}} />);
    await waitFor(() => expect(cagrilan.url).toBeTruthy());
    expect(cagrilan.url).toContain('/api/team-fixtures/2521');
    expect(cagrilan.url).toContain('seasonId=17091');
  });

  test('oynanmış maçta SKOR ve sonuç harfi var, oynanmamışta YOK', async () => {
    mockUc(YANIT);
    render(<TakimFiksturModal visible takim={TAKIM} onClose={() => {}} />);
    await waitFor(() => expect(screen.getAllByText('Randers FC').length).toBeGreaterThan(0));

    // Oynanan tek maç 1-1 bitti ve sonucu B.
    expect(screen.getByText('1 - 1')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
    // Oynanmamış İKİ maçta skor yerine nötr ayraç var; uydurma skor yok.
    expect(screen.getAllByText('v').length).toBe(2);
  });

  test('oynanmamış maçların hepsi listede — sadece geçmiş gösterilmiyor', async () => {
    // Kullanıcının isteği "oynadığı VE oynayacağı maçlar". Eski `matchLog`
    // yalnız oynanmışları tutuyordu; bu testin amacı ona geri dönmemek.
    mockUc(YANIT);
    render(<TakimFiksturModal visible takim={TAKIM} onClose={() => {}} />);
    await waitFor(() => expect(screen.getAllByText('Randers FC').length).toBeGreaterThan(0));
    expect(screen.getByText('Silkeborg')).toBeTruthy();      // oynanmış
    expect(screen.getByText('Nordsjælland')).toBeTruthy();   // oynanacak
    expect(screen.getByText('Lyngby')).toBeTruthy();         // oynanacak
    expect(screen.getByText('SIRADAKİ')).toBeTruthy();       // ayraç
  });

  test('KAPSAM yazılıyor — hangi turnuvaların dahil olduğu görünür', async () => {
    // Liste dolu göründüğü için, kupa/Avrupa maçlarının eksik olduğu ancak
    // bu satırdan anlaşılır. Sessiz eksik, yanlış bilgiden tehlikelidir.
    mockUc({ ...YANIT, fikstur: YANIT.fikstur.map((f) => ({ ...f, lig: 'Denmark Superliga' })) });
    render(<TakimFiksturModal visible takim={TAKIM} onClose={() => {}} />);
    expect(await screen.findByText(/Kapsam: Denmark Superliga/)).toBeTruthy();
  });

  test('birden fazla turnuva varsa her satırda turnuva adı yazıyor', async () => {
    // Kupa ve lig maçı yan yana dururken hangisinin hangisi olduğu
    // belirtilmezse form okuması yanıltıcı olur.
    mockUc({
      ...YANIT,
      fikstur: [
        { ...YANIT.fikstur[0], lig: 'Denmark Superliga' },
        { ...YANIT.fikstur[1], lig: 'UEFA Sampiyonlar Ligi' },
      ],
    });
    render(<TakimFiksturModal visible takim={TAKIM} onClose={() => {}} />);
    await waitFor(() => expect(screen.getAllByText('Randers FC').length).toBeGreaterThan(0));
    expect(screen.getAllByText('UEFA Sampiyonlar Ligi').length).toBeGreaterThan(0);
  });

  test('TEK turnuva varsa satırlara turnuva adı BASILMIYOR (gürültü)', async () => {
    mockUc({ ...YANIT, fikstur: YANIT.fikstur.map((f) => ({ ...f, lig: 'Denmark Superliga' })) });
    render(<TakimFiksturModal visible takim={TAKIM} onClose={() => {}} />);
    await waitFor(() => expect(screen.getAllByText('Randers FC').length).toBeGreaterThan(0));
    // Maç SATIRINDA turnuva adı tek başına bir metin düğümü olarak çizilir.
    // Tek turnuvada hiç çizilmemeli. (Başlık ve kapsam satırı adı başka
    // metinlerle birlikte taşıdığı için TAM eşleşme onları saymaz.)
    expect(screen.queryAllByText('Denmark Superliga').length).toBe(0);
  });

  test('veri ALINAMADIĞINDA "maçı yok" gibi görünmüyor', async () => {
    // "Fikstür alınamadı" ile "bu takımın maçı yok" farklı şeyler; ikisi aynı
    // görünürse kullanıcı veri kaybını fark edemez.
    mockUc(null, { hata: 'Fikstür alınamadı: kaynak yanıt vermedi' });
    render(<TakimFiksturModal visible takim={TAKIM} onClose={() => {}} />);
    expect(await screen.findByText('Fikstür alınamadı')).toBeTruthy();
  });

  test('takım kimliği yoksa istek HİÇ atılmıyor', async () => {
    mockUc(YANIT);
    cagrilan.url = null;
    render(<TakimFiksturModal visible takim={{ ...TAKIM, teamId: null }} onClose={() => {}} />);
    expect(cagrilan.url).toBeNull();
  });
});
