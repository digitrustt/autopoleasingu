import { alphabet } from "./sources/alphabet";
import { arval } from "./sources/arval";
import { autoprzetarg } from "./sources/autoprzetarg";
import { ayvens } from "./sources/ayvens";
import { bmw } from "./sources/bmw";
import { bravoauto } from "./sources/bravoauto";
import { cararena } from "./sources/cararena";
import { carefleet } from "./sources/carefleet";
import { famataukcje } from "./sources/famataukcje";
import { dawro } from "./sources/dawro";
import { leasygroup } from "./sources/leasygroup";
import { mauto } from "./sources/mauto";
import { automarket } from "./sources/automarket";
import { mercedes } from "./sources/mercedes";
import { mhc } from "./sources/mhc";
import { otomoto } from "./sources/otomoto";
import { pkoaukcje } from "./sources/pkoaukcje";
import { poleasingowe } from "./sources/poleasingowe";
import { renault } from "./sources/renault";
import { skoda } from "./sources/skoda";
import { skyselection } from "./sources/skyselection";
import { toyota } from "./sources/toyota";
import { volvo } from "./sources/volvo";
import { cupra, seat } from "./sources/vtp";
import { vwfs } from "./sources/vwfs";
import type { SourceAdapter } from "./types";

/** Rejestr zrodel. Kolejne adaptery dokladamy tutaj — reszta systemu ich nie zna. */
export const adapters: SourceAdapter[] = [automarket, alphabet, vwfs, arval, poleasingowe, mercedes, bmw, cararena, dawro, toyota, skoda, autoprzetarg, mauto, carefleet, famataukcje, renault, ayvens, pkoaukcje, volvo, seat, cupra, leasygroup, skyselection, mhc, bravoauto, otomoto];

export const adapterById = new Map(adapters.map((a) => [a.id, a]));

export * from "./types";
export * from "./http";
export * from "./browser";
