import React, { useState, useEffect } from 'react';
import { Box, BackBtn } from '../components/Shared';
import { fk, sd } from '../api/helpers';
import * as api from '../api/client';

export default function BuyService({ card: c, onBack, onPay }) {
  var _ops = useState(null); var ops = _ops[0]; var setOps = _ops[1];
  var _loading = useState(true); var loading = _loading[0]; var setLoading = _loading[1];
  var _selected = useState(null); var selected = _selected[0]; var setSelected = _selected[1];
  var _paying = useState(false); var paying = _paying[0]; var setPaying = _paying[1];
  var _err = useState(''); var err = _err[0]; var setErr = _err[1];

  useEffect(function() {
    setLoading(true);
    api.getOperations(c.id).then(function(data) { setOps(data); })
      .catch(function(e) { setErr(e.message); })
      .finally(function() { setLoading(false); });
  }, [c.id]);

  if (loading) {
    return React.createElement('div', { style: { padding:'10px 14px 16px' } },
      React.createElement(BackBtn, { onClick: onBack }),
      React.createElement(Box, null,
        React.createElement('div', { style: { textAlign:'center', padding:'32px 0' } },
          React.createElement('div', { style: { width:24, height:24, border:'2px solid #E5E7EB', borderTopColor:'#7C3AED', borderRadius:'50%', margin:'0 auto', animation:'spin 0.6s linear infinite' } })
        )
      )
    );
  }

  var sp = ops && ops.servicePurchase;
  if (!sp || !sp.allowed || !sp.services || sp.services.length === 0) {
    var reason = sp && sp.denyReason ? sp.denyReason.description : 'Покупка услуг недоступна';
    return React.createElement('div', { style: { padding:'10px 14px 16px' } },
      React.createElement(BackBtn, { onClick: onBack }),
      React.createElement(Box, null,
        React.createElement('p', { style: { fontSize:14, fontWeight:600, color:'#F04438', textAlign:'center', padding:'20px 0' } }, '🚫 ', reason)
      )
    );
  }

  var services = sp.services;
  var sel = selected ? services.find(function(s) { return s.serviceId === selected; }) : null;

  function handlePay() {
    if (!sel || paying) return;
    setPaying(true);
    setErr('');
    api.createPurchase(c.id, sel.serviceId, 0).then(function(res) {
      if (res.payment_url) {
        if (window.WebApp && window.WebApp.openLink) {
          window.WebApp.openLink(res.payment_url);
        } else {
          window.open(res.payment_url, '_blank');
        }
        onPay(Math.round(sel.cost / 100), res.invoice_id);
      }
    }).catch(function(e) {
      setErr(e.message);
      setPaying(false);
    });
  }

  return React.createElement('div', { style: { padding:'10px 14px 16px' } },
    React.createElement(BackBtn, { onClick: onBack }),
    React.createElement(Box, null,
      React.createElement('h2', { style: { fontSize:17, fontWeight:800, margin:'0 0 4px' } }, 'Покупка услуги'),
      React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:'0 0 12px' } },
        '•••• ', (c.card_pan || '').slice(-4)
      ),

      services.map(function(svc) {
        var isSelected = selected === svc.serviceId;
        var ar = svc.actionRange || {};
        var desc = svc.description || {};
        return React.createElement('button', {
          key: svc.serviceId,
          onClick: function() { setSelected(svc.serviceId); },
          style: {
            display:'flex', alignItems:'center', width:'100%', padding:12,
            background: isSelected ? '#F9F5FF' : '#F8F9FC',
            border: isSelected ? '2px solid #7C3AED' : '2px solid transparent',
            borderRadius:12, cursor:'pointer', fontFamily:'inherit', textAlign:'left', marginBottom:6
          }
        },
          React.createElement('div', { style: { flex:1 } },
            React.createElement('p', { style: { fontSize:14, fontWeight:700, margin:'0 0 2px' } }, desc.textNote || 'Услуга'),
            React.createElement('p', { style: { fontSize:11, color:'#6B7280', margin:0 } },
              sd(ar.startDate), ' – ', sd(ar.endDate),
              desc.intervalAmount ? ' · ' + desc.intervalAmount + (desc.intervalLength === 'M' ? ' мес.' : ' дн.') : ''
            )
          ),
          React.createElement('p', { style: { fontSize:16, fontWeight:800, color:'#7C3AED', margin:0, flexShrink:0 } }, fk(svc.cost), ' ₽')
        );
      }),

      err && React.createElement('p', { style: { fontSize:12, color:'#F04438', margin:'8px 0 0', fontWeight:600 } }, '⚠ ', err),

      sel && React.createElement('button', { onClick: handlePay, disabled: paying, style: {
        width:'100%', padding:14, fontSize:14, fontWeight:700, fontFamily:'inherit',
        color:'#fff', background:'linear-gradient(135deg,#7C3AED,#5B21B6)',
        border:'none', borderRadius:12, cursor:'pointer', marginTop:10,
        opacity: paying ? 0.5 : 1
      } }, paying ? 'Создаём платёж...' : 'Оплатить ' + fk(sel.cost) + ' ₽')
    )
  );
}
