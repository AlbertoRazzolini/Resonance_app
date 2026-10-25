import 'bootstrap/dist/css/bootstrap.min.css'
import '@/styles/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { installStaleChunkReload } from '@/lib/reloadOnStaleChunk'

// Dopo un deploy una scheda già aperta non trova più i file delle pagine: ricarica da sola una volta
installStaleChunkReload({
  target: window,
  // Si legge solo al bisogno: con i dati del sito bloccati `sessionStorage` lancia già all'accesso
  storage: {
    getItem: (key) => window.sessionStorage.getItem(key),
    setItem: (key, value) => window.sessionStorage.setItem(key, value),
  },
  reload: () => window.location.reload(),
  now: () => Date.now(),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
