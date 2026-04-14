import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Rescue Loop: Catch errors that happen before React even boots
window.onerror = function(msg, url, line, col, error) {
  console.error("FATAL_STARTUP_ERROR:", { msg, url, line, col, error });
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

