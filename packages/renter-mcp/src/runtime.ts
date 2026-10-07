import { createMcpApplication,type ApplicationConfig } from './server.ts';

export interface RuntimeConfig {application:ApplicationConfig;port:number}
/** No discovery from token claims, ambient credentials or permissive defaults. */
export function readRuntimeConfig(env:Record<string,string|undefined>):RuntimeConfig {
  try {
    const required=(name:string)=>{const value=env[name];if(!value||value.length>4096)throw new Error();return value;};
    if(required('EXOTIQ_MCP_ENABLED')!=='true'||required('EXOTIQ_MCP_GATEWAY_PROFILE')!=='distributed-limit-tls-v1')throw new Error();
    const list=(name:string)=>{const values=required(name).split(',');if(values.length>100||values.some(v=>!v||v.trim()!==v)||new Set(values).size!==values.length)throw new Error();return values;};
    const application:ApplicationConfig={customerOrigin:required('EXOTIQ_CUSTOMER_ORIGIN'),auth:{
      issuer:required('EXOTIQ_OAUTH_ISSUER'),resource:required('EXOTIQ_MCP_RESOURCE'),apiResource:required('EXOTIQ_API_RESOURCE'),
      jwksUri:required('EXOTIQ_OAUTH_JWKS_URI'),introspectionUri:required('EXOTIQ_OAUTH_INTROSPECTION_URI'),tokenUri:required('EXOTIQ_OAUTH_TOKEN_URI'),metadataUri:required('EXOTIQ_OAUTH_METADATA_URI'),resourceMetadataUri:required('EXOTIQ_MCP_RESOURCE_METADATA_URI'),
      allowedHosts:list('EXOTIQ_OAUTH_ALLOWED_HOSTS'),clientIds:list('EXOTIQ_OAUTH_CONSUMER_CLIENT_IDS'),exchangeClientId:required('EXOTIQ_OAUTH_EXCHANGE_CLIENT_ID'),exchangeClientSecret:required('EXOTIQ_OAUTH_EXCHANGE_CLIENT_SECRET'),maxTokenLifetimeSeconds:600,requestsPerMinute:60,
    },...(env.EXOTIQ_MCP_ALLOWED_ORIGINS?{allowedOrigins:list('EXOTIQ_MCP_ALLOWED_ORIGINS')}:{})};
    const port=Number(env.EXOTIQ_MCP_PORT??8788);if(!Number.isSafeInteger(port)||port<1024||port>65535)throw new Error();
    const resource=new URL(application.auth.resource),metadata=new URL(application.auth.resourceMetadataUri);
    if(resource.pathname===metadata.pathname||!metadata.pathname.startsWith('/.well-known/oauth-protected-resource'))throw new Error();
    createMcpApplication(application); // Validates configuration; makes no outbound request.
    return {application,port};
  } catch {throw new Error('configuration_unavailable');}
}
