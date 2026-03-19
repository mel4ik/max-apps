import React from 'react';
import { fk, sd } from '../api/helpers';

export default function CardList({ cards, loading, error, onRefresh, onSelect, onAdd }) {
  return React.createElement('div', null,
    // Шапка
    React.createElement('div', { className: 'cl-header' },
      React.createElement('div', { className: 'cl-header-circle1' }),
      React.createElement('div', { className: 'cl-header-circle2' }),
      React.createElement('h1', { className: 'cl-title' },
        React.createElement('span', { className: 'cl-title-icon' }, '\uD83D\uDE8C'), ' Часпик'),
      React.createElement('p', { className: 'cl-subtitle' }, 'Транспорт Lite')
    ),

    // Контент
    React.createElement('div', { className: 'cl-content' },

      // Загрузка
      loading && React.createElement('div', { className: 'cl-loading' },
        React.createElement('div', { className: 'cl-spinner' }),
        React.createElement('p', { className: 'cl-loading-text' }, 'Загрузка карт...')
      ),

      // Ошибка
      error && !loading && React.createElement('div', { className: 'cl-error fade-in' },
        React.createElement('p', { className: 'cl-error-text' }, '\u26a0\ufe0f ', error),
        React.createElement('button', { onClick: onRefresh, className: 'cl-error-btn' }, 'Попробовать снова')
      ),

      // Карты
      !loading && !error && cards.map(function(c, idx) {
        var p = c.parsed || {};
        var cfg = p.cfg || {};
        var cl = cfg.color || '#999';

        var rightContent = null;
        if (cfg.showBalance && p.bal > 0) {
          rightContent = React.createElement('p', { className: 'cl-card-balance' }, fk(p.bal), ' \u20bd');
        } else if (cfg.showTrips && p.trips > 0) {
          rightContent = React.createElement('p', { className: 'cl-card-trips', style: { color: cl } }, p.trips, ' поездок');
        } else if (p.kind === 'abonement') {
          if (p.hasActiveAbonement && p.abEnd) {
            rightContent = React.createElement('p', { className: 'cl-card-abon', style: { color: cl } }, 'до ', sd(p.abEnd));
          } else {
            rightContent = React.createElement('p', { className: 'cl-card-no-service' }, 'Нет активных услуг');
          }
        } else if (cfg.showBalance) {
          rightContent = React.createElement('p', { className: 'cl-card-balance' }, '0 \u20bd');
        }

        return React.createElement('button', {
          key: c.id,
          className: 'cl-card-btn fade-in-up',
          onClick: function() { onSelect(c); },
          style: { animationDelay: (idx * 60) + 'ms' }
        },
          React.createElement('div', { style: { width:44, height:44, borderRadius:13, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0, background:'linear-gradient(135deg,'+cl+','+cl+'88)', boxShadow:'0 2px 8px '+cl+'33' } }, cfg.icon || '\uD83D\uDCB3'),
          React.createElement('div', { style: { flex:1, minWidth:0 } },
            React.createElement('p', { className: 'cl-card-label' }, p.label || c.ticket_description || 'ЕТК'),
            React.createElement('p', { className: 'cl-card-region' }, c.region || '')
          ),
          React.createElement('div', { style: { textAlign:'right', flexShrink:0 } }, rightContent),
          React.createElement('span', { className: 'cl-card-arrow' }, '\u203a')
        );
      }),

      // Добавить карту
      !loading && !error && React.createElement('button', {
        onClick: onAdd,
        className: 'cl-add-btn fade-in'
      }, '+ Добавить карту')
    )
  );
}
