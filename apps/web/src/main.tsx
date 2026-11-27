import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/bricolage-grotesque/index.css';
import '@fontsource-variable/atkinson-hyperlegible-next/index.css';
import './styles/app.css';
import { APP_NAME } from '@smartmouth/protocol';
import { Host } from './host/Host.tsx';
import { Play } from './play/Play.tsx';
import { Admin } from './admin/Admin.tsx';

function App() {
  const path = location.pathname.replace(/\/$/, '');
  if (path === '/host') { document.title = `${APP_NAME} — TV`; return <Host />; }
  if (path === '/admin') { document.title = `${APP_NAME} — admin`; return <Admin />; }
  document.title = APP_NAME;
  return <Play />;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
