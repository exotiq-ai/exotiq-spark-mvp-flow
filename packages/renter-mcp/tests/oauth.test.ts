import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { decodeJwt, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createAuthenticator, AuthFailure, type AuthConfig } from '../src/auth.ts';

const issuer='https://identity.example.test', resource='https://mcp.example.test/mcp', api='https://api.example.test';
let keys: Awaited<ReturnType<typeof generateKeyPair>>, origin:string, server:ReturnType<typeof createServer>;
let revoked=false, rebound=false, substitute=false, badMetadata=false, requested:string[]=[];
async function token(audience:string|string[]=resource, overrides:Record<string,unknown>={},typ='at+jwt') {
  const now=Math.floor(Date.now()/1000);
  return new SignJWT({client_id:'consumer-a',scope:'catalog:read quotes:create rental_requests:create rental_requests:read checkout:handoff',...overrides})
    .setProtectedHeader({alg:'ES256',kid:'fixture',typ,jku:'https://attacker.test/jwks'}).setIssuer(issuer).setSubject('customer-a').setAudience(audience)
    .setIssuedAt(now).setNotBefore(now).setExpirationTime(now+300).setJti(crypto.randomUUID()).sign(keys.privateKey);
}
const config:AuthConfig={issuer,resource,apiResource:api,jwksUri:issuer+'/jwks',introspectionUri:issuer+'/introspect',tokenUri:issuer+'/token',metadataUri:issuer+'/.well-known/oauth-authorization-server',resourceMetadataUri:'https://mcp.example.test/.well-known/oauth-protected-resource/mcp',allowedHosts:['identity.example.test','api.example.test','mcp.example.test'],clientIds:['consumer-a','consumer-b'],exchangeClientId:'adapter',exchangeClientSecret:'synthetic-only',maxTokenLifetimeSeconds:600};
const tunnel:typeof fetch=async(input,init)=> {
  const u=new URL(input instanceof Request?input.url:String(input)); requested.push(u.href);
  expect(u.origin).toBe(issuer);
  return fetch(origin+u.pathname,init);
};
beforeAll(async()=> {
  keys=await generateKeyPair('ES256');
  const jwk={...await exportJWK(keys.publicKey),kid:'fixture',alg:'ES256',use:'sig'};
  server=createServer(async(req,res)=> {
    const chunks:Buffer[]=[]; for await(const chunk of req) chunks.push(Buffer.from(chunk));
    const body=new URLSearchParams(Buffer.concat(chunks).toString());
    res.setHeader('content-type','application/json');
    if(req.url==='/.well-known/oauth-authorization-server')res.end(JSON.stringify({issuer,jwks_uri:issuer+'/jwks',token_endpoint:badMetadata?'https://attacker.test/token':issuer+'/token',introspection_endpoint:issuer+'/introspect',code_challenge_methods_supported:['S256'],grant_types_supported:['authorization_code','urn:ietf:params:oauth:grant-type:token-exchange'],token_endpoint_auth_methods_supported:['client_secret_basic']}));
    else if(req.url==='/jwks') res.end(JSON.stringify({keys:[jwk]}));
    else if(req.url==='/introspect') res.end(JSON.stringify({...decodeJwt(body.get('token')!),active:!revoked,iss:issuer,sub:'customer-a',client_id:substitute?'consumer-b':'consumer-a',aud:resource}));
    else if(req.url==='/token') {
      expect(body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:token-exchange');
      expect(body.get('resource')).toBe(api);
      res.end(JSON.stringify({access_token:await token(api,{client_id:rebound?'adapter':'consumer-a'}),token_type:'Bearer',issued_token_type:'urn:ietf:params:oauth:token-type:access_token'}));
    } else { res.statusCode=404;res.end('{}'); }
  });
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  origin='http://127.0.0.1:'+ (server.address() as {port:number}).port;
});
afterAll(async()=>{await new Promise<void>(r=>server.close(()=>r()));});
describe('signed OAuth resource and fresh provider bindings',()=> {
  it('verifies signature, introspection and exchange before delegation',async()=> {
    const auth=createAuthenticator(config,tunnel);const bearer=await token();
    const result=await auth.authenticate(new Request(resource,{headers:{Authorization:'Bearer '+bearer}}),'catalog:read');
    expect(result.principal.clientId).toBe('consumer-a');expect(result.apiToken).not.toBe(bearer);
  });
  it('rejects wrong resource and forged signature without introspection',async()=> {
    const auth=createAuthenticator(config,tunnel); requested=[];
    await expect(auth.authenticate(new Request(resource,{headers:{Authorization:'Bearer '+await token(api)}}),'catalog:read')).rejects.toMatchObject({status:401});
    expect(requested.some(u=>u.endsWith('/introspect'))).toBe(false);
    const forged=(await token()).split('.');forged[2]='A'.repeat(86);
    await expect(auth.authenticate(new Request(resource,{headers:{Authorization:'Bearer '+forged.join('.')}}),'catalog:read')).rejects.toBeInstanceOf(AuthFailure);
  });
  it('fresh revocation, introspection identity substitution and exchange client rebinding fail closed',async()=> {
    const auth=createAuthenticator(config,tunnel);const req=new Request(resource,{headers:{Authorization:'Bearer '+await token()}});
    revoked=true;await expect(auth.authenticate(req,'catalog:read')).rejects.toMatchObject({status:401});revoked=false;
    substitute=true;await expect(auth.authenticate(req,'catalog:read')).rejects.toMatchObject({status:401});substitute=false;
    rebound=true;await expect(auth.authenticate(req,'catalog:read')).rejects.toMatchObject({status:401});rebound=false;
  });
  it('valid missing scope returns403; unsafe metadata configuration is refused',async()=> {
    const auth=createAuthenticator(config,tunnel);
    await expect(auth.authenticate(new Request(resource,{headers:{Authorization:'Bearer '+await token(resource,{scope:'catalog:read'})}}),'quotes:create')).rejects.toMatchObject({status:403});
    expect(()=>createAuthenticator({...config,jwksUri:'http://169.254.169.254/latest'},tunnel)).toThrow();
    expect(()=>createAuthenticator({...config,tokenUri:'https://attacker.test/token'},tunnel)).toThrow();
  });
  it('does not fetch claim supplied key URLs and rate limits before provider credentials',async()=> {
    const auth=createAuthenticator({...config,requestsPerMinute:1},tunnel); requested=[];
    await auth.authenticate(new Request(resource,{headers:{Authorization:'Bearer '+await token(resource,{jku:'https://attacker.test/jwks'})}}),'catalog:read');
    const count=requested.length;
    await expect(auth.authenticate(new Request(resource,{headers:{Authorization:'Bearer '+await token()}}),'catalog:read')).rejects.toMatchObject({status:429});
    expect(requested).toHaveLength(count);expect(requested.some(u=>u.includes('attacker'))).toBe(false);
  });
  it('refuses mutable metadata endpoint substitution before sending provider credentials',async()=>{
    const auth=createAuthenticator(config,tunnel);requested=[];badMetadata=true;
    try{await expect(auth.authenticate(new Request(resource,{headers:{Authorization:'Bearer '+await token()}}),'catalog:read')).rejects.toMatchObject({status:503});expect(requested.some(u=>u.endsWith('/introspect')||u.endsWith('/token'))).toBe(false);}finally{badMetadata=false;}
  });
  it('rejects JWT type, multiple audiences, unknown clients/scopes and expiry',async()=>{
    const auth=createAuthenticator(config,tunnel);
    const now=Math.floor(Date.now()/1000);
    const expired=await new SignJWT({client_id:'consumer-a',scope:'catalog:read'}).setProtectedHeader({alg:'ES256',kid:'fixture',typ:'at+jwt'}).setIssuer(issuer).setSubject('customer-a').setAudience(resource).setIssuedAt(now-400).setNotBefore(now-400).setExpirationTime(now-1).setJti('expired').sign(keys.privateKey);
    for(const bearer of [await token(resource,{},'JWT'),await token([resource,api]),await token(resource,{client_id:'unregistered'}),await token(resource,{scope:'admin:approve'}),expired])await expect(auth.authenticate(new Request(resource,{headers:{Authorization:'Bearer '+bearer}}),'catalog:read')).rejects.toMatchObject({status:401});
  });
});
