import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({ resolve:{alias:{'https://deno.land/std@0.190.0/http/server.ts':resolve('tests/agent-booking/helpers/edge-server.ts'),'https://esm.sh/@supabase/supabase-js@2.77.0':resolve('tests/agent-booking/helpers/edge-supabase.ts')}}, test: { environment: 'node', fileParallelism: false, maxWorkers: 1, testTimeout: 30000, hookTimeout: 30000, include: ['tests/agent-booking/idempotency.test.ts','tests/agent-booking/request-compatibility.test.ts'] } });
