/** Bounded remote JSON. Credentials and upstream bodies never enter exceptions. */
export async function boundedJson(fetcher:typeof fetch,url:string,init:RequestInit={},maxBytes=32768,timeoutMs=3000):Promise<{status:number;headers:Headers;body:unknown}> {
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
  try {
    const response=await fetcher(url,{...init,redirect:'error',signal:controller.signal});
    const media=response.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase();
    if(!media||!['application/json','application/jwk-set+json'].includes(media))throw new Error('remote_unavailable');
    if(Number(response.headers.get('content-length')??0)>maxBytes) throw new Error('remote_unavailable');
    reader=response.body?.getReader(); const chunks:Uint8Array[]=[];let length=0;
    if(reader) for(;;) {const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>maxBytes)throw new Error('remote_unavailable');chunks.push(part.value);}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return {status:response.status,headers:response.headers,body:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))};
  } catch {controller.abort();throw new Error('remote_unavailable');}
  finally {clearTimeout(timer);if(reader)void reader.cancel().catch(()=>{});}
}
export const record=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
