import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/bricolage-grotesque/index.css';
import '@fontsource-variable/atkinson-hyperlegible-next/index.css';
import './styles/app.css';
import { APP_NAME } from '@smartmouth/protocol';
import { Host } from './host/Host.tsx';
import { Play } from './play/Play.tsx';

function App() {
  const path = location.pathname.replace(/\/$/, '');
  if (path === '/host') { document.title = `${APP_NAME} — TV`; return <Host />; }
  if (path === '/admin') {
    document.title = `${APP_NAME} — admin`;
    return <div className="phone"><h1 className="display">Admin</h1><p className="muted">The review queue and settings come in milestone 2 (ADR 0019).</p></div>;
  }
  document.title = APP_NAME;
  return <Play />;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
