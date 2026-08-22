import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The two faces askhb.no renders in. Loaded here rather than in the preview
// components so a pane that mounts mid-session does not flash a fallback face.
import '@fontsource-variable/newsreader'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
