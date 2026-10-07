import {expect,it} from 'vitest';
import {safeProviderUrl} from '../../supabase/functions/_shared/external-booking/handoff-store.ts';
import {validateContract} from '../../supabase/functions/_shared/external-booking/contracts.ts';
// Public fixture from Stripe's exact pinned API documentation, not a live URL:
// https://docs.stripe.com/api/checkout/sessions/create?api-version=2025-08-27.basil
const documented='https://checkout.stripe.com/c/pay/cs_test_a11YYufWQzNY63zpQ6QSNRQhkUpVph4WRmzW0zWJO2znZKdVujZ0N0S22u#fidkdWxOYHwnPyd1blpxYHZxWjA0SDdPUW5JbmFMck1wMmx9N2BLZjFEfGRUNWhqTmJ%2FM2F8bUA2SDRySkFdUV81T1BSV0YxcWJcTUJcYW5rSzN3dzBLPUE0TzRKTTxzNFBjPWZEX1NKSkxpNTVjRjN8VHE0YicpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPyd2bGtiaWBabHFgaCcpJ2BrZGdpYFVpZGZgbWppYWB3dic%2FcXdwYHgl';
const result=(url:string,action='checkout')=>({api_version:'v1',source_checked_at:'2030-01-01T00:00:00Z',expires_at:'2030-01-01T00:10:00Z',action,provider_url:url});
it('preserves documented opaque Checkout fragment through both server and canonical browser validator',()=>{expect(safeProviderUrl(documented,'checkout')).toBe(documented);expect(validateContract('CustomerHandoffResolveResult',result(documented)).ok).toBe(true);});
it.each(['#token=legacy','#fidkd%00AAAA','#fidkd%3Ftoken%3Dlegacy','#fidkd%ZZ','#fidkdAAAA%252F','#fidkdAAAA&token=legacy'])('denies fragment substitution %s',fragment=>{const url='https://checkout.stripe.com/c/pay/synthetic'+fragment;expect(()=>safeProviderUrl(url,'checkout')).toThrow();expect(validateContract('CustomerHandoffResolveResult',result(url)).ok).toBe(false);});
it('rejects decoded credential query names and every Identity fragment; generic links remain strict',()=>{
 for(const url of ['https://checkout.stripe.com/c/pay/synthetic?%61ccess_token=secret','https://checkout.stripe.com/c/pay/synthetic?%74=legacy']){expect(()=>safeProviderUrl(url,'checkout')).toThrow();expect(validateContract('CustomerHandoffResolveResult',result(url)).ok).toBe(false);}
 expect(()=>safeProviderUrl('https://verify.stripe.com/start/synthetic#fidkdAAAA','identity')).toThrow();expect(validateContract('CustomerHandoffResolveResult',result('https://verify.stripe.com/start/synthetic#fidkdAAAA','identity')).ok).toBe(false);
 expect(validateContract('ScopedLinks',{status:documented}).ok).toBe(false);
});
