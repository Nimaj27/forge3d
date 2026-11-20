import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/layout.css';
import './styles/editor.css';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root introuvable');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker : application installable et utilisable hors ligne (sauf le mode IA)
if ('serviceWorker' in navigator && import.meta.env.PROD) registerSW({ immediate: true });
