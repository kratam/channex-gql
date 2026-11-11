# Channex híváskeret és hibakezelés — IT-2122, IT-2123, IT-2124

## Mérési ablak és forrás

2026-11-11 **00:00:00–06:00:00 UTC** (Budapest: 01:00–07:00), hat teljes óra.
Ez a nap eddigi, lezárt ablaka; nappali terhelésre nem általánosítható.
A forrás GCP Cloud Logging, projekt `gg3-nhost2`, szolgáltatás `gg3-functions`:
`POST https://logging.googleapis.com/v2/entries:list`, lapozva a válasz végéig.
A lekért mezők csak időbélyegek, route-ok és a sync-indítások property ID-i;
vendégadat és nyers request/response nem szerepel a mérésben.

- Restrictions/availability: `jsonPayload.message:"starting property"`; összesen **697** indítás.
- Feed és thread-lista: a megfelelő `/channex/sync/revision-feed`, `/channex/sync/threads`
  route-ok HTTP-kéréslogjai; mind **200**. A handler egy listakérést indít.
- Egyedi revision: `jsonPayload.message:"Processing revision"`; a négyhez négy
  `jsonPayload.message="ackd revision"` tartozik.
- Booking/thread részlekérés: `Trying to get channex thread for booking` (2),
  cron-thread `addHasuraId debug` (2); a GraphQL-resolverek REST fanoutja alapján.
  `Visiting thread` és `Path B: upserted thread`: 0.
- Kimenő üzenet: `sending message in channex` (2), ellenőrizve read-only Hasura SQL-lel:
  `messages.sender='property'`, nem null `ch_id`, `threads.channel='channex'`;
  00 és 04 UTC órában egy-egy sikeres küldés, percmaximum 1.

## Óránkénti becslés és csúcsperc

A hat számos oszlop UTC órái rendre **00, 01, 02, 03, 04, 05**.
A csúcsperc naptári perc; a gördülő 60 másodperces csúcs külön oszlop.
Az „indítás” egy felső szintű hívási kísérlet, nem upstream szerveroldali audit:
régi 503/timeout retry-k és más API-kulcs-felhasználók ebben nem látszanak teljesen.

| REST-végpont | Óránként (00 → 05 UTC) | Összesen | Csúcsperc | Gördülő 60 s | Bizonyíték |
| --- | --- | ---: | ---: | ---: | --- |
| GET booking_revisions/feed | 60 / 60 / 60 / 60 / 60 / 60 | 360 | 1 | **2** | route-indítás × 1 |
| GET booking_revisions/:id | 1 / 2 / 0 / 0 / 1 / 0 | 4 | 1 | 2 | feldolgozás-indítás × 1 |
| POST booking_revisions/:id/ack | 1 / 2 / 0 / 0 / 1 / 0 | 4 | 1 | 2 | sikeres ack-log |
| GET bookings/:id | 2 / 0 / 0 / 0 / 2 / 0 | ≈4 | 1 | ≈1 | 2 lookup + 2 cron-thread resolver |
| GET message_threads (lista) | 12 / 12 / 12 / 12 / 12 / 12 | 72 | 1 | ≈1 | route-indítás × 1 |
| GET message_threads/:id | 1 / 0 / 0 / 0 / 1 / 0 | ≈2 | 1 | ≈1 | booking → message_thread resolver |
| GET message_threads/:id/messages | 1 / 0 / 0 / 0 / 1 / 0 | ≈2 | 1 | ≈1 | 2 importált cron-thread |
| GET bookings/:id/messages | 1 / 0 / 0 / 0 / 1 / 0 | ≈2 | 1 | ≈1 | getBookingAndMessages; extra visit=0 |
| POST message_threads/:id/messages | 1 / 0 / 0 / 0 / 1 / 0 | 2 | 1 | 1 | küldés-indítás + DB-visszamérés |
| POST restrictions | 2 / 6 / 440 / 0 / 3 / 0 | 451 | 48 | **68** | property-indításlog |
| POST availability | 1 / 2 / 0 / 0 / 1 / 242 | 246 | **242** | **242** | property-indításlog |
| GET booking_revisions (lista), GET bookings (lista), live_feed | 0 / 0 / 0 / 0 / 0 / 0 | 0 a vizsgált GG3 útvonalakon | 0 | 0 | nincs ilyen hívás a GG3 kódban |

A booking/thread sorok becslések: nincs minden REST-fanouthoz gateway-access-log a
GCP-ben. A `messages/send` route 8 HTTP-hívása közül csak 2 jutott Channex-küldésig,
ezért a route-számot nem tekintjük automatikusan REST-forgalomnak.
A feed gördülő csúcsa 2: két egymást követő cron kérésének időbélyege
a futási késleltetés miatt beleférhet ugyanabba a 60 másodpercbe.
A review/property/rate-plan/room-type hívások és más szolgáltatások miatt a teljes
API-kulcs **600/perc**, **18 000/óra**, illetve szervezeti kerete nem igazolható ebből.
A sensitive végpontok külön, nem publikált limitjének betartását sem bizonyítja.

## Propertynként

| Végpont | Érintett property | Property × naptári perc maximum | Property × gördülő 60 s maximum | Publikált határ |
| --- | ---: | ---: | ---: | ---: |
| POST restrictions | 237 | **5** | **5** | 10/perc/property |
| POST availability | 242 | **1** | **1** | 10/perc/property |

A mért ablakban nincs property-limit-átlépés. A **242 availability-hívás egy percben**
az összesített route 300-as percplafonjának 81%-a; az összesített burst figyelendő.
A limitszabály forrása: [Channex upcoming changes](https://docs.channex.io/upcoming-changes),
2026-11-11-én olvasva (`.md` változat). Detect: 2026-11-16; block: 2026-12-14.
A 429/Retry-After alakot a dokumentáció nem specifikálja. Az éles review által
azonosított válaszban a várakozás fejléc helyett a törzsben érkezik:
`errors.code=http_too_many_requests`, `errors.details.retry_after=60`; a title
`Too Many Requests: retry after <HTTP-dátum>` alakú lehet.

## Kiegészített csúcsmérés: 2026-11-03–11-10, 17:00–17:04 UTC

A korábbi 00–06 UTC ablak nem fedte az üzenetküldési csúcsot. A nyolc napon
külön ellenőrzött időablak **17:00:00–17:05:00 UTC** (Budapest 18:00–18:05).
A vizsgált üzenetcsoport a **17:00:00–17:01:00 UTC** között létrejött,
`sender='property'`, `threads.channel='channex'` üzenetekből áll.

| UTC-nap | Üzenet / első perc | Hasura-kísérlet az üzenetcsoportban | Channex 429-et tartalmazó hibaválasz | 17:05 előtt Channexre kiment | Utolsó Channex inserted_at (UTC) |
| --- | ---: | ---: | ---: | ---: | --- |
| 2026-11-03 | 48 | 79 | 31 | 48 | 17:01:19.444 |
| 2026-11-04 | 29 | 34 | 5 | 29 | 17:01:02.381 |
| 2026-11-05 | 22 | 22 | 0 | 22 | 17:00:30.501 |
| 2026-11-06 | 34 | 53 | 19 | 34 | 17:01:09.661 |
| 2026-11-07 | 34 | 57 | 23 | 34 | 17:01:06.834 |
| 2026-11-08 | 50 | 50 | 0 | 50 | 17:00:52.839 |
| 2026-11-09 | 59 | 71 | 12 | 59 | 17:01:26.549 |
| 2026-11-10 | 51 | 80 | 29 | 51 | 17:01:16.210 |
| **Összesen** | **327** | **446** | **119** | **327** | — |

A reviewer mind a nyolc napi darabszáma egyezik az önálló méréssel.
A 327 üzenet mindegyikén van `messages.ch_id`, e-mail-fallback egyikhez sem került;
a megfelelő `messages--insert` események mind delivered állapotúak, és sikeres
HTTP200-kézbesítésük 17:05 előtt megtörtént. A Channexben tárolt küldési időpontok
alapján már **17:01:27 előtt** minden nap mindegyik kiment. A 446 kézbesítési
kísérlet és 327 végső siker különbsége 119; ugyanennyi invocation-válasz tartalmazza
a Channex 429-et. **Hat napon volt 429**, november 5-én és 8-án e szűk csoportban nem.
A 22–59/perc terhelés tehát már a publikált 100/perc alatt is adhat 429-et;
a sensitive végpontok/egyéb korlátok pontos kiváltó oka ebből nem állapítható meg.

Forrás és reprodukció (csak olvasás, minden `run_sql` esetén `read_only: true`):

- GCP Cloud Logging: `resource.labels.service_name="gg3-functions"`,
  `jsonPayload.message="sending message in channex"`, naponta a fenti időablak;
  lekért mező csak `timestamp`, végiglapozva. Az első perces indítások sorban
  **48,29,22,34,34,50,59,51**. Az ötperces ablak összes indítása 472, de ez az
  első percben létrehozott üzenetcsoporton kívüli üzeneteket is tartalmaz; nem
  tekintjük a 327 elemű csoport kísérletszámának.
- Hasura `messages` + `threads`: darabszám, Channex/e-mail ID megléte, nulla
  elküldetlen sor. `channex_messages.message_id` + `inserted_at`: a tényleges
  upstream küldési időpontok aggregált ellenőrzése, ügyféladat nélkül.
- Hasura `hdb_catalog.event_log` (`trigger_name='messages--insert'`,
  `payload#>>'{data,new,id}'`) + `event_invocation_logs.event_id`: delivered,
  próbálkozásszám, első HTTP200 időpontja. A 429 oszlop a válaszban szereplő
  `http_too_many_requests`/`Too Many Requests` alapján számol; a Hasura felé a
  functions hibája HTTP500 lehet, nem közvetlen HTTP429.
- A reprodukálható aggregáló SQL: [channex-message-peak.sql](channex-message-peak.sql).
  A szűk eseményhalmaz egyszer materializált, hogy ne ismételjen nagy JSON-path
  olvasást. A mérés csak darabszámot és időpontot ad vissza.

Az üzenetek szétterítése külön kör; ütemezés vagy cron nem változik.

## Kódból igazolt kockázat és védelem

A régi `rounds < MAX_ROUNDS` feltétel 0-ról induló listával **16** kört engedett,
ha a futás 40 mp alatt maradt; szintetikus regresszió igazolja. Egy property minden
körben szerepelhet, ezért 10 fölötti restrictions-kísérlet lehetséges, noha a mért
ablakban a property-maximum csak 5. A javítás maximum **15 valódi kört** enged,
429-es property-hiba után a batcher megáll, a következő cron pótol. Más
property-hiba (például 422) nem állítja le a következő köröket.

A gateway közös, processszintű számlálója propertynként és route-onként legfeljebb
**10 tényleges kísérletet** enged gördülő 60 másodpercben. A hibás upstream kísérlet
is számít; a helyben elutasított hívás nem megy a Channexre. Minden DataSource
ugyanazt a számlálót használja, tehát az átfedő functions-futások is védettek.
**Indítás/restart után 60 másodpercig** a két író végpont helyi 429-et ad, így a
korábbi process elveszett számlálója nem nyit új keretet. Más végpontot ez nem fékez.
Ez a jelenlegi **egyetlen pm2 forkra** szól; több gateway process/host előtt megosztott
limiter kell. A gatewayt megkerülő klienseket ez a védelem nem számlálja.

A gateway nem retry-zik. HTTP 429 és opcionális `Retry-After` a GraphQL
`extensions.response.{status,retryAfter}` mezőiben jut tovább, a régi hibakódot és
404/422 státuszszöveget megőrzi. A functions kliens maximum 3-szor retry-zik
429-re. A gateway elsőként a Retry-After fejlécet veszi; ennek hiányában a
számszerű `errors.details.retry_after` értékét normalizálja másodpercre, végső
tartalékként a title `retry after <HTTP-dátum>` részét HTTP-date-re. A nyers title
és details értékek nem jutnak tovább. Csak ezek hiányában lesz 1/2/4 s backoff.
A törzsben kapott 60 s a 30 s mutációs keret fölött van, ezért a kliens azonnal
hibázik, és nem indít 1/2/4 s múlva újabb Channex-hívásokat.
A hálózat és várakozás együtt querynél **15 s**, mutációnál **30 s**, AbortSignal-lal.
Túl hosszú Retry-After esetén rögtön látható hibával áll meg. A telepítési script
Cloud Function időkorlátja 90 s (`scripts/deploy-function.sh`), a klienshívás kerete
ennél rövidebb. Az élő timeout-metadata lekérdezéséhez a rendelkezésre álló
hitelesítés nem adott hozzáférést; infra/auth/env nem változott.

Mutációt csak 429 vagy bizonyított kapcsolódás előtti hiba után ismétel.
A gateway `ECONNREFUSED`, `ENOTFOUND`, `connect ETIMEDOUT` esetén
`CHANNEX_CONNECT_FAILED`/503-at ad; ECONNRESET, socket hang up, read timeout és
abort esetén `CHANNEX_REQUEST_AMBIGUOUS`/502-t. Utóbbinál nincs kliensoldali
újrapróbálás, üzenetnél e-mail-fallback sincs: a Channex már végrehajthatta a POST-ot.
A valódi, a gateway által megkapott Channex HTTP503 külön
`CHANNEX_UPSTREAM_UNAVAILABLE` kódot kap; a mutáció helyben ezt sem retry-zza,
de az e-mail-fallback megengedett. A proxy nyers HTTP502-jéből nem bizonyítható,
hogy a gateway/Channex biztosan nem dolgozta fel a kérést, ezért az ambiguous marad.

**A külső Hasura-retry ettől független, változatlan:** a `Route.handleError` a
`CHANNEX_REQUEST_AMBIGUOUS` hibát HTTP500-ra fordítja. A `messages--insert`
Hasura-esemény `num_retries: 3`, `interval_sec: 30` beállítással legfeljebb háromszor
újrafuttatja a `messages/send` kezelőt (első kísérlet + 3 retry). Az Error
`retry:false` mezője ezt a Hasura-konfigurációt nem kapcsolja ki. Emiatt bizonytalan
küldési kimenetelnél **dupla üzenet továbbra is lehetséges, ahogy eddig is**;
a kért javítás ezt a viselkedést nem módosítja.
A functions→gateway undici kapcsolat hibáját a `TypeError('fetch failed').cause.code`
jelzi (`UND_ERR_CONNECT_TIMEOUT`, `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`).
Querynél az eddigi 503/ETIMEDOUT retry megmarad; gateway ambiguous kódnál nincs retry.
A küldés siker- és hibalogja kizárólag azonosítókat, törzshosszt és szűrt gépi
hibamezőket tartalmaz; a teljes sendResult, címzett, msg.body és failedMessage.body
nem kerül a naplóba.
A gateway validációs `details` kulcsai `detailFields` alatt kereshetők, a nyers
értékek nem kerülnek logba/hibába. A végső hibából eltűnik
a teljes request/response és a nyers hibaüzenet; 404/not_supported felismerhető marad.

Sikertelen restrictions/availability után nincs `rate_date_sync`/`synced_at`-írás;
sikertelen revision-lekérés után nincs ack és booking-upsert. A külső cron/Hasura
következő futása új feldolgozási kísérlet, nem egymásra rétegzett kliens-retry.

## Revision-riasztás és üzemeltetési tudnivalók

A meglévő revision-feed futás végén a monitor a feed és a DB legalább **30 perces**
feldolgozatlan tételeinek unióját jelzi, a futásban sikeresen feldolgozott ID-k nélkül.
A DB-ág kizárólag az **utolsó 7 napban** beérkezett, feldolgozatlan revisionökre
szűr: `received_at > now() - interval '7 days'`. Feed-lekérési hiba mellett a
DB-ellenőrzés akkor is lefut. Új cron/séma/env nincs. A meglévő belső Slack-riasztási
út kap egy összesítőt, kizárólag revision ID-kkel.

Tartós, instance-ok közötti elnyomás: a meglévő `GCLOUD_NTAK_BUCKET_NAME` bucket
**`channex/revision-alerts/<ID-hash>/<YYYY-MM-DD>.json`** objektuma UTC-naponként.
Kizárólag létrehozás (`ifGenerationMatch=0`), nincs metadata-olvasás vagy felülírás;
megőrzési szabály mellett is működhet. A 412 azt jelenti, hogy aznap már van jelölő.
Revisionenként **UTC-naponként legfeljebb egy jelzési kísérlet**. A foglalás a
Slack-küldés előtt történik: bizonytalan timeout után nincs percenkénti duplikáció.
Sikertelen Slack-küldés/tárhiba külön hibalog, a revision-feldolgozást nem blokkolja.
Küldési hiba után a foglalás az UTC-nap végéig elnyomja az új kísérletet; ez
at-most-once kísérleti garancia, nem pontosan egyszeri kézbesítés.

A 2026-11-11-i korábbi read-only mérés 10 régi, hibás DB-sort talált június–októberi
beérkezéssel. A koordinátor Ⓑ döntése szerint ezekre nincs egyszeri összesítő;
a reviewer a helyes üzleti állapotukat élesben ellenőrizte. A hét napos DB-ablak
kizárja őket. A worker nem végzett DB-írást vagy Channex ackot.

## Élesítési sorrend és ellenőrzés

1. Koordinátori review és Tamás engedélye után **channex-gql előbb**, pm2-n név
   szerint restart; 60 s startup-ablak kivárása. Ellenőrizendő: normál GraphQL
   olvasás és process-státusz; éles 429-et teszt céljából nem generálunk.
2. **gg3-functions** szokásos main → Cloud Build, a meglevő kapukkal.
3. Hibalog és a hét napos ablakra szűrt revision-riasztás visszamérése.
   Cron, DB-séma, Hasura metadata, API-kulcs és env nem változik.

A workerek két PR-t adnak át. A merge, élesítés és éles visszamérés a koordinátoré.
