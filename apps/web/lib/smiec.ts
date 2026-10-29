import { slugify } from "@/lib/slug";

/**
 * Wpisy ze zrodel, ktore nie sa ani marka, ani modelem, ani miastem.
 *
 * Search Console (9.10.2026) pokazal w mapie strony marke "Other", model z cala
 * specyfikacja silnika w nazwie i 26 "miast", ktore sa nazwami salonow. Zrodla
 * wpisuja takie rzeczy w pola marka, model i miejsce. Wspolne dla mapy strony
 * i dla blokow linkow na stronach marek i modeli (28.10.2026), zeby smiec nie
 * trafial tam, gdzie mapa go nie zglasza.
 */
export const MARKA_SMIEC = /^(other|inne|inny|brak|range)$/;
export const MODEL_SMIEC = /(\d{3,4}-?ccm|euro-\d|-\d+km(-|$)|^other$)/;
export const MIEJSCE_SMIEC =
  /(sp-z-o-o|sp-j|sp-k|wisniewski|nowakowski|car-arena|dobrygowski|romanowski|walder|carolina|professional|pewne-auto|kobos|sacar|jankowscy|anwa|dakar|carter|stolarz|jaworski|alta-|^ul-)/;

export const markaOk = (make: string) => !MARKA_SMIEC.test(slugify(make));
export const modelOk = (model: string) => {
  const m = slugify(model);
  return m.length <= 40 && !MODEL_SMIEC.test(m);
};
export const miejsceOk = (city: string | null) => !MIEJSCE_SMIEC.test(slugify(city ?? ""));
