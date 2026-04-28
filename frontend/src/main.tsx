import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AuthProvider } from './context/AuthContext';

if (window.location.port === '5174' && window.location.pathname === '/') {
  window.history.replaceState({}, '', '/admin/login');
}
if (window.location.port === '5175' && window.location.pathname === '/') {
  window.history.replaceState({}, '', '/donor-login');
}
if (window.location.port === '5176' && window.location.pathname === '/') {
  window.history.replaceState({}, '', '/hospital-login');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
