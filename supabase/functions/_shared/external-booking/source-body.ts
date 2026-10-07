/** One total read budget also bounds slow or stalled clients. Never wait for
 * cancellation of an untrusted producer before returning the safe error. */
async function sourceBytes(request:Request,maximum:number,timeoutMs:number):Promise<Uint8Array>{
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>5000)throw Error('Invalid request body');
 const length=request.headers.get('content-length');
 if((length&&(!/^[0-9]+$/.test(length)||Number(length)>maximum))||!request.body)throw Error('Invalid request body');
 const reader=request.body.getReader(),parts:Uint8Array[]=[];
 let size=0,timer:ReturnType<typeof setTimeout>|undefined,onAbort:()=>void=()=>{};
 const deadline=new Promise<never>((_,reject)=>{
  onAbort=()=>reject(Error('Invalid request body'));
  request.signal.addEventListener('abort',onAbort,{once:true});
  timer=setTimeout(onAbort,timeoutMs);
  if(request.signal.aborted)onAbort();
 });
 // A pre-aborted request can fail before entering Promise.race. Observe only
 // this budget rejection; the actual read failure still reaches the caller.
 void deadline.catch(()=>undefined);
 try{
  while(true){
   if(request.signal.aborted)throw Error('Invalid request body');
   const chunk=await Promise.race([reader.read(),deadline]);
   if(request.signal.aborted)throw Error('Invalid request body');
   if(chunk.done)break;
   size+=chunk.value.byteLength;if(size>maximum)throw Error('Invalid request body');
   parts.push(chunk.value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
  return bytes;
 }catch{throw Error('Invalid request body');}
 finally{
  if(timer)clearTimeout(timer);request.signal.removeEventListener('abort',onAbort);
  void reader.cancel().catch(()=>undefined);reader.releaseLock();
 }
}
/** Exact UTF-8 payload goes to Stripe; never parse/re-serialize signed events. */
export async function readSourceRawBody(request:Request,timeoutMs=5000):Promise<string>{
 try{return new TextDecoder('utf-8',{fatal:true}).decode(await sourceBytes(request,262144,timeoutMs));}
 catch{throw Error('Invalid request body');}
}
export async function readSourceHandoffBody(request:Request,timeoutMs=5000):Promise<Record<string,any>>{
 try{
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await sourceBytes(request,65536,timeoutMs)));
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid request body');
  return value;
 }catch{throw Error('Invalid request body');}
}
