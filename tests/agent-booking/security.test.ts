import {describe,it,expect} from 'vitest';
import {boundedJson,readRuntimeConfig} from '../../supabase/functions/external-booking-api/index';
import {createResourceAuthenticator} from '../../supabase/functions/_shared/external-booking/auth';
import {safeApiError,BookingApiError} from '../../supabase/functions/_shared/external-booking/errors';
describe('ingress denial and secrecy',()=>{
 it('bounds a never-ending body by an absolute deadline, not only byte count',async()=>{
  let controller!:ReadableStreamDefaultController<Uint8Array>;
  const body=new ReadableStream<Uint8Array>({start(value){controller=value;value.enqueue(new TextEncoder().encode('{'));}});
  const pending=boundedJson(new Response(body),32768,15).then(()=>({code:'accepted'}),error=>({code:error.code}));
  try {expect(await Promise.race([pending,new Promise(resolve=>setTimeout(()=>resolve({code:'stalled'}),100))])).toEqual({code:'invalid_input'});}
  finally {try{controller.close();}catch{}await pending;}
 });
 it('rejects unsafe declared body size and malformed UTF8 without echo',async()=>{
  await expect(boundedJson(new Response('{}',{headers:{'content-length':'65536'}}))).rejects.toMatchObject({code:'invalid_input'});
  await expect(boundedJson(new Response(new Uint8Array([0xff,0xfe])))).rejects.toMatchObject({code:'invalid_input'});
 });
 it('unconfigured provider/runtime denies operations before any network access',async()=>{
  expect(()=>readRuntimeConfig({get:()=>undefined})).toThrow();
  const auth=createResourceAuthenticator(null,{resolveCustomer:async()=>{throw Error('must not read');},isTokenActive:async()=>{throw Error('must not introspect');},enforceRateLimit:async()=>{throw Error('must not read');}});
  await expect(auth.requirePrincipal(new Request('https://api.example.invalid/v1/quotes'),'quotes:create')).rejects.toMatchObject({code:'upstream_unavailable'});
 });
 it('serializes only canonical public errors, dropping credential-shaped details and exceptions',()=>{
  const secret='Bearer private-secret receipt-private document-private';
  for(const error of [new Error(secret),{message:secret,access_token:secret},new BookingApiError('forbidden',{field:secret,retry_after_seconds:NaN})])expect(JSON.stringify(safeApiError(error))).not.toContain('private');
 });
});
