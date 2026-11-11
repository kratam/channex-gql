const assert = require('assert').strict;
const { ApolloServer } = require('apollo-server-express');
const { ChannexAPI } = require('../channex-ds');
const { createPropertyLimiter } = require('../property-limiter');
const { Response } = require('node-fetch');

async function main() {
  const logs = [];
  const api = new ChannexAPI({ logger: { error: (...a) => logs.push(a), warn: (...a) => logs.push(a) } });
  for (const retryAfter of ['3', null]) {
    const headers = { 'Content-Type': 'application/json', ...(retryAfter ? { 'Retry-After': retryAfter } : {}) };
    const response = new Response(JSON.stringify({ errors: { code: 'rate_limit_exceeded', title: 'Too Many Requests', customer: 'SYNTHETIC-PRIVATE', raw_message: 'SYNTHETIC-PRIVATE' } }), { status: 429, statusText: 'Too Many Requests', headers, url: 'https://app.channex.io/api/v1/bookings/00000000-0000-4000-8000-000000000001?guest=SYNTHETIC-PRIVATE' });
    const server = new ApolloServer({ typeDefs: 'type Query { probe: String }', resolvers: { Query: { probe: () => api.didReceiveResponse(response, {}) } } });
    const result = await server.executeOperation({ query: '{ probe }' });
    const error = result.errors[0];
    assert.equal(error.extensions.response.status, 429);
    assert.equal(error.extensions.response.retryAfter, retryAfter);
    assert(!JSON.stringify(result).includes('SYNTHETIC-PRIVATE'));
    await server.stop();
  }
  api.get = async () => ({ data: { id: 'rev-test', attributes: { booking_id: 'booking-test', customer: { name: 'SYNTHETIC-PRIVATE' }, raw_message: 'SYNTHETIC-PRIVATE' } } });
  await api.getBookingRevision('rev-test');
  api.get = async () => ({ data: { id: 'booking-test', attributes: { customer: { name: 'SYNTHETIC-PRIVATE' } } } });
  await api.getBooking('booking-test');
  assert(!JSON.stringify(logs).includes('SYNTHETIC-PRIVATE'));
  assert(!JSON.stringify(logs).includes('raw_message'));
  assert(!JSON.stringify(logs).includes('customer'));
  assert(JSON.stringify(logs).includes('rev-test'));
  // Valós DataSource fetch: az instance-ok közös limiteren osztoznak.
  // A modul közös számlálójának indulási ablaka letelt.
  const realNow = Date.now;
  Date.now = () => realNow() + 60001;
  let upstreamCalls = 0;
  for (let i = 0; i < 11; i++) {
    const instance = new ChannexAPI();
    instance.context = { CHANNEX_API_KEY: 'synthetic' };
    instance.httpCache = { fetch: async () => { upstreamCalls++; return new Response('{"data":[]}', { headers: { 'Content-Type': 'application/json' } }); } };
    const call = instance.updateRestrictions([{ property_id: 'property-integration', rate: 100 }]);
    if (i < 10) await call;
    else await assert.rejects(call, e => e.extensions.response.status === 429);
  }
  assert.equal(upstreamCalls, 10);
  Date.now = realNow;
  let now = 0;
  const reserve = createPropertyLimiter(() => now);
  assert.throws(() => reserve('restrictions', ['property-A']), e => e.extensions.response.retryAfter === '60');
  now = 60000;
  for (let i = 0; i < 10; i++) reserve('restrictions', ['property-A']);
  assert.throws(() => reserve('restrictions', ['property-A']), (e) => e.extensions.response.status === 429 && e.extensions.response.retryAfter === '60');
  reserve('availability', ['property-A']);
  reserve('restrictions', ['property-B']);
  now = 119000;
  assert.throws(() => reserve('restrictions', ['property-A']));
  now = 120000;
  reserve('restrictions', ['property-A']);
  // Egy többpropertys elutasítás ne foglaljon kvótát a többi propertynek.
  for (let i = 0; i < 9; i++) reserve('restrictions', ['property-A']);
  assert.throws(() => reserve('restrictions', ['property-C', 'property-A']));
  for (let i = 0; i < 10; i++) reserve('restrictions', ['property-C']);
  console.log('OK: 429 (2 GraphQL eset), PII-mentes hibák/logok, property gördülő ablak és atomi többpropertys foglalás');
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
