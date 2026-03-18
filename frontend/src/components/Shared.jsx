import React from 'react';

export function Box({ children, style }) {
  return React.createElement('div', {
    className: 'fade-in',
    style: Object.assign({
      background: 'var(--card)',
      borderRadius: 'var(--radius-lg)',
      padding: '16px 14px',
      boxShadow: 'var(--card-shadow)',
      marginBottom: 10,
      transition: 'background 0.2s, box-shadow 0.2s',
    }, style || {})
  }, children);
}

export function BackBtn({ onClick }) {
  return React.createElement('button', {
    onClick: onClick,
    style: {
      display: 'flex', alignItems: 'center', gap: 4,
      background: 'none', border: 'none',
      color: 'var(--blue)', fontSize: 14, fontWeight: 600,
      fontFamily: 'inherit', cursor: 'pointer',
      padding: '3px 0', marginBottom: 8,
    }
  },
    React.createElement('svg', { width:18, height:18, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:'2.5' },
      React.createElement('polyline', { points:'15 18 9 12 15 6' })
    ),
    'Назад'
  );
}
