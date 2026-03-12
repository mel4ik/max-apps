import React from 'react';
import { fk, sd } from '../api/helpers';

export default function CardList({ cards, loading, error, onRefresh, onSelect, onAdd }) {
  return React.createElement('div', null,
    React.createElement('div', { style: { padding:'14px 16px 18px', background:'linear-gradient(135deg,#0F1729,#1A2744)', borderRadius:'0 0 22px 22px', position:'relative', overflow:'hidden', marginBottom:-4 } },
      React.createElement('div', { style: { position:'absolute', right:-30, top:-30, width:120, height:120, borderRadius:'50%', background:'rgba(27,110,243,0.1)' } }),
      React.createElement('h1', { style: { fontSize:23, fontWeight:800, color:'#fff', display:'flex', alignItems:'center', gap:8, margin:0, position:'relative', zIndex:1 } }, '🚌', ' Часпик'),
      React.createElement('p', { style: { fontSize:10, fontWeight:500, color:'rgba(255,255,255,0.4)', marginTop:3, position:'relative', zIndex:1 } }, 'Транспорт Lite')
    ),
    React.createElement('div', { style: { padding:'10px 14px 16px' } },
      loading && React.createElement('div', { style: { textAlign:'center', padding:'40px 0' } },
        React.createElement('div', { style: { width:32, height:32, border:'3px solid #E5E7EB', borderTopColor:'#1B6EF3', borderRadius:'50%', margin:'0 auto 12px', animation:'spin 0.6s linear infinite' } }),
        React.createElement('p', { style: { fontSize:13, color:'#9CA3AF' } }, 'Загрузка карт...')
      ),
      error && !loading && React.createElement('div', { style: { textAlign:'center', padding:'32px 0' } },
        React.createElement('p', { style: { fontSize:14, fontWeight:600, marginBottom:8 } }, '⚠️ ', error),
        React.createElement('button', { onClick: onRefresh, style: { padding:'10px 20px', fontSize:13, fontWeight:600, fontFamily:'inherit', color:'#1B6EF3', background:'#E8F0FE', border:'none', borderRadius:10, cursor:'pointer' } }, 'Попробовать снова')
      ),
      !loading && !error && cards.map(function(c) {
        var p = c.parsed || {};
        var cfg = p.cfg || {};
        var cl = cfg.color || '#999';

        // Правая часть — зависит от типа
        var rightContent = null;

        if (cfg.showBalance && p.bal > 0) {
          rightContent = React.createElement('p', { style: { fontSize:16, fontWeight:700, margin:0 } }, fk(p.bal), ' ₽');
        } else if (cfg.showTrips && p.trips > 0) {
          rightContent = React.createElement('p', { style: { fontSize:16, fontWeight:700, margin:0, color:cl } }, p.trips, ' поездок');
        } else if (p.kind === 'abonement') {
          if (p.hasActiveAbonement && p.abEnd) {
            rightContent = React.createElement('p', { style: { fontSize:12, fontWeight:700, margin:0, color:cl } }, 'до ', sd(p.abEnd));
          } else {
            rightContent = React.createElement('p', { style: { fontSize:11, fontWeight:600, margin:0, color:'#9CA3AF' } }, 'Нет активных услуг');
          }
        } else if (cfg.showBalance) {
          rightContent = React.createElement('p', { style: { fontSize:16, fontWeight:700, margin:0 } }, '0 ₽');
        }

        return React.createElement('button', { key: c.id, onClick: function() { onSelect(c); }, style: { display:'flex', alignItems:'center', gap:10, width:'100%', padding:'12px 13px', background:'#fff', border:'none', borderRadius:14, marginBottom:7, cursor:'pointer', fontFamily:'inherit', textAlign:'left', boxShadow:'0 1px 3px rgba(15,23,41,0.04),0 4px 12px rgba(15,23,41,0.06)' } },
          React.createElement('div', { style: { width:40, height:40, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, flexShrink:0, background:'linear-gradient(135deg,'+cl+','+cl+'88)' } }, cfg.icon || '💳'),
          React.createElement('div', { style: { flex:1, minWidth:0 } },
            React.createElement('p', { style: { fontSize:14, fontWeight:600, margin:'0 0 2px' } }, p.label || c.ticket_description || 'ЕТК'),
            React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:0 } }, c.region || '')
          ),
          React.createElement('div', { style: { textAlign:'right', flexShrink:0 } }, rightContent),
          React.createElement('span', { style: { fontSize:20, color:'#D1D5DB', fontWeight:300 } }, '›')
        );
      }),
      !loading && !error && React.createElement('button', { onClick: onAdd, style: { display:'flex', alignItems:'center', justifyContent:'center', gap:7, width:'100%', padding:13, fontSize:14, fontWeight:600, fontFamily:'inherit', color:'#1B6EF3', background:'#fff', border:'2px dashed #E5E7EB', borderRadius:14, cursor:'pointer', marginTop:2 } }, '+ Добавить карту')
    )
  );
}
