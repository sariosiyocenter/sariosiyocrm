import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { CRMProvider } from './context/CRMContext';
import { LanguageProvider } from './context/LanguageContext';

// Auto-reload when JS chunks are stale after a new deployment
window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  const msg = e.reason?.message ?? '';
  if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('Unable to preload') || msg.includes('error loading dynamically imported module')) {
    const last = sessionStorage.getItem('_chunk_reload');
    if (!last || Date.now() - Number(last) > 10000) {
      sessionStorage.setItem('_chunk_reload', String(Date.now()));
      // Force bypass cache on reload
      window.location.href = window.location.href.split('?')[0] + '?_r=' + Date.now();
    }
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <CRMProvider>
          <App />
        </CRMProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
);
