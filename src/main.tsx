import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CRMProvider } from './context/CRMContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CRMProvider>
      <App />
    </CRMProvider>
  </StrictMode>,
);
