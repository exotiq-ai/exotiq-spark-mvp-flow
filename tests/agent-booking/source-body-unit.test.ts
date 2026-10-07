import {expect,it} from 'vitest';
import {readSourceHandoffBody,readSourceRawBody} from '../../supabase/functions/_shared/external-booking/source-body.ts';

it('preserves exact signed UTF-8 whitespace and Unicode without JSON serialization',async()=>{
 const raw=' { "id" : "evt_synthetic", "name" : "é", "data" : {"n":1} }\n';
 expect(await readSourceRawBody(new Request('https://api.example.invalid',{method:'POST',body:raw}))).toBe(raw);
});
it('bounds a slowly trickled body with one deadline despite an unresolved cancellation',async()=>{
 let interval:ReturnType<typeof setInterval>|undefined,cancelled=false;
 const body=new ReadableStream<Uint8Array>({start(controller){interval=setInterval(()=>controller.enqueue(new TextEncoder().encode(' ')),2);},cancel(){cancelled=true;if(interval)clearInterval(interval);return new Promise(()=>{});}});
 const request=new Request('https://api.example.invalid',{method:'POST',body,duplex:'half'} as RequestInit);
 const pending=readSourceHandoffBody(request,20);
 try{await expect(Promise.race([pending,new Promise(resolve=>setTimeout(()=>resolve('still_stalled'),250))])).rejects.toThrow('Invalid request body');expect(cancelled).toBe(true);}
 finally{if(interval)clearInterval(interval);}
});
it('rejects a pre-aborted fully buffered body before decoding or accepting it',async()=>{
 const abort=new AbortController();abort.abort();
 const body=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new TextEncoder().encode('{}'));controller.close();}});
 await expect(readSourceHandoffBody(new Request('https://api.example.invalid',{method:'POST',body,signal:abort.signal,duplex:'half'} as RequestInit))).rejects.toThrow('Invalid request body');
});
it('rejects oversized, invalid UTF-8 and non-object handoff input without echoing bytes',async()=>{
 for(const raw of ['x'.repeat(262145),new Uint8Array([255])])await expect(readSourceRawBody(new Request('https://api.example.invalid',{method:'POST',body:raw}))).rejects.toThrow('Invalid request body');
 for(const raw of ['x'.repeat(65537),'[]','null'])await expect(readSourceHandoffBody(new Request('https://api.example.invalid',{method:'POST',body:raw}))).rejects.toThrow('Invalid request body');
});
