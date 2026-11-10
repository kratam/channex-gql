const assert = require("assert").strict;
const { ApolloServer } = require("apollo-server-express");
const {
  typeDefs: scalarTypeDefs,
  resolvers: scalarResolvers,
} = require("graphql-scalars");
const { typeDefs } = require("../types");
const { resolvers } = require("../resolvers");
const { ChannexAPI } = require("../channex-ds");

// Valós válaszfeldolgozás hálózati hívás nélkül: az előjeles pénzösszeg
// ugyanúgy centté alakuljon, mint a pozitív összeg.
async function main() {
  const api = new ChannexAPI({ logger: { error() {}, warn() {} } });
  const input = {
    amount: "26.93",
    ota_commission: "30.66",
    payment_collect: "ota",
    payment_type: "bank_transfer",
    meta: {
      payment_charge: 315,
      amount_type: "Payout Amount",
      cohost_payout: null,
    },
    inserted_at: "2026-11-03T15:07:22.706921",
    rooms: [{ days: { "2026-11-03": "-3.68", "2026-11-04": "-0.01" } }],
    positive: "28.88",
    zero: "0.00",
    integer: 42,
    text: "ABB-HMSNKDSHHY",
    raw_message: JSON.stringify({
      reservation: { base_price: "113.00", adjustment: "-3.68" },
    }),
  };
  const result = await api.didReceiveResponse(
    {
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => JSON.parse(JSON.stringify(input)),
      text: async () => JSON.stringify(input),
    },
    {},
  );
  assert.deepStrictEqual(result.rooms[0].days, {
    "2026-11-03": -368,
    "2026-11-04": -1,
  });
  assert.strictEqual(result.amount, 2693);
  assert.strictEqual(result.positive, 2888);
  assert.strictEqual(result.zero, 0);
  assert.strictEqual(result.integer, 42);
  assert.strictEqual(result.text, input.text);
  assert.strictEqual(result.raw_message, input.raw_message);
  assert.strictEqual(result.inserted_at, "2026-11-03T15:07:22.706921Z");

  // Csak a hálózati határt helyettesítjük; a revízió és a séma feldolgozása valós.
  api.get = async () => ({
    data: { attributes: JSON.parse(JSON.stringify(result)) },
  });
  const server = new ApolloServer({
    typeDefs: [typeDefs, ...scalarTypeDefs],
    resolvers: { ...resolvers, ...scalarResolvers },
    dataSources: () => ({ channexAPI: api }),
  });
  try {
    for (const field of ["ch_bookingRevision", "ch_booking"]) {
      const argument =
        field === "ch_bookingRevision" ? "bookingRevisionId" : "bookingId";
      const response = await server.executeOperation({
        query: `query {
        ${field}(${argument}: "76387d84-c7f8-452a-bfc6-5156c29a398e") {
          data { attributes { amount ota_commission payment_collect payment_type meta inserted_at rooms { days { date amount } } raw_message } }
        }
      }`,
      });
      assert.strictEqual(response.errors, undefined);
      const attributes = response.data[field].data.attributes;
      assert.strictEqual(attributes.amount, 2693);
      assert.strictEqual(
        attributes.inserted_at,
        Date.parse("2026-11-03T15:07:22.706921Z"),
      );
      assert.strictEqual(attributes.ota_commission, 3066);
      assert.strictEqual(attributes.payment_collect, "ota");
      assert.strictEqual(attributes.payment_type, "bank_transfer");
      assert.deepStrictEqual(attributes.meta, input.meta);
      assert.strictEqual(attributes.rooms[0].days[0].amount, -368);
      assert.strictEqual(
        attributes.raw_message.reservation.base_price,
        "113.00",
      );
      assert.strictEqual(
        attributes.raw_message.reservation.adjustment,
        "-3.68",
      );
    }
    for (const commission of ["0.00", null]) {
      const converted = await api.didReceiveResponse(
        {
          ok: true,
          headers: { get: () => "application/json" },
          json: async () => ({
            ota_commission: commission,
            meta: { payment_charge: commission === null ? null : 0 },
          }),
        },
        {},
      );
      api.get = async () => ({ data: { attributes: converted } });
      const response = await server.executeOperation({
        query: `query { ch_bookingRevision(bookingRevisionId: "76387d84-c7f8-452a-bfc6-5156c29a398e") { data { attributes { ota_commission meta } } } }`,
      });
      assert.strictEqual(response.errors, undefined);
      assert.strictEqual(
        response.data.ch_bookingRevision.data.attributes.ota_commission,
        commission === null ? null : 0,
      );
      assert.strictEqual(
        response.data.ch_bookingRevision.data.attributes.meta.payment_charge,
        commission === null ? null : 0,
      );
    }
  } finally {
    await server.stop();
  }
  console.log(
    "PASS: 5 kontrollcsoport — válaszkonverzió, booking, revision, explicit nulla és hiányzó díj; meta.payment_charge egyszeres centegység",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
