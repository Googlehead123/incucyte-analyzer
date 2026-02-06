import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/" element={<App />} />
          <Route path="/analyzer" element={<App />} />
          <Route path="/experiments" element={<div>Experiments Page</div>} />
          <Route path="/admin" element={<div>Admin Page</div>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
