// Hook: giriş yapmış kullanıcının favori takım teması (yoksa null).
// Renk tablosu ve eşleme mantığı SAF modülde: takimTema.js (testli).
// KAYITLI tema önceliklidir: kullanıcı renk düzenini terslediyse (GS'de
// sarı-ağırlıklı düzen gibi) vurgular da o düzeni izler.
import { useAuth } from './auth';
import { takimTemasi, kayitliTemayiOku } from './takimTema';

export function useTakimTema() {
  const { user } = useAuth();
  return kayitliTemayiOku() || takimTemasi(user?.favorite_team);
}
