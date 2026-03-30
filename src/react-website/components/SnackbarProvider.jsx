import React, { createContext, useContext, useCallback, useState, useRef, useEffect } from 'react';

const SnackbarContext = createContext(null);

export function useSnackbar() {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used within a SnackbarProvider');
  return ctx;
}

export function SnackbarProvider({ children }) {
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = useState('');
  const [variant, setVariant] = useState('info');
  const timerRef = useRef(null);

  const showSnackbar = useCallback((msg, opts = {}) => {
    setMessage(msg || '');
    setVariant(opts.variant || 'info');
    setOpen(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    const duration = typeof opts.duration === 'number' ? opts.duration : 4000;
    timerRef.current = setTimeout(() => setOpen(false), duration);
  }, []);

  const hideSnackbar = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <SnackbarContext.Provider value={{ showSnackbar, hideSnackbar }}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 1060,
          pointerEvents: 'none'
        }}>
        <div
          style={{
            minWidth: 180,
            maxWidth: 420,
            margin: '0.25rem',
            padding: '0.6rem 0.8rem',
            borderRadius: 6,
            color: '#fff',
            background:
              variant === 'success' ? '#198754' : variant === 'danger' || variant === 'error' ? '#dc3545' : '#343a40',
            boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
            opacity: open ? 1 : 0,
            transform: open ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 200ms, transform 200ms',
            pointerEvents: 'auto'
          }}>
          <div style={{ fontSize: '0.95rem' }}>{message}</div>
        </div>
      </div>
    </SnackbarContext.Provider>
  );
}

export default SnackbarProvider;
