import { defineConfig } from 'vitest/config';
import { suiteFiles } from './scripts/agent-booking/test-suites.mjs';

const suite = process.env.AGENT_TEST_SUITE ?? 'unit';
const selection = suiteFiles(suite);
export default defineConfig({
  test: {
    projects: [{
      test: {
        name: suite === 'pilot' ? 'synthetic' : suite,
        environment: 'node', globals: false,
        include: selection.include, exclude: selection.exclude,
        setupFiles: suite === 'unit' || suite === 'contract'
          ? ['./tests/agent-booking/helpers/offline-network.ts'] : [],
        testTimeout: 10000,
      },
    }],
  },
});
