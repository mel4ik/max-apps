import React, { useState } from 'react';
import { Box, BackBtn } from '../components/Shared';
import { fk, sd } from '../api/helpers';

export default function BuyService({ card: c, onBack, onPay }) {
  const [sel, setSel] = useState(null);
  const svc = c.svcs?.find(x => x.sid === sel) || null;

  return (
    <div style={{ padding:'10px 14px 16px' }}>
      <BackBtn onClick={onBack} />
      <Box>
        <h2 style={{ fontSize:17, fontWeight:800, margin:'0 0 4px' }}>Купить услугу</h2>
        <p style={{ fontSize:11, color:'#9CA3AF', margin:'0 0 12px' }}>•••• {c.n.slice(-4)}</p>

        {(c.svcs || []).map(x => (
          <button key={x.sid} onClick={() => setSel(x.sid)} style={{
            display:'flex', alignItems:'center', width:'100%',
            padding:12,
            background: sel===x.sid ? '#F9F5FF' : '#F8F9FC',
            border: sel===x.sid ? '2px solid #7C3AED' : '2px solid transparent',
            borderRadius:12, cursor:'pointer', fontFamily:'inherit',
            textAlign:'left', marginBottom:6
          }}>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:14, fontWeight:700, margin:'0 0 2px' }}>{x.txt}</p>
              <p style={{ fontSize:11, color:'#6B7280', margin:0 }}>
                {sd(x.sd)} – {sd(x.ed)} · {x.iA}{x.iL==='M' ? ' мес.' : ' дн.'}
              </p>
            </div>
            <p style={{ fontSize:16, fontWeight:800, color:'#7C3AED', margin:0, flexShrink:0 }}>
              {fk(x.cost)} ₽
            </p>
          </button>
        ))}

        {svc && (
          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            background:'#F9F5FF', borderRadius:12, padding:'12px 14px',
            marginTop:8, border:'1px solid #E9D5FF'
          }}>
            <span style={{ fontSize:14, fontWeight:600 }}>К оплате</span>
            <span style={{ fontSize:20, fontWeight:800, color:'#7C3AED' }}>{fk(svc.cost)} ₽</span>
          </div>
        )}

        {svc && (
          <button onClick={() => onPay(Math.round(svc.cost/100), svc)} style={{
            width:'100%', padding:14, fontSize:14, fontWeight:700,
            fontFamily:'inherit', color:'#fff',
            background:'linear-gradient(135deg,#7C3AED,#5B21B6)',
            border:'none', borderRadius:12, cursor:'pointer', marginTop:10
          }}>
            Оплатить {fk(svc.cost)} ₽
          </button>
        )}
      </Box>
    </div>
  );
}
