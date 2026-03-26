import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Apply theme class to <html> BEFORE first paint to prevent flash
const stored = localStorage.getItem('litassist-theme')
if (stored) {
  try {
    const parsed = JSON.parse(stored)
    if (parsed?.state?.isDark === false) {
      document.documentElement.classList.remove('dark')
    } else {
      document.documentElement.classList.add('dark')
    }
  } catch {
    document.documentElement.classList.add('dark')
  }
} else {
  document.documentElement.classList.add('dark')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)