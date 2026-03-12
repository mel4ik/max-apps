import React, { useState } from 'react';
import { Box, BackBtn } from '../components/Shared';
import { fkNum } from '../api/helpers';

export default function TopUp({ card: c, onBack, onPay }) {
  const [s, setS] = useState(500);
  const mn = fkNum(c.replMin || 100000);
  const mx = fkNum(c.replMax || 20100000);
  const ok = s >= mn && s <= mx;

  return (
    <div style={{ padding:'10px 14px 16px' }}>
      <BackBtn onClick={onBack} />
      <Box>
        <h2 style={{ fontSize:17, fontWeight:800, margin:'0 0 4px' }}>Пополнение</h2>
        <p style={{ fontSize:11, color:'#9CA3AF', margin:'0 0 12px' }}>
          •••• {c.n.slice(-4)} · {mn}–{mx} ₽
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:12 }}>
          {[100,200,500,1000,1500,2000].map(a => (
            <button key={a} onClick={() => setS(a)} style={{
              padding:'10px 0', fontSize:14, fontWeight:700,
              fontFamily:'inherit',
              background: s===a ? '#FF6B00' : '#F0F2F8',
              color: s===a ? '#fff' : '#0F1729',
              border:'none', borderRadius:8, cursor:'pointer'
            }}>{a} ₽</button>
          ))}
        </div>
        <button onClick={() => { if (ok) onPay(s); }} style={{
          width:'100%', padding:14, fontSize:14, fontWeight:700,
          fontFamily:'inherit', color:'#fff',
          background:'linear-gradient(135deg,#FF6B00,#E85D00)',
          border:'none', borderRadius:12, cursor:'pointer',
          opacity: ok ? 1 : 0.4
        }}>
          Оплатить {s} ₽
        </button>
        <p style={{ textAlign:'center', fontSize:10, color:'#9CA3AF', marginTop:6 }}>
          ЮKassa · карта, СБП, SberPay, T-Pay
        </p>
      </Box>
    </div>
  );
}
