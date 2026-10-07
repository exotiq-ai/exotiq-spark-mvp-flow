import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
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
      const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>65536){res.writeHead(413);res.end();return;}chunks.push(Buffer.from(chunk));}
      const headers=new Headers();for(const [name,value]of Object.entries(req.headers)){if(Array.isArray(value))for(const v of value)headers.append(name,v);else if(value!==undefined)headers.set(name,value);}
      const response=await application.fetch(new Request(url,{method:req.method,headers,signal:cancellation.signal,...(chunks.length?{body:Buffer.concat(chunks)}:{})}));
      cancellation.signal.throwIfAborted();
      res.writeHead(response.status,Object.fromEntries(response.headers));
      if(response.body)await pipeline(Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>),res);else res.end();
    }catch{if(!res.destroyed){if(!res.headersSent)res.writeHead(503,{'Cache-Control':'no-store'});res.end();}}
    finally{req.off('aborted',abort);res.off('close',closed);}
  });
  server.maxConnections=64;server.headersTimeout=10000;server.requestTimeout=15000;server.keepAliveTimeout=5000;return server;
}
