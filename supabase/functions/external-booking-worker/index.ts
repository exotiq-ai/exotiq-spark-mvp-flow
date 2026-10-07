import {createNotificationWorker,readWorkerConfig} from '../_shared/external-booking/notification-worker.ts';
declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Promise<Response>):void};
if((import.meta as ImportMeta&{main?:boolean}).main&&typeof Deno!=='undefined'){
 let handler:(request:Request)=>Promise<Response>;
 try{handler=createNotificationWorker(readWorkerConfig(Deno.env));}
 catch{handler=async()=>new Response(JSON.stringify({code:'configuration_unavailable'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
 Deno.serve(handler);
}
