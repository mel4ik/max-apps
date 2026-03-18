import React, { useState, useEffect, useRef } from 'react';
import { Box, BackBtn } from '../components/Shared';
import { fk } from '../api/helpers';
import * as api from '../api/client';

export default function YooKassa({ card: c, amt, svc, onBack, onDone, bridge }) {
  var invoiceId = svc; // svc теперь передаёт invoice_id
  var _status = useState('waiting'); var status = _status[0]; var setStatus = _status[1];
  var _data = useState(null); var data = _data[0]; var setData = _data[1];
  var intervalRef = useRef(null);

  // Polling статуса каждые 3 сек
  useEffect(function() {
    if (!invoiceId) return;

    function check() {
      api.checkInvoiceStatus(invoiceId).then(function(res) {
        setData(res);
        if (res.status === 'PAID') {
          setStatus('done');
          bridge.success();
          clearInterval(intervalRef.current);
        } else if (res.status === 'CANCELED' || res.status === 'FAILED') {
          setStatus('failed');
          bridge.error();
          clearInterval(intervalRef.current);
        }
      }).catch(function() {});
    }

    check();
    intervalRef.current = setInterval(check, 3000);

    return function() { clearInterval(intervalRef.current); };
  }, [invoiceId]);

  // Успех
  if (status === 'done') {
    return React.createElement('div', { style: { padding:'10px 14px 16px' } },
      React.createElement(Box, null,
        React.createElement('div', { style: { textAlign:'center', padding:'20px 0' } },
          React.createElement('div', { style: { width:64, height:64, borderRadius:'50%', background:'#E5FBF0', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:32 } }, '✅'),
          React.createElement('h2', { style: { fontSize:18, fontWeight:800, margin:'0 0 4px' } }, 'Оплата прошла!'),
          React.createElement('p', { style: { fontSize:14, color:'#6B7280', margin:'0 0 4px' } }, '+', amt, ' ₽'),
          React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:'0 0 16px' } }, '•••• ', (c.card_pan || '').slice(-4)),
          React.createElement('button', { onClick: onDone, style: {
            width:'100%', padding:14, fontSize:14, fontWeight:700, fontFamily:'inherit',
            color:'#fff', background:'#1B6EF3', border:'none', borderRadius:12, cursor:'pointer'
          } }, 'Готово')
        )
      )
    );
  }

  // Ошибка
  if (status === 'failed') {
    return React.createElement('div', { style: { padding:'10px 14px 16px' } },
      React.createElement(BackBtn, { onClick: onBack }),
      React.createElement(Box, null,
        React.createElement('div', { style: { textAlign:'center', padding:'20px 0' } },
          React.createElement('div', { style: { width:64, height:64, borderRadius:'50%', background:'#FEE4E2', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:32 } }, '❌'),
          React.createElement('h2', { style: { fontSize:18, fontWeight:800, margin:'0 0 4px' } }, 'Оплата не прошла'),
          React.createElement('p', { style: { fontSize:12, color:'#9CA3AF', margin:'0 0 16px' } },
            data && data.error_message ? data.error_message : 'Попробуйте ещё раз'
          ),
          React.createElement('button', { onClick: onBack, style: {
            width:'100%', padding:14, fontSize:14, fontWeight:700, fontFamily:'inherit',
            color:'#1B6EF3', background:'#E8F0FE', border:'none', borderRadius:12, cursor:'pointer'
          } }, 'Назад')
        )
      )
    );
  }

  // Ожидание
  return React.createElement('div', { style: { padding:'10px 14px 16px' } },
    React.createElement(Box, null,
      React.createElement('div', { style: { textAlign:'center', padding:'32px 0' } },
        React.createElement('div', { style: { width:40, height:40, border:'3px solid #E5E7EB', borderTopColor:'#0055FF', borderRadius:'50%', margin:'0 auto 16px', animation:'spin 0.6s linear infinite' } }),
        React.createElement('h2', { style: { fontSize:16, fontWeight:700, margin:'0 0 4px' } }, 'Ожидаем оплату'),
        React.createElement('p', { style: { fontSize:14, color:'#6B7280', margin:'0 0 4px' } }, amt, ' ₽'),
        React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:'0 0 16px' } }, 'Завершите оплату в открывшемся окне'),
        React.createElement('button', { onClick: onBack, style: {
          padding:'10px 20px', fontSize:12, fontWeight:600, fontFamily:'inherit',
          color:'#9CA3AF', background:'transparent', border:'1px solid #E5E7EB',
          borderRadius:8, cursor:'pointer'
        } }, 'Отменить')
      )
    )
  );
}
