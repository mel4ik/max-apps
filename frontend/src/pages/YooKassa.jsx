import React, { useState, useEffect, useRef } from 'react';
import { Box } from '../components/Shared';
import * as api from '../api/client';

export default function YooKassa({ card, amt, svc, onBack, onDone, bridge }) {
  var invoiceId = svc;
  var pan = card.card_pan || '';
  var panFmt = pan.replace(/(.{4})/g, '$1 ').trim();
  var region = card.region || '';
  var _status = useState('widget'); var status = _status[0]; var setStatus = _status[1];
  var _err = useState(''); var err = _err[0]; var setErr = _err[1];
  var widgetRef = useRef(null);
  var checkRef = useRef(null);

  useEffect(function() {
    if (!invoiceId) return;

    function startPolling() {
      checkRef.current = setInterval(function() {
        api.checkInvoiceStatus(invoiceId).then(function(res) {
          if (res.status === 'PAID') {
            setStatus('done');
            bridge.success();
            clearInterval(checkRef.current);
          } else if (res.status === 'CANCELED' || res.status === 'FAILED') {
            setStatus('failed');
            setErr(res.error_message || 'Оплата не прошла');
            bridge.error();
            clearInterval(checkRef.current);
          }
        }).catch(function() {});
      }, 3000);
    }

    var token = window._ykToken;
    if (token && window.YooMoneyCheckoutWidget) {
      try {
        var checkout = new window.YooMoneyCheckoutWidget({
          confirmation_token: token,
          return_url: window.location.origin,
          customization: {
            modal: false,
            colors: {
              control_primary: '#FF6B00'
            }
          },
          error_callback: function() {
            setErr('Ошибка оплаты');
            setStatus('failed');
            bridge.error();
          }
        });
        checkout.render('yk-widget-container').then(function() {
          startPolling();
        });
        widgetRef.current = checkout;
      } catch (e) {
        setErr('Не удалось загрузить форму оплаты');
        setStatus('failed');
      }
    } else {
      startPolling();
    }

    return function() {
      clearInterval(checkRef.current);
      if (widgetRef.current && widgetRef.current.destroy) {
        try { widgetRef.current.destroy(); } catch(e) {}
      }
    };
  }, [invoiceId]);

  if (status === 'done') {
    return React.createElement('div', { style: { padding:'10px 14px 16px' } },
      React.createElement(Box, null,
        React.createElement('div', { style: { textAlign:'center', padding:'20px 0' } },
          React.createElement('div', { style: { width:64, height:64, borderRadius:'50%', background:'#E5FBF0', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:32 } }, '\u2705'),
          React.createElement('h2', { style: { fontSize:18, fontWeight:800, margin:'0 0 6px' } }, 'Оплата прошла!'),
          React.createElement('p', { style: { fontSize:16, fontWeight:700, color:'#00A651', margin:'0 0 8px' } }, '+', amt, ' \u20bd'),
          React.createElement('p', { style: { fontSize:13, fontWeight:600, margin:'0 0 4px' } }, panFmt),
          React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:'0 0 16px' } }, region),
          React.createElement('button', { onClick: onDone, style: {
            width:'100%', padding:14, fontSize:14, fontWeight:700, fontFamily:'inherit',
            color:'#fff', background:'#1B6EF3', border:'none', borderRadius:12, cursor:'pointer'
          } }, 'Готово')
        )
      )
    );
  }

  if (status === 'failed') {
    return React.createElement('div', { style: { padding:'10px 14px 16px' } },
      React.createElement(Box, null,
        React.createElement('div', { style: { textAlign:'center', padding:'20px 0' } },
          React.createElement('div', { style: { width:64, height:64, borderRadius:'50%', background:'#FEE4E2', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:32 } }, '\u274C'),
          React.createElement('h2', { style: { fontSize:18, fontWeight:800, margin:'0 0 4px' } }, 'Оплата не прошла'),
          React.createElement('p', { style: { fontSize:12, color:'#9CA3AF', margin:'0 0 16px' } }, err || 'Попробуйте ещё раз'),
          React.createElement('button', { onClick: onBack, style: {
            width:'100%', padding:14, fontSize:14, fontWeight:700, fontFamily:'inherit',
            color:'#1B6EF3', background:'#E8F0FE', border:'none', borderRadius:12, cursor:'pointer'
          } }, 'Назад')
        )
      )
    );
  }

  return React.createElement('div', { style: { padding:'10px 14px 16px' } },
    React.createElement('div', { style: { textAlign:'center', marginBottom:12 } },
      React.createElement('p', { style: { fontSize:12, color:'#9CA3AF', margin:'0 0 2px' } }, 'К оплате'),
      React.createElement('p', { style: { fontSize:24, fontWeight:800, margin:'0 0 4px' } }, amt, ' \u20bd'),
      React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:0 } }, panFmt)
    ),
    React.createElement('div', {
      id: 'yk-widget-container',
      style: { minHeight:300, background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }
    }),
    React.createElement('p', { style: { textAlign:'center', fontSize:10, color:'#9CA3AF', marginTop:8 } },
      '\u042eKassa \u00b7 Безопасная оплата'
    )
  );
}
