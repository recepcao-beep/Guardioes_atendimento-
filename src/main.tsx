import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// 1. Proactively clean up any stale/detached Supabase auth tokens if no active user session exists
try {
  const sessionUser = localStorage.getItem('hotel_reviews_current_user');
  if (!sessionUser) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => {
      localStorage.removeItem(k);
      console.log('Cleared stale detached auth token key:', k);
    });
  }
} catch (storageErr) {
  console.warn('Failed to clean up stale localStorage keys on start:', storageErr);
}

// 2. Register global interceptors to gracefully catch and dismiss stale session refresh errors
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = event.reason ? String(event.reason.message || event.reason) : '';
    if (
      reasonStr.includes('Refresh Token Not Found') || 
      reasonStr.includes('Invalid Refresh Token') ||
      reasonStr.includes('invalid_grant')
    ) {
      // Prevent the error from fracturing the application runtime or displaying in logs
      event.preventDefault();
      console.warn('Gracefully handled stale Supabase session refresh rejection:', reasonStr);
      
      // Purge any residual tokens so the client won't repeatedly attempt failing refresh cycles
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        localStorage.removeItem('hotel_reviews_current_user');
      } catch (err) {
        console.warn('Silent key purge failed:', err);
      }
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (
      msg.includes('Refresh Token Not Found') || 
      msg.includes('Invalid Refresh Token') ||
      msg.includes('invalid_grant')
    ) {
      event.preventDefault();
      console.warn('Gracefully handled stale Supabase session refresh error:', msg);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
