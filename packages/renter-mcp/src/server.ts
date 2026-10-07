import { createMcpHandler,McpServer,type StandardSchemaWithJSON } from '@modelcontextprotocol/server';
import { schemas,validateContract,validateIdempotencyKey,type ContractName,type JsonSchema } from '../../../supabase/functions/_shared/external-booking/contracts.ts';
import { createAuthenticator,AuthFailure,type AuthConfig,type Delegation } from './auth.ts';
import { ApiFailure,createApiClient,waitingAuthorizationSchema,waitingConsentSchema } from './api-client.ts';
import { record } from './http.ts';
export interface ApplicationConfig {auth:AuthConfig;customerOrigin:string;allowedOrigins?:readonly string[]}
export const toolScopes:Record<string,string>={search_vehicles:'catalog:read',check_availability:'catalog:read',create_quote:'quotes:create',submit_rental_request:'rental_requests:create',get_request_status:'rental_requests:read',create_checkout_handoff:'checkout:handoff'};
function standard(schema:JsonSchema|Record<string,unknown>,validate:(value:unknown)=>boolean):StandardSchemaWithJSON<Record<string,unknown>> {
  return {'~standard':{version:1,vendor:'exotiq-canonical',jsonSchema:{input:()=>schema as Record<string,unknown>,output:()=>schema as Record<string,unknown>},validate:(value)=>record(value)&&validate(value)?{value}:{issues:[{message:'Invalid contract data.'}]}}};
}
function canonical(name:ContractName){return standard(schemas[name],v=>validateContract(name,v).ok);}
const refSchema:JsonSchema={type:'object',properties:{ref:{type:'string',minLength:1,maxLength:80,pattern:'^[A-Za-z0-9_-]+$'}},required:['ref'],additionalProperties:false};
const submitSchema:JsonSchema={type:'object',properties:{quote_id:schemas.QuoteRequest.properties!.operator_id,idempotency_key:{type:'string',minLength:16,maxLength:128,pattern:'^[A-Za-z0-9._:-]+$'}},required:['quote_id','idempotency_key'],additionalProperties:false};
function strictKeys(v:Record<string,unknown>,keys:string[]){return Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));}
export function createMcpApplication(config:ApplicationConfig,fetcher:typeof fetch=fetch) {
  const authenticator=createAuthenticator(config.auth,fetcher);const resource=new URL(config.auth.resource),metadata=new URL(config.auth.resourceMetadataUri);
  const customer=new URL(config.customerOrigin);if(customer.protocol!=='https:'||customer.pathname!=='/'||customer.search||customer.hash||customer.username||customer.password)throw new Error('invalid_configuration');
  const origins=config.allowedOrigins??[resource.origin];if(origins.some(x=>{try{return new URL(x).origin!==x||!x.startsWith('https://');}catch{return true;}}))throw new Error('invalid_configuration');
  function server(delegation:Delegation,signal:AbortSignal) {
    const api=createApiClient({apiResource:config.auth.apiResource,customerOrigin:config.customerOrigin,apiScopes:delegation.apiScopes},delegation.apiToken,fetcher,signal);
    const s=new McpServer({name:'exotiq-renter',version:'0.1.0'});
    const descriptors:Array<{name:string;input:StandardSchemaWithJSON<Record<string,unknown>>;output:ContractName;execute:(input:Record<string,unknown>)=>Promise<Record<string,unknown>>;readOnly:boolean;idempotent:boolean;waiting?:boolean}>= [
      {name:'search_vehicles',input:canonical('VehiclesQuery'),output:'VehiclesPage',execute:api.search,readOnly:true,idempotent:true},
      {name:'check_availability',input:canonical('AvailabilityRequest'),output:'AvailabilityResult',execute:api.availability,readOnly:true,idempotent:true},
      {name:'create_quote',input:canonical('QuoteRequest'),output:'QuoteResult',execute:api.quote,readOnly:false,idempotent:false},
      {name:'submit_rental_request',input:standard(submitSchema,v=>record(v)&&strictKeys(v,['quote_id','idempotency_key'])&&typeof v.quote_id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.quote_id)&&validateIdempotencyKey(v.idempotency_key)),output:'RentalRequestResult',execute:api.submit,readOnly:false,idempotent:true,waiting:true},
      {name:'get_request_status',input:standard(refSchema,v=>record(v)&&strictKeys(v,['ref'])&&typeof v.ref==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v.ref)),output:'RentalStatusResult',execute:api.status,readOnly:false,idempotent:false,waiting:true},
      {name:'create_checkout_handoff',input:standard(refSchema,v=>record(v)&&strictKeys(v,['ref'])&&typeof v.ref==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v.ref)),output:'CheckoutHandoffResult',execute:api.checkout,readOnly:false,idempotent:false,waiting:true}
    ];
    for(const tool of descriptors){
      const errorSchema={...schemas.ApiError,properties:{...schemas.ApiError.properties,customer_account_url:{type:'string',pattern:'^https://'}}};
      const output={type:'object',anyOf:[schemas[tool.output],errorSchema,...(tool.waiting?[waitingConsentSchema,waitingAuthorizationSchema]:[])]};
      const valid=(v:unknown)=>validateContract(tool.output,v).ok||validateContract('ApiError',v).ok||record(v)&&typeof v.code==='string'&&typeof v.customer_account_url==='string'&&validateContract('ApiError',Object.fromEntries(Object.entries(v).filter(([k])=>k!=='customer_account_url'))).ok||tool.waiting===true&&record(v)&&((v.status==='awaiting_customer_consent'&&strictKeys(v,['status','consent_url','retry_after','expires_at'])&&v.retry_after===5&&typeof v.consent_url==='string'&&typeof v.expires_at==='string')||(v.status==='awaiting_customer_authorization'&&strictKeys(v,['status','customer_url','expires_at'])&&typeof v.customer_url==='string'&&typeof v.expires_at==='string'));
      s.registerTool(tool.name,{description:'Use the renter API. Customer consent, identity, operator approval and payment remain separate required steps.',inputSchema:tool.input,outputSchema:standard(output,valid),annotations:{readOnlyHint:tool.readOnly,destructiveHint:false,idempotentHint:tool.idempotent,openWorldHint:true}},async(input)=>{
        try{const body=await tool.execute(input);return {structuredContent:body,content:[{type:'text',text:body.status==='awaiting_customer_consent'?'Customer consent is required. Open the consent URL, then retry with the same key.':body.status==='awaiting_customer_authorization'?'Customer authorization is required. Open the customer URL and complete authorization before retrying.':'The API result is attached. Follow its next action; payment and confirmation require authoritative status.'}]};}
        catch(error){const body=error instanceof ApiFailure?error.body:{code:'upstream_unavailable',message:'The service could not verify this operation.',request_id:crypto.randomUUID(),retryable:true};return {isError:true,structuredContent:body,content:[{type:'text',text:'The operation could not be completed. Review the error code before retrying.'}]};}
      });
    }
    return s;
  }
  return {
    async fetch(request:Request):Promise<Response> {
      const url=new URL(request.url);const origin=request.headers.get('origin');
      if(url.origin!==resource.origin)return new Response(null,{status:400});
      if(origin&&!origins.includes(origin))return new Response(null,{status:403});
      if(url.pathname===metadata.pathname&&request.method==='GET'&&!url.search)return Response.json(authenticator.metadata(),{headers:{'Cache-Control':'public, max-age=300'}});
      if(url.pathname!==resource.pathname)return new Response(null,{status:404});
      if(url.searchParams.has('access_token'))return authenticator.challenge(new AuthFailure(401));
      let parsed:unknown,scope:string|undefined;
      if(request.method==='POST'){
        if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return new Response(null,{status:415});
        try{const reader=request.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
          if(reader)try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>65536)return new Response(null,{status:413});chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});}
          const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
        }catch{return new Response(null,{status:400});}
        if(!record(parsed))return new Response(null,{status:400});
        if(parsed.method==='tools/call'&&record(parsed.params)&&typeof parsed.params.name==='string'&&Object.hasOwn(toolScopes,parsed.params.name))scope=toolScopes[parsed.params.name];
      }
      let delegation:Delegation;try{delegation=await authenticator.authenticate(request,scope);}catch(error){return authenticator.challenge(error instanceof AuthFailure?error:new AuthFailure(503));}
      request.signal.throwIfAborted();
      const handler=createMcpHandler(()=>server(delegation,request.signal),{legacy:'stateless',responseMode:'json',maxRequestBodySize:65536});
      try{return await handler.fetch(request,{parsedBody:parsed,authInfo:{token:delegation.mcpToken,clientId:delegation.principal.clientId,scopes:delegation.principal.scopes,expiresAt:delegation.principal.expiresAt,resource:new URL(config.auth.resource),resourceMetadataUrl:config.auth.resourceMetadataUri}});}finally{await handler.close();}
    }
  };
}
