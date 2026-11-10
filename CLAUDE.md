# Channex GraphQL API Gateway

## Projekt áttekintés

Ez egy GraphQL API gateway a Channex channel manager rendszerhez, ami Apollo Server-t használ Express.js-sel. A projekt egy köztes réteget biztosít a Channex REST API és a GraphQL kliensek között.

## Technológiai stack

- **GraphQL Server**: Apollo Server 3.x Express.js-sel
- **Node.js**: Express 4.x
- **GraphQL eszközök**:
  - @graphql-tools/load-files - fájl betöltés
  - @graphql-tools/merge - schema összefűzés
  - graphql-scalars - beépített scalar típusok (pl. JSON)
- **Data Source**: apollo-datasource-rest - REST API wrapper
- **Konfiguráció**: dotenv-yaml (.env.yaml)

## Könyvtárstruktúra

```
channex-gql/
├── index.js              # Apollo Server belépési pont
├── channex-ds.js         # Channex REST DataSource implementáció
├── types/               # GraphQL type definíciók (.graphql)
│   ├── shared.graphql   # Közös típusok (relationships, pagination, stb)
│   ├── property.graphql
│   ├── bookings.graphql
│   ├── channel.graphql
│   ├── rate_plan.graphql
│   ├── room_type.graphql
│   └── ...
├── resolvers/           # GraphQL resolver implementációk (.js)
│   ├── index.js        # Resolver összefűző
│   ├── property.js
│   ├── bookingRevision.js
│   ├── channel.js
│   └── ...
└── package.json
```

## Főbb funkciók

- **Szálláskezelés**: Properties, Room Types, Rate Plans
- **Foglaláskezelés**: Bookings, Booking Revisions
- **Channel integráció**: Különböző OTA platformok (Booking.com, Airbnb)
- **Üzenetkezelés**: Message handling
- **Árazás és korlátozások**: Availability, Restrictions
- **Felhasználók és csoportok**: User, Group management
- **Reviews**: Vendég értékelések kezelése

## API Autentikáció

- Channex API kulcs a `channex-api-key` HTTP header-ben
- Context-ben elérhető minden resolver számára

## GraphQL Schema konvenciók

- **Query prefix**: `ch_` (pl. ch_properties, ch_property)
- **Mutation prefix**: `ch_` (pl. ch_createProperty, ch_updateProperty)
- **Relationship-ek**: JSON:API szerű struktúra (data, type, id)
- **Pagination**: PaginationInput típus (page, limit)
- **Filter/Order**: JSON objektumok

## DataSource sajátosságok

- REST endpoint wrapper `channex-ds.js`-ben
- Automatikus dátum formátum javítás (hiányzó 'Z' hozzáadása)
- Előjeles string-float konverzió centben tárolt integerre (pl. "1.00" → 100,
  "-3.68" → -368). A nyers `raw_message` JSON-szövegén belüli összegek nem
  alakulnak át. Lemondásnál a Channex napi összege negatív is lehet; ne nullázd.
- Hétköznapi értékek kezelése (7 napos array)
- A booking és revision közös `BookingRevisionAttribs` típusa az `amount`,
  `ota_commission`, `payment_collect`, `payment_type` és `meta` mezőt is publikálja.
  Az `ota_commission` nullable centérték (REST pénzsztringből egy konverzió);
  a `meta` JSON, benne `payment_charge` már a REST-ben is cent (315 = 3,15 EUR).
  A `meta.amount_type` és `meta.cohost_payout` értelmezés nélkül megy tovább.
  Az alapértelmezett GraphQL-mezőfeloldás elég, nincs külön pénzkonverziós resolver.
  Hiányzó/null jutalék nem azonos az explicit 0-val.
- Booking raw message JSON parsing
- Reply.reply null érték javítás review-knál

## ⚠️ Deploy — KÉZI, nincs automatizmus

**A `main`-re pusholás önmagában NEM élesít semmit.** Ebben a repóban
szándékosan nincs deploy-konfig: se Dockerfile, se GitHub Actions, se
`deploy` script. Az `npm test` a válaszkonverzió és a GraphQL-revízió
regressziós tesztjét futtatja (Node 16-on is). Aki azt hiszi, hogy a push kiviszi a változást, órákig fogja keresni,
miért a régi kód fut.

A szolgáltatás a **`mrz.guest.guru`** szerveren fut, **pm2** alatt. Élesítés:

```bash
# 1. push a main-re — ettől még NEM történik semmi
ssh ubuntu@mrz.guest.guru
cd ~/channex-gql
git pull
pm2 restart channex-gql      # lásd a watch-megjegyzést lent
pm2 logs channex-gql --lines 50
```

| | |
| -- | -- |
| szerver | `ubuntu@mrz.guest.guru` (`3.66.125.224`) |
| checkout | `/home/ubuntu/channex-gql` |
| pm2 app | `channex-gql` (id 1, fork mode) |
| élő végpont | `https://channex.guest.guru/graphql` |

**pm2 `watch`:** a `pm2 jlist` szerint a figyelt útvonal `['node']`
(mérve 2026-11-04), ezért a forrásfájlok frissítése utáni automatikus
újraindulásra ne támaszkodj. Mindig indítsd újra név szerint a
`channex-gql` folyamatot, és ellenőrizd a státuszt és a GraphQL-választ.

⚠️ **Ugyanez a gép futtat két másik szolgáltatást is** (`gg3-tools`, `viza`),
tehát a pm2-t **egészében ne** állítsd le/indítsd újra — mindig névre szólóan
dolgozz (`pm2 restart channex-gql`).

A gg3-functions GraphQL kliensként hívja ezt közvetlenül — **nem** Hasura remote
schema.

## Fejlesztési környezet

- GraphQL Playground elérhető development módban
- Introspection engedélyezett
- Port: 4000
- URL: http://localhost:4000/graphql

## Fontos megjegyzések

- A projekt Apollo Server 3.x-et használ (nem a legújabb verzió)
- REST DataSource pattern a Channex API integrációhoz
- Dinamikus fájl betöltés types és resolvers mappákból
- JSON scalar típus használata flexibilis objektumokhoz

## Séma nullability — válasz típusok kövessék a Channex valóságát

A Channex REST API opcionálisan ad vissza mezőket. Ha egy **válasz** típusban
non-null (`!`)-ként deklarálunk egy mezőt, amit a Channex elhagyhat, az egész
query elhasal: `Cannot return null for non-nullable field …`. Konkrét eset:
`BookingRevisionAttribs.arrival_date` / `departure_date` `LocalDate!` volt, de a
Channex bizonyos revisionökre (pl. inquiry / dátum nélküli foglalás) `null`-t ad
→ a teljes `getBookingRevision` megdőlt a gg3-functions revision-syncben.
Javítva: ezek a **válasz**-mezők most `LocalDate` (nullable).

> A `CreateBooking*Input` típusokban a `departure_date`/`arrival_date` MARAD
> non-null — küldéskor (booking létrehozás) tényleg kötelező. Csak a
> Channextől visszakapott válasz-típusokat lazítjuk.
