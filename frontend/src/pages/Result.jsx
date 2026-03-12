import React from 'react';
import { Box } from '../components/Shared';
import { sd } from '../api/helpers';

export default function Result({ card: c, amt, svc, onDone }) {
  return (
    <div style={{ padding:'10px 14px 16px' }}>
      <Box>
        <div style={{ textAlign:'center', padding:'12px 0' }}>
          <div style={{
            width:64, height:64, borderRadius:'50%', background:'#E5FBF0',
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 14px', fontSize:32
          }}>✅</div>
          <h2 style={{ fontSize:18, fontWeight:800, margin:'0 0 4px' }}>
            {svc ? 'Услуга подключена!' : 'Баланс пополнен!'}
          </h2>
          <p style={{ fontSize:12, color:'#6B7280', margin:'0 0 16px' }}>
            {svc
              ? `${svc.txt} · ${sd(svc.sd)} – ${sd(svc.ed)}`
              : `+${amt} ₽ на карту`
            }
          </p>
          <p style={{ fontSize:11, color:'#9CA3AF', margin:'0 0 14px' }}>
            •••• {c.n.slice(-4)} · {c.region}
          </p>
          <button onClick={onDone} style={{
            width:'100%', padding:14, fontSize:14, fontWeight:700,
            fontFamily:'inherit', color:'#fff', background:'#1B6EF3',
            border:'none', borderRadius:12, cursor:'pointer'
          }}>
            Готово
          </button>
        </div>
      </Box>
    </div>
  );
}
