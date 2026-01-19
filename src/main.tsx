import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { initStaleAssetRecovery } from '@/lib/staleBuildRecovery'

// Initialize stale asset auto-recovery BEFORE React renders
// This catches chunk load errors and auto-reloads once
initStaleAssetRecovery();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
