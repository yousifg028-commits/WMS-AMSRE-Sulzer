import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

window.addEventListener('error', (e) => {
  document.getElementById('root')!.innerHTML = '<pre style="padding:20px;white-space:pre-wrap;color:red;background:#fff;font-size:14">' + e.message + '\n' + e.filename + ':' + e.lineno + '\n' + (e.error?.stack || '') + '</pre>';
});
window.addEventListener('unhandledrejection', (e) => {
  document.getElementById('root')!.innerHTML = '<pre style="padding:20px;white-space:pre-wrap;color:red;background:#fff;font-size:14">Unhandled: ' + e.reason + '</pre>';
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
