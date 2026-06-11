import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { CRMProvider } from './context/CRMContext';
import { LanguageProvider } from './context/LanguageContext';

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
