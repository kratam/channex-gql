const assert = require('assert').strict;
const { Response } = require('node-fetch');
const { ChannexAPI } = require('../channex-ds');

async function main() {
  const logs=[];
  const api=new ChannexAPI({logger:{warn:(...a)=>logs.push(a)}});
  const cases=[
    [null,60,'Too Many Requests: retry after Wed, 11 Nov 2026 17:01:00 GMT','60'],
    ['7',60,'Too Many Requests','7'],
    [null,undefined,'Too Many Requests: retry after Wed, 11 Nov 2026 17:01:00 GMT','Wed, 11 Nov 2026 17:01:00 GMT'],
    [null,-1,'Too Many Requests',null],
    [null,{customer:'SYNTHETIC-PRIVATE'},'Too Many Requests',null],
    [null,0,'Too Many Requests','0'],
  ];
  for (const [header,seconds,title,expected] of cases) {
    const response=new Response(JSON.stringify({errors:{code:'http_too_many_requests',title,details:{retry_after:seconds},customer:'SYNTHETIC-PRIVATE'}}),{status:429,headers:{'Content-Type':'application/json',...(header?{'Retry-After':header}:{})}});
    await assert.rejects(api.didReceiveResponse(response,{}),error=>{
      assert.equal(error.extensions.response.status,429);
      assert.equal(error.extensions.response.retryAfter,expected);
      assert(!JSON.stringify(error).includes('SYNTHETIC-PRIVATE'));
      return true;
    });
  }
  const unavailable=new Response(JSON.stringify({errors:{code:'service_unavailable'}}),{status:503,headers:{'Content-Type':'application/json'}});
  await assert.rejects(api.didReceiveResponse(unavailable,{}),error=>error.extensions.code==='CHANNEX_UPSTREAM_UNAVAILABLE' && error.extensions.response.status===503);
  assert(!JSON.stringify(logs).includes('SYNTHETIC-PRIVATE'));
  console.log('OK: 6 valódi 429-törzsalak/fejléc precedencia eset és megkülönböztetett upstream503');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
