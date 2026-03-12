import React from 'react';

export function Box({ children, style }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      padding: '16px 14px',
      boxShadow: '0 1px 3px rgba(15,23,41,0.04),0 4px 12px rgba(15,23,41,0.06)',
      marginBottom: 10, ...style
    }}>
      {children}
    </div>
  );
}

export function BackBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:4,
      background:'none', border:'none', color:'#1B6EF3',
      fontSize:14, fontWeight:600, fontFamily:'inherit',
      cursor:'pointer', padding:'3px 0', marginBottom:8
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Назад
    </button>
  );
}
