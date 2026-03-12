import React, { useState } from 'react';
import { Box, BackBtn } from '../components/Shared';
import * as api from '../api/client';

const METHODS = [
  { id:'card', icon:'💳', name:'Банковская карта', sub:'Visa, Mastercard, Мир' },
  { id:'sbp',  icon:'⚡', name:'СБП', sub:'Система быстрых платежей' },
  { id:'sber', icon:'🟢', name:'SberPay', sub:'Оплата через Сбер' },
  { id:'tpay', icon:'🟡', name:'T-Pay', sub:'Оплата через Т-Банк' },
];

export default function YooKassa({ card: c, amt, svc, onBack, onDone, bridge }) {
  const [phase, setPhase]   = useState('widget'); // widget | processing | done
  const [method, setMethod] = useState(null);

  async function pay() {
    if (!method) return;
    bridge.haptic('medium');
    setPhase('processing');

    try {
      const result = await api.createInvoice(c.id, amt * 100, svc?.sid);
      // Если бэкенд вернул ссылку на оплату — открываем
      if (result.payment_url) {
        window.WebApp?.openLink(result.payment_url);
      }
      // Имитация успеха (в проде — вебхук / polling)
      setTimeout(() => {
        setPhase('done');
        bridge.success();
        setTimeout(onDone, 1200);
      }, 2000);
    } catch {
      bridge.error();
      setPhase('widget');
    }
  }

  return (
    <div style={{ padding:'10px 14px 16px' }}>
      <BackBtn onClick={onBack} />

      <div style={{ textAlign:'center', marginBottom:10 }}>
        <p style={{ fontSize:12, color:'#9CA3AF', margin:'0 0 2px' }}>Оплата через</p>
        <p style={{ fontSize:20, fontWeight:800, color:'#0055FF', margin:'0 0 2px' }}>ЮKassa</p>
        <p style={{ fontSize:12, color:'#9CA3AF', margin:0 }}>
          {svc ? svc.txt : 'Пополнение'} · {amt} ₽
        </p>
      </div>

      {phase === 'widget' && (
        <Box>
          <p style={{ fontSize:14, fontWeight:700, margin:'0 0 10px' }}>Способ оплаты</p>
          {METHODS.map(m => (
            <button key={m.id} onClick={() => setMethod(m.id)} style={{
              display:'flex', alignItems:'center', gap:10, width:'100%',
              padding:'11px 12px',
              background: method===m.id ? '#E8F0FE' : '#F8F9FC',
              border: method===m.id ? '2px solid #1B6EF3' : '2px solid transparent',
              borderRadius:12, cursor:'pointer', fontFamily:'inherit',
              textAlign:'left', marginBottom:5
            }}>
              <span style={{ fontSize:20 }}>{m.icon}</span>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:13, fontWeight:600, margin:'0 0 1px' }}>{m.name}</p>
                <p style={{ fontSize:10, color:'#9CA3AF', margin:0 }}>{m.sub}</p>
              </div>
              {method===m.id && <span style={{ color:'#1B6EF3', fontSize:16, fontWeight:700 }}>✓</span>}
            </button>
          ))}

          {method === 'card' && (
            <div style={{ marginTop:10, padding:12, background:'#F8F9FC', borderRadius:12 }}>
              <p style={{ fontSize:10, fontWeight:700, color:'#6B7280', margin:'0 0 6px' }}>НОМЕР КАРТЫ</p>
              <div style={{ padding:'10px 12px', background:'#fff', border:'1.5px solid #E5E7EB', borderRadius:8, fontSize:14, fontWeight:600, marginBottom:8, letterSpacing:1 }}>
                4276 •••• •••• 1234
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:10, fontWeight:700, color:'#6B7280', margin:'0 0 4px' }}>СРОК</p>
                  <div style={{ padding:'10px 12px', background:'#fff', border:'1.5px solid #E5E7EB', borderRadius:8, fontSize:14, fontWeight:600 }}>12/28</div>
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:10, fontWeight:700, color:'#6B7280', margin:'0 0 4px' }}>CVC</p>
                  <div style={{ padding:'10px 12px', background:'#fff', border:'1.5px solid #E5E7EB', borderRadius:8, fontSize:14, fontWeight:600 }}>•••</div>
                </div>
              </div>
            </div>
          )}

          <button onClick={pay} disabled={!method} style={{
            width:'100%', padding:14, fontSize:14, fontWeight:700,
            fontFamily:'inherit', color:'#fff',
            background:'linear-gradient(135deg,#0055FF,#003EBB)',
            border:'none', borderRadius:12, cursor:'pointer', marginTop:12,
            opacity: method ? 1 : 0.4
          }}>
            Оплатить {amt} ₽
          </button>
        </Box>
      )}

      {phase === 'processing' && (
        <Box>
          <div style={{ padding:'32px 20px', textAlign:'center' }}>
            <div style={{ width:40, height:40, border:'3px solid #E5E7EB', borderTopColor:'#0055FF', borderRadius:'50%', margin:'0 auto 16px', animation:'spin 0.6s linear infinite' }} />
            <p style={{ fontSize:16, fontWeight:700, margin:'0 0 4px' }}>Обработка...</p>
            <p style={{ fontSize:12, color:'#9CA3AF', margin:0 }}>Не закрывайте</p>
          </div>
        </Box>
      )}

      {phase === 'done' && (
        <Box>
          <div style={{ padding:'24px 20px', textAlign:'center' }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'#E5FBF0', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', fontSize:28 }}>✅</div>
            <p style={{ fontSize:16, fontWeight:800, margin:0 }}>Оплата прошла!</p>
          </div>
        </Box>
      )}
    </div>
  );
}
