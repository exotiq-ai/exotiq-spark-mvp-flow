// Shared Rari/FleetCopilot identity layer.
// Extracted verbatim from elevenlabs-tools so every surface (voice webhook,
// MCP server, in-app chat) verifies callers the exact same fail-closed way.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

// Tool token payload structure
export interface ToolTokenPayload {
  userId: string;
  teamId: string | null;
  iat: number;
  exp: number;
}

// Verify and decode a tool token
export async function verifyToolToken(token: string, secret: string): Promise<ToolTokenPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('Invalid token format - expected 3 parts');
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    
    // Verify signature
    const encoder = new TextEncoder();
    const data = `${headerB64}.${payloadB64}`;
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    // Convert base64url to standard base64 and pad if needed
    let signatureStd = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    while (signatureStd.length % 4 !== 0) signatureStd += '=';
    const signatureBytes = base64Decode(signatureStd);
    
    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(data));
    if (!valid) {
      console.warn('Token signature verification failed');
      return null;
    }
    
    // Decode payload
    let payloadStd = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    while (payloadStd.length % 4 !== 0) payloadStd += '=';
    const payloadJson = new TextDecoder().decode(base64Decode(payloadStd));
    const payload = JSON.parse(payloadJson) as ToolTokenPayload;
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.warn('Token expired:', { exp: payload.exp, now });
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }

// Helper function to get user's team_id
export async function getUserTeamId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  
  if (error) {
    console.error('[getUserTeamId] Error:', error);
    return null;
  }
  
  return data?.team_id || null;
}

export function looksLikeJwt(token: string): boolean {
  return token.split('.').length === 3;
}
