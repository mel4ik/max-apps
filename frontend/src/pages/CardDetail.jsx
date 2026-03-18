import React, { useState, useEffect } from 'react';
import { Box, BackBtn } from '../components/Shared';
import { fk, sd, ft } from '../api/helpers';
import * as api from '../api/client';
import DeleteCardBtn from '../components/DeleteCardBtn';

export default function CardDetail({ card: c, onBack, onTopUp, onBuyService, bridge }) {
  var p = c.parsed || {};
  var cfg = p.cfg || {};
  var cl = cfg.color || '#999';
  var pan = c.card_pan || '';
  var canPay = p.canPay !== false;
  var payType = cfg.payType || 'none';

  var daysLeft = p.abEnd ? Math.max(0, Math.ceil((new Date(p.abEnd) - new Date()) / 86400000)) : 0;

  var _t = useState([]); var trips = _t[0]; var setTrips = _t[1];
  var _r = useState([]); var repls = _r[0]; var setRepls = _r[1];
  var _l = useState(true); var opsLoading = _l[0]; var setOpsLoading = _l[1];

  useEffect(function() {
    setOpsLoading(true);
    Promise.all([
      api.getTrips(c.id).catch(function() { return { data:[] }; }),
      api.getReplenishments(c.id).catch(function() { return { data:[] }; }),
    ]).then(function(res) {
      setTrips(res[0].data || []);
      setRepls(res[1].data || []);
    }).finally(function() { setOpsLoading(false); });
  }, [c.id]);

  function handlePay() {
    bridge.haptic('medium');
    if (payType === 'replenish') onTopUp();
    else onBuyService();
  }

  return React.createElement('div', { style: { padding:'10px 14px 16px' } },
    

    // Градиентная карта
    React.createElement('div', { style: { position:'relative', borderRadius:18, padding:'20px 16px', marginBottom:10, overflow:'hidden', boxShadow:'0 8px 28px '+cl+'44', background:'linear-gradient(135deg,'+cl+','+cl+'CC,'+cl+'77)' } },
      React.createElement('div', { style: { position:'absolute', top:-35, right:-35, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.1)' } }),

      // Заголовок + статус
      React.createElement('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative', marginBottom:6 } },
        React.createElement('p', { style: { fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.6)', textTransform:'uppercase', letterSpacing:2, margin:0 } }, p.label || 'ЕТК'),
        React.createElement('span', { style: { fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'rgba(255,255,255,0.15)', color:'#fff' } }, p.stop ? '⛔ Стоп-лист' : '✓ Активна')
      ),

      // Номер + регион
      React.createElement('p', { style: { fontSize:14, fontWeight:700, color:'#fff', letterSpacing:1.5, margin:'0 0 2px', position:'relative' } }, pan.replace(/(.{4})/g, '$1 ').trim()),
      React.createElement('p', { style: { fontSize:11, color:'rgba(255,255,255,0.5)', margin:'0 0 14px', position:'relative' } }, '📍 ', c.region || '—'),

      // БАЛАНС
      cfg.showBalance && React.createElement('div', { style: { position:'relative', marginBottom: cfg.showTrips ? 10 : 0 } },
        React.createElement('p', { style: { fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:1, margin:'0 0 3px' } }, 'Баланс'),
        React.createElement('p', { style: { fontSize:32, fontWeight:800, color:'#fff', margin:0 } }, fk(p.bal), React.createElement('span', { style: { fontSize:18, fontWeight:600, opacity:0.7 } }, ' ₽'))
      ),

      // ПОЕЗДКИ
      cfg.showTrips && p.trips > 0 && React.createElement('div', { style: { position:'relative', marginBottom:4 } },
        React.createElement('p', { style: { fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:1, margin:'0 0 3px' } }, 'Остаток поездок'),
        React.createElement('p', { style: { fontSize: cfg.showBalance ? 25 : 32, fontWeight:800, color:'#fff', margin:0 } }, p.trips),
        p.tripsEnd && React.createElement('p', { style: { fontSize:11, color:'rgba(255,255,255,0.55)', margin:'6px 0 0' } }, 'Действует до ', sd(p.tripsEnd))
      ),

      // АБОНЕМЕНТ — из extra_services.abonement
      cfg.showDates && p.kind === 'abonement' && (
        p.hasActiveAbonement
          ? React.createElement('div', { style: { position:'relative' } },
              React.createElement('p', { style: { fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:1, margin:'0 0 3px' } }, 'Срок действия'),
              React.createElement('p', { style: { fontSize:26, fontWeight:800, color:'#fff', margin:0 } }, 'C ', sd(p.abStart), ' по ', sd(p.abEnd)),
              daysLeft > 0 && React.createElement('p', { style: { fontSize:12, color:'rgba(255,255,255,0.6)', margin:'6px 0 0' } }, 'Осталось ', daysLeft, ' дн.'),
              p.abDesc && React.createElement('p', { style: { fontSize:11, color:'rgba(255,255,255,0.55)', margin:'6px 0 0' } }, p.abDesc)
            )
          : React.createElement('div', { style: { position:'relative' } },
              React.createElement('p', { style: { fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.7)', margin:0 } }, 'Нет активных услуг')
            )
      ),

      // SOCIAL — даты поездок
      cfg.showDates && p.kind === 'social' && p.tripsEnd && React.createElement('p', { style: { fontSize:11, color:'rgba(255,255,255,0.55)', margin:'6px 0 0', position:'relative' } }, 'Действует до ', sd(p.tripsEnd)),

      p.stale && React.createElement('p', { style: { fontSize:10, color:'rgba(255,255,255,0.4)', margin:'8px 0 0', fontStyle:'italic' } }, '⚡ Кэш (', p.source, ')')
    ),

    // Кнопки
    React.createElement('div', { style: { display:'flex', gap:8, marginBottom:10 } },
      canPay && payType !== 'none' && React.createElement('button', { onClick: handlePay, style: { flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5, padding:13, fontSize:13, fontWeight:700, fontFamily:'inherit', color:'#fff', background:'#FF6B00', border:'none', borderRadius:12, cursor:'pointer' } }, '↑ Пополнить'),
      !canPay && React.createElement('div', { style: { flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:13, fontSize:12, fontWeight:600, color:'#9CA3AF', background:'#F0F2F8', borderRadius:12 } }, '🚫 Пополнение запрещено'),
      React.createElement('button', { onClick: function() { bridge.haptic(); api.getCardInfo(c.id, true).catch(function(){}); }, style: { width:48, display:'flex', alignItems:'center', justifyContent:'center', padding:13, fontSize:16, fontFamily:'inherit', color:'#0F1729', background:'#fff', border:'1.5px solid #E5E7EB', borderRadius:12, cursor:'pointer' } }, '↻')
    ),

    // Удаление
    React.createElement(DeleteCardBtn, { cardId: c.id, onDeleted: onBack, bridge: bridge }),

    // Операции
    React.createElement(Box, null,
      React.createElement('h3', { style: { fontSize:14, fontWeight:700, margin:'0 0 8px' } }, 'Последние операции'),

      opsLoading && React.createElement('div', { style: { textAlign:'center', padding:'16px 0' } },
        React.createElement('div', { style: { width:20, height:20, border:'2px solid #E5E7EB', borderTopColor:'#1B6EF3', borderRadius:'50%', margin:'0 auto', animation:'spin 0.6s linear infinite' } })
      ),

      !opsLoading && repls.map(function(r, i) {
        return React.createElement('div', { key:'r'+i, style: { display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid #F0F2F8' } },
          React.createElement('div', { style: { width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'#E5FBF0' } },
            React.createElement('span', { style: { color:'#00D26A', fontWeight:700, fontSize:13 } }, '↑')
          ),
          React.createElement('div', { style: { flex:1 } },
            React.createElement('p', { style: { fontSize:13, fontWeight:600, margin:'0 0 1px' } }, api.translateOp(r.type_operation)),
            React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:0 } }, ft(r.replenishment_date))
          ),
          React.createElement('p', { style: { fontSize:14, fontWeight:700, color: r.replenishment_sum > 0 ? '#00D26A' : '#9CA3AF', margin:0 } },
            r.replenishment_sum > 0 ? '+' + fk(r.replenishment_sum) + ' ₽' : '0 ₽'
          )
        );
      }),

      !opsLoading && trips.map(function(t, i) {
        return React.createElement('div', { key:'t'+i, style: { display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid #F0F2F8' } },
          React.createElement('div', { style: { width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'#E8F0FE' } },
            React.createElement('span', { style: { color:'#1B6EF3', fontWeight:700, fontSize:13 } }, '↓')
          ),
          React.createElement('div', { style: { flex:1 } },
            React.createElement('p', { style: { fontSize:13, fontWeight:600, margin:'0 0 1px' } }, t.route_name || 'Поездка'),
            React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:0 } }, ft(t.pass_date || t.trip_date))
          ),
          React.createElement('p', { style: { fontSize:14, fontWeight:700, margin:0 } }, '−', fk(t.pass_sum || t.sum_amount || 0), ' ₽')
        );
      }),

      !opsLoading && !repls.length && !trips.length && React.createElement('p', { style: { fontSize:12, color:'#9CA3AF', textAlign:'center', padding:'16px 0' } }, 'Нет операций')
    )
  );
}
