import { createRemoteJWKSet, customFetch, jwtVerify, type JWTPayload } from 'jose';
import { SCOPES } from '../../../supabase/functions/_shared/external-booking/contracts.ts';
import { boundedJson, record } from './http.ts';

export interface AuthConfig {
  issuer:string;resource:string;apiResource:string;jwksUri:string;introspectionUri:string;tokenUri:string;metadataUri:string;resourceMetadataUri:string;
  allowedHosts:readonly string[];clientIds:readonly string[];exchangeClientId:string;exchangeClientSecret:string;
  maxTokenLifetimeSeconds:number;requestsPerMinute?:number;
}
export interface Principal {issuer:string;subject:string;clientId:string;scopes:string[];expiresAt:number;tokenId:string}
export interface Delegation {principal:Principal;apiToken:string;mcpToken:string}
export class AuthFailure extends Error {
  constructor(public readonly status:401|403|429|503,public readonly scope?:string){super(status===403?'insufficient_scope':status===429?'rate_limited':status===503?'upstream_unavailable':'invalid_token');}
}
function https(value:string,hosts:readonly string[]):URL {
  const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search||!hosts.includes(u.hostname)||u.port&&u.port!=='443')throw new Error('invalid_configuration');return u;
}
function claim(value:unknown,max:number):value is string{return typeof value==='string'&&value.length>0&&value.length<=max&&!/[\x00-\x1f\x7f]/.test(value);}
function principal(payload:JWTPayload,config:AuthConfig,audience:string):Principal {
  const now=Math.floor(Date.now()/1000);const {iat,nbf,exp}=payload;
  if(payload.iss!==config.issuer||payload.aud!==audience||!claim(payload.sub,256)||!claim(payload.client_id,512)||!config.clientIds.includes(payload.client_id)||!claim(payload.jti,256)||!claim(payload.scope,1024)
    ||!Number.isSafeInteger(iat)||!Number.isSafeInteger(nbf)||!Number.isSafeInteger(exp)||iat!<=0||nbf!<iat!||iat!>now||nbf!>now||exp!<=now||exp!<=iat!||exp!-iat!>config.maxTokenLifetimeSeconds)throw new AuthFailure(401);
  const scopes=payload.scope.split(' ');if(scopes.some(s=>!SCOPES.includes(s as typeof SCOPES[number]))||new Set(scopes).size!==scopes.length)throw new AuthFailure(401);
  return {issuer:payload.iss,subject:payload.sub,clientId:payload.client_id,scopes,expiresAt:exp!,tokenId:payload.jti};
}
/** Concrete per-process abuse budget. Deployment additionally requires a distributed gateway limiter. */
export function createAuthenticator(config:AuthConfig,fetcher:typeof fetch=fetch) {
  const issuer=https(config.issuer,config.allowedHosts),resource=https(config.resource,config.allowedHosts),api=https(config.apiResource,config.allowedHosts);
  if(resource.href===api.href||config.clientIds.length===0||config.clientIds.length>100||config.clientIds.some(x=>!claim(x,512))||!claim(config.exchangeClientId,512)||!claim(config.exchangeClientSecret,4096)||!Number.isSafeInteger(config.maxTokenLifetimeSeconds)||config.maxTokenLifetimeSeconds<60||config.maxTokenLifetimeSeconds>600)throw new Error('invalid_configuration');
  for(const endpoint of [config.jwksUri,config.introspectionUri,config.tokenUri,config.metadataUri])if(https(endpoint,config.allowedHosts).origin!==issuer.origin)throw new Error('invalid_configuration');
  if(https(config.resourceMetadataUri,config.allowedHosts).origin!==resource.origin)throw new Error('invalid_configuration');
  const budget=config.requestsPerMinute??60;if(!Number.isSafeInteger(budget)||budget<1||budget>600)throw new Error('invalid_configuration');
  let windowStart=Date.now(),count=0,inflight=0;
  const jwks=createRemoteJWKSet(new URL(config.jwksUri),{timeoutDuration:3000,cooldownDuration:30000,[customFetch]:async(input,init)=>{
    if(String(input)!==config.jwksUri)throw new Error('remote_unavailable');
    const result=await boundedJson(fetcher,config.jwksUri,init);if(result.status!==200||!record(result.body)||!Array.isArray(result.body.keys)||result.body.keys.length>16)throw new Error('remote_unavailable');
    return Response.json(result.body);
  }});
  const verify=async(token:string,audience:string)=> {
    try{const result=await jwtVerify(token,jwks,{issuer:config.issuer,audience,algorithms:['ES256','RS256','PS256','EdDSA'],typ:'at+jwt',requiredClaims:['iss','aud','sub','iat','nbf','exp','jti','client_id','scope'],clockTolerance:0});
      return principal(result.payload,config,audience);
    }catch{throw new AuthFailure(401);}
  };
  const credentials='Basic '+Buffer.from(encodeURIComponent(config.exchangeClientId)+':'+encodeURIComponent(config.exchangeClientSecret)).toString('base64');
  return {
    metadata(){return {resource:config.resource,authorization_servers:[config.issuer],scopes_supported:[...SCOPES],bearer_methods_supported:['header']};},
    async authenticate(request:Request,requiredScope?:string):Promise<Delegation> {
      const started=Date.now();if(started-windowStart>=60000){windowStart=started;count=0;}
      if(++count>budget||inflight>=8)throw new AuthFailure(429);inflight++;
      try {
        const url=new URL(request.url);
        if(url.origin!==resource.origin||url.protocol!=='https:'||url.searchParams.has('access_token'))throw new AuthFailure(401);
        const header=request.headers.get('authorization');if(!header||!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(header)||header.length>16384)throw new AuthFailure(401);
        const mcpToken=header.slice(7);const p=await verify(mcpToken,config.resource);
        // Provider metadata is checked against configured endpoints; never used to choose egress.
        const discovery=await boundedJson(fetcher,config.metadataUri,{headers:{Accept:'application/json'}});
        const m=discovery.body;const supports=(key:string,value:string)=>record(m)&&Array.isArray(m[key])&&m[key].length<=64&&(m[key] as unknown[]).includes(value);
        if(discovery.status!==200||!record(m)||m.issuer!==config.issuer||m.jwks_uri!==config.jwksUri||m.token_endpoint!==config.tokenUri||m.introspection_endpoint!==config.introspectionUri||!supports('code_challenge_methods_supported','S256')||!supports('grant_types_supported','urn:ietf:params:oauth:grant-type:token-exchange')||!supports('token_endpoint_auth_methods_supported','client_secret_basic'))throw new AuthFailure(503);
        const checked=await boundedJson(fetcher,config.introspectionUri,{method:'POST',headers:{Authorization:credentials,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:mcpToken,token_type_hint:'access_token'}).toString()});
        const i=checked.body;
        if(checked.status!==200||!record(i)||i.active!==true||i.iss!==p.issuer||i.sub!==p.subject||i.jti!==p.tokenId||i.exp!==p.expiresAt||i.client_id!==p.clientId||i.aud!==config.resource||typeof i.scope!=='string'||i.scope.split(' ').sort().join(' ')!==[...p.scopes].sort().join(' '))throw new AuthFailure(401);
        if(requiredScope&&!p.scopes.includes(requiredScope))throw new AuthFailure(403,requiredScope);
        const exchanged=await boundedJson(fetcher,config.tokenUri,{method:'POST',headers:{Authorization:credentials,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:token-exchange',subject_token:mcpToken,subject_token_type:'urn:ietf:params:oauth:token-type:access_token',requested_token_type:'urn:ietf:params:oauth:token-type:access_token',resource:config.apiResource,scope:p.scopes.join(' ')}).toString()});
        const e=exchanged.body;
        if(exchanged.status!==200||!record(e)||e.token_type!=='Bearer'||e.issued_token_type!=='urn:ietf:params:oauth:token-type:access_token'||typeof e.access_token!=='string'||e.access_token.length>16384||e.access_token===mcpToken)throw new AuthFailure(401);
        const delegated=await verify(e.access_token,config.apiResource);
        if(delegated.issuer!==p.issuer||delegated.subject!==p.subject||delegated.clientId!==p.clientId||delegated.scopes.some(s=>!p.scopes.includes(s))||requiredScope&&!delegated.scopes.includes(requiredScope)||Date.now()-started>15000)throw new AuthFailure(401);
        return {principal:p,apiToken:e.access_token,mcpToken};
      }catch(error){if(error instanceof AuthFailure)throw error;throw new AuthFailure(503);}
      finally{inflight--;}
    },
    challenge(error:AuthFailure){const kind=error.status===403?'insufficient_scope':'invalid_token';const headers:Record<string,string>={'Cache-Control':'no-store'};
      if(error.status===401||error.status===403)headers['WWW-Authenticate']=`Bearer resource_metadata="${config.resourceMetadataUri}", error="${kind}"${error.scope?`, scope="${error.scope}"`:''}`;
      if(error.status===429)headers['Retry-After']='60';return Response.json({error:error.message},{status:error.status,headers});}
  };
}
