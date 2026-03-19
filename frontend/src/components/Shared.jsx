import React from 'react';

export function Box({ children, style }) {
  return React.createElement('div', {
    className: 'box-card fade-in',
    style: style || {}
  }, children);
}

export function BackBtn({ onClick }) {
  return React.createElement('button', {
    onClick: onClick,
    className: 'back-btn',
    style: {
      display: 'flex', alignItems: 'center', gap: 4,
      background: 'none', border: 'none',
      color: '#1B6EF3', fontSize: 14, fontWeight: 600,
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
