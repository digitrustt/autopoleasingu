# Dlaczego funkcje chodza w dub1

`vercel.json` przypina je do Dublina, czyli tego samego regionu co baza
(Supabase `eu-west-1`).

Domyslnie Vercel stawia je w `iad1` (Waszyngton). Baza stoi w Irlandii, wiec
kazde z siedmiu zapytan strony glownej lecialo przez Atlantyk i wracalo, a przy
zimnym starcie dochodzilo do tego nawiazanie TLS i uwierzytelnienie w poolerze
na tej samej trasie. Zmierzone objawy: zapytania nie wracaly w osiem sekund,
mimo ze ta sama baza odpowiadala w 1,2 sekundy przy dwunastu rownoczesnych
klientach z laptopa.

Bliskosc bazy wygrywa tu z bliskoscia uzytkownika: zapytan jest kilka na jeden
render, a gotowy HTML leci do Polski tylko raz.

## statement_timeout: 60 s, nie 20

Serwerowy limit czasu zapytania stoi na 60 sekundach. Probowalem 20 — i to
wywracalo BUILD, nie produkcje: Next prerenderuje wtedy kilkanascie stron
rownoczesnie, a agregacje po calej tabeli (mediana ceny na `/opengraph-image`
i `/dane`) nie mieszcza sie w tak waskim oknie, gdy wszystkie ida naraz.

Ochrona przed zawieszonym renderowaniem w czasie DZIALANIA lezy gdzie indziej:
`maxDuration` na trasie zabija funkcje po pietnastu sekundach. Serwerowy limit
jest tu tylko ostatnia zapora przed zapytaniem, ktore naprawde oszalalo, i ma
sens dopiero powyzej tego, co legalnie trwa najdluzej.
