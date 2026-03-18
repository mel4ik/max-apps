import React from 'react';
import { fk, sd } from '../api/helpers';

export default function CardList({ cards, loading, error, onRefresh, onSelect, onAdd }) {
  return React.createElement('div', null,
    // Шапка
    React.createElement('div', { style: { padding:'16px 16px 20px', background:'var(--header-bg)', borderRadius:'0 0 24px 24px', position:'relative', overflow:'hidden', marginBottom:-4 } },
      React.createElement('div', { style: { position:'absolute', right:-40, top:-40, width:140, height:140, borderRadius:'50%', background:'rgba(27,110,243,0.08)' } }),
      React.createElement('div', { style: { position:'absolute', left:-20, bottom:-20, width:80, height:80, borderRadius:'50%', background:'rgba(255,107,0,0.06)' } }),
      React.createElement('h1', { style: { fontSize:24, fontWeight:800, color:'#fff', display:'flex', alignItems:'center', gap:8, margin:0, position:'relative', zIndex:1 } },
        React.createElement('span', { style: { fontSize:28 } }, '\uD83D\uDE8C'), ' \u0427\u0430\u0441\u043f\u0438\u043a'),
      React.createElement('p', { style: { fontSize:11, fontWeight:500, color:'rgba(255,255,255,0.35)', marginTop:4, position:'relative', zIndex:1, letterSpacing:0.5 } }, '\u0422\u0440\u0430\u043d\u0441\u043f\u043e\u0440\u0442 Lite')
    ),

    // Контент
    React.createElement('div', { style: { padding:'12px 14px 16px' } },

      // Загрузка
      loading && React.createElement('div', { style: { textAlign:'center', padding:'40px 0' } },
        React.createElement('div', { style: { width:32, height:32, border:'3px solid var(--border)', borderTopColor:'var(--blue)', borderRadius:'50%', margin:'0 auto 12px', animation:'spin 0.6s linear infinite' } }),
        React.createElement('p', { style: { fontSize:13, color:'var(--text-hint)' } }, '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u043a\u0430\u0440\u0442...')
      ),

      // Ошибка
      error && !loading && React.createElement('div', { className:'fade-in', style: { textAlign:'center', padding:'32px 0' } },
        React.createElement('p', { style: { fontSize:14, fontWeight:600, marginBottom:8, color:'var(--text)' } }, '\u26a0\ufe0f ', error),
        React.createElement('button', { onClick: onRefresh, style: { padding:'10px 20px', fontSize:13, fontWeight:600, fontFamily:'inherit', color:'var(--blue)', background:'var(--blue-bg)', border:'none', borderRadius:10, cursor:'pointer' } }, '\u041f\u043e\u043f\u0440\u043e\u0431\u043e\u0432\u0430\u0442\u044c \u0441\u043d\u043e\u0432\u0430')
      ),

      // Карты
      !loading && !error && cards.map(function(c, idx) {
        var p = c.parsed || {};
        var cfg = p.cfg || {};
        var cl = cfg.color || '#999';

        var rightContent = null;
        if (cfg.showBalance && p.bal > 0) {
          rightContent = React.createElement('p', { style: { fontSize:16, fontWeight:700, margin:0, color:'var(--text)' } }, fk(p.bal), ' \u20bd');
        } else if (cfg.showTrips && p.trips > 0) {
          rightContent = React.createElement('p', { style: { fontSize:16, fontWeight:700, margin:0, color:cl } }, p.trips, ' \u043f\u043e\u0435\u0437\u0434\u043e\u043a');
        } else if (p.kind === 'abonement') {
          if (p.hasActiveAbonement && p.abEnd) {
            rightContent = React.createElement('p', { style: { fontSize:12, fontWeight:700, margin:0, color:cl } }, '\u0434\u043e ', sd(p.abEnd));
          } else {
            rightContent = React.createElement('p', { style: { fontSize:11, fontWeight:600, margin:0, color:'var(--text-hint)' } }, '\u041d\u0435\u0442 \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0443\u0441\u043b\u0443\u0433');
          }
        } else if (cfg.showBalance) {
          rightContent = React.createElement('p', { style: { fontSize:16, fontWeight:700, margin:0, color:'var(--text)' } }, '0 \u20bd');
        }

        return React.createElement('button', {
          key: c.id,
          className: 'fade-in-up',
          onClick: function() { onSelect(c); },
          style: {
            display:'flex', alignItems:'center', gap:10, width:'100%',
            padding:'14px 14px', background:'var(--card)', border:'none',
            borderRadius:'var(--radius-lg)', marginBottom:8, cursor:'pointer',
            fontFamily:'inherit', textAlign:'left',
            boxShadow:'var(--card-shadow)',
            transition:'transform 0.2s, box-shadow 0.2s',
            animationDelay: (idx * 60) + 'ms',
          }
        },
          React.createElement('div', { style: { width:44, height:44, borderRadius:13, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0, background:'linear-gradient(135deg,'+cl+','+cl+'88)', boxShadow:'0 2px 8px '+cl+'33' } }, cfg.icon || '\uD83D\uDCB3'),
          React.createElement('div', { style: { flex:1, minWidth:0 } },
            React.createElement('p', { style: { fontSize:14, fontWeight:700, margin:'0 0 2px', color:'var(--text)' } }, p.label || c.ticket_description || '\u0415\u0422\u041a'),
            React.createElement('p', { style: { fontSize:11, color:'var(--text-hint)', margin:0 } }, c.region || '')
          ),
          React.createElement('div', { style: { textAlign:'right', flexShrink:0 } }, rightContent),
          React.createElement('span', { style: { fontSize:18, color:'var(--text-hint)', fontWeight:300, marginLeft:4 } }, '\u203a')
        );
      }),

      // Добавить карту
      !loading && !error && React.createElement('button', {
        onClick: onAdd,
        className: 'fade-in',
        style: {
          display:'flex', alignItems:'center', justifyContent:'center', gap:7,
          width:'100%', padding:14, fontSize:14, fontWeight:600,
          fontFamily:'inherit', color:'var(--blue)',
          background:'var(--card)', border:'2px dashed var(--border)',
          borderRadius:'var(--radius-lg)', cursor:'pointer', marginTop:4,
          transition:'border-color 0.2s, background 0.2s',
        }
      }, '+ \u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043a\u0430\u0440\u0442\u0443')
    )
  );
}
