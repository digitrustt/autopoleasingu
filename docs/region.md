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
