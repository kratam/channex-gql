const assert = require('assert').strict;
const { ApolloServer } = require('apollo-server-express');
const { Response } = require('node-fetch');
const { ChannexAPI } = require('../channex-ds');

async function main() {
  const cases = [
    ['ECONNREFUSED', 'connect ECONNREFUSED', 'CHANNEX_CONNECT_FAILED', 503],
    ['ENOTFOUND', 'getaddrinfo ENOTFOUND', 'CHANNEX_CONNECT_FAILED', 503],
    ['ETIMEDOUT', 'connect ETIMEDOUT', 'CHANNEX_CONNECT_FAILED', 503],
    ['ECONNRESET', 'socket hang up', 'CHANNEX_REQUEST_AMBIGUOUS', 502],
    ['ETIMEDOUT', 'read ETIMEDOUT', 'CHANNEX_REQUEST_AMBIGUOUS', 502],
    ['AbortError', 'request aborted', 'CHANNEX_REQUEST_AMBIGUOUS', 502],
  ];
  for (const [code, message, expectedCode, status] of cases) {
    let calls = 0;
    const api = new ChannexAPI();
    api.context = { CHANNEX_API_KEY: 'synthetic' };
    api.httpCache = { fetch: async () => { calls++; throw Object.assign(new Error(`${message} SYNTHETIC-PRIVATE`), { code }); } };
    const server = new ApolloServer({ typeDefs: 'type Query { unused: String } type Mutation { send: String }', resolvers: { Mutation: { send: () => api.sendMessageToThread({message:'SYNTHETIC-PRIVATE'}, 'thread-test') } } });
    const result = await server.executeOperation({query:'mutation { send }'});
    assert.equal(result.errors[0].extensions.code, expectedCode, code);
    assert.equal(result.errors[0].extensions.response.status, status, code);
    assert(!JSON.stringify(result).includes('SYNTHETIC-PRIVATE'));
    assert.equal(calls, 1);
    await server.stop();
  }
  const logs=[];
  const api = new ChannexAPI({logger:{warn:(...args)=>logs.push(args)}});
  const response = new Response(JSON.stringify({errors:{code:'validation_error',title:'Validation Error',details:{arrival_date:['SYNTHETIC-PRIVATE'],rate_plan_id:['SYNTHETIC-PRIVATE']}}}), {status:422,headers:{'Content-Type':'application/json'},url:'https://app.channex.io/api/v1/bookings'});
  await assert.rejects(api.didReceiveResponse(response,{}), error => {
    assert.deepEqual(error.extensions.response.body.errors.detailFields,['arrival_date','rate_plan_id']);
    assert(!JSON.stringify(error).includes('SYNTHETIC-PRIVATE'));
    return true;
  });
  assert.deepEqual(logs[0][1].detailFields,['arrival_date','rate_plan_id']);
  assert(!JSON.stringify(logs).includes('SYNTHETIC-PRIVATE'));
  const duplicate = new Response(JSON.stringify({errors:{code:'validation_error',details:{title:['Duplication in Rate Plan title is not allowed!']}}}),{status:422,headers:{'Content-Type':'application/json'}});
  await assert.rejects(api.didReceiveResponse(duplicate,{}),error=>{
    assert.deepEqual(error.extensions.response.body.errors.detailFields,['title']);
    assert.equal(error.extensions.response.body.errors.details,undefined);
    return true;
  });
  const titles=[];
  const duplicateApi=new ChannexAPI({logger:{warn(){}}});
  duplicateApi.context={CHANNEX_API_KEY:'synthetic'};
  duplicateApi.httpCache={fetch:async request=>{
    titles.push((await request.json()).rate_plan.title);
    return titles.length===1
      ? new Response(JSON.stringify({errors:{code:'validation_error',details:{title:['Duplication in Rate Plan title is not allowed!']}}}),{status:422,headers:{'Content-Type':'application/json'}})
      : new Response('{"data":{"id":"plan-test"}}',{status:200,headers:{'Content-Type':'application/json'}});
  }};
  await duplicateApi.createRatePlan({title:'synthetic-plan'});
  assert.deepEqual(titles,['synthetic-plan','synthetic-plan (2)']);
  console.log('OK: 6 hálózati hibaág valódi GraphQL-mutációval; 422 mezőnevek értékek nélkül');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
