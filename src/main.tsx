import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { CRMProvider } from './context/CRMContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CRMProvider>
        <App />
      </CRMProvider>
    </BrowserRouter>
  </StrictMode>,
);
