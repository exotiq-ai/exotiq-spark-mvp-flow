import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { FleetProvider } from './contexts/FleetContext'

createRoot(document.getElementById("root")!).render(
  <FleetProvider>
    <App />
  </FleetProvider>
);
