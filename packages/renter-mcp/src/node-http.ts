import { createServer,type IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
function incomingBody(req:IncomingMessage){
  req.pause();let cleanup=()=>{};
  return new ReadableStream<Uint8Array>({
    start(controller){
      const data=(chunk:Buffer)=>{req.pause();controller.enqueue(new Uint8Array(chunk));};
      const end=()=>{cleanup();controller.close();};const error=()=>{cleanup();controller.error(new Error('request_body_unavailable'));};
      cleanup=()=>{req.off('data',data);req.off('end',end);req.off('error',error);req.off('aborted',error);};
      req.on('data',data);req.once('end',end);req.once('error',error);req.once('aborted',error);
    },
    pull(){req.resume();},
    // Pause rather than destroy the shared socket, so bounded rejection can be sent.
    cancel(){req.pause();cleanup();}
  });
}
/** Fixed-origin loopback ingress. TLS ingress must preserve the configured public Host;
 * forwarded host/proto headers never select resource, issuer or egress destinations. */
export function createNodeServer(application:{fetch(request:Request):Promise<Response>},resource:string) {
  const fixed=new URL(resource);
  const server=createServer({maxHeaderSize:16384,connectionsCheckingInterval:1000},async(req,res)=>{
    const cancellation=new AbortController();
    const abort=()=>cancellation.abort();
    const closed=()=>{if(!res.writableFinished)abort();};
    req.once('aborted',abort);res.once('close',closed);
    try{
      const names=req.rawHeaders.filter((_,index)=>index%2===0).map(v=>v.toLowerCase());
      if(req.headers.host!==fixed.host||names.filter(v=>v==='host').length!==1||names.filter(v=>v==='authorization').length>1||!req.url?.startsWith('/')||req.url.startsWith('//')){res.writeHead(400);res.end();return;}
      const url=new URL(req.url,fixed.origin);if(url.origin!==fixed.origin){res.writeHead(400);res.end();return;}
      const headers=new Headers();for(const [name,value]of Object.entries(req.headers)){if(Array.isArray(value))for(const v of value)headers.append(name,v);else if(value!==undefined)headers.set(name,value);}
      const response=await application.fetch(new Request(url,{method:req.method,headers,signal:cancellation.signal,...(req.method!=='GET'&&req.method!=='HEAD'?{body:incomingBody(req),duplex:'half'}:{})} as RequestInit));
      cancellation.signal.throwIfAborted();
      if([400,408,413].includes(response.status))res.setHeader('Connection','close');
      res.writeHead(response.status,Object.fromEntries(response.headers));
      if(response.body)await pipeline(Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>),res);else res.end();
    }catch{if(!res.destroyed){if(!res.headersSent)res.writeHead(503,{'Cache-Control':'no-store'});res.end();}}
    finally{req.off('aborted',abort);res.off('close',closed);}
  });
  server.maxConnections=64;server.headersTimeout=10000;server.requestTimeout=15000;server.keepAliveTimeout=5000;return server;
}
