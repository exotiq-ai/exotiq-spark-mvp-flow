import {defineConfig} from 'vitest/config';
export default defineConfig({cacheDir:'.agent-test-cache',test:{environment:'node',fileParallelism:false,maxWorkers:1,testTimeout:30000,hookTimeout:30000,include:['tests/agent-booking/request-routes.test.ts']}});
