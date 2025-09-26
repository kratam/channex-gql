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
- String-float konverzió integer-re (pl. "1.00" → 100)
- Hétköznapi értékek kezelése (7 napos array)
- Booking raw message JSON parsing
- Reply.reply null érték javítás review-knál

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
