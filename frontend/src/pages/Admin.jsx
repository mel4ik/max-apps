import React, { useState, useEffect } from 'react';
import { BackBtn } from '../components/Shared';
import { fk, STATUS_COLORS } from '../api/helpers';
import * as api from '../api/client';

const TABS = [
  ['all',       'Все'],
  ['PAID',      '✅ Оплачено'],
  ['CANCELED',  '❌ Отменено'],
  ['CREATED',   '⏳ Ожидает'],
];

export default function Admin({ onBack, bridge }) {
  const [f, setF]         = useState('all');
  const [invoices, setInv] = useState([]);
  const [loading, setLoad] = useState(true);

  useEffect(() => {
    setLoad(true);
    api.getInvoices(f === 'all' ? null : f)
      .then(data => setInv(data))
      .catch(() => {})
      .finally(() => setLoad(false));
  }, [f]);

  async function handleStatus(id, status) {
    bridge.haptic('medium');
    try {
      await api.updateInvoice(id, status);
      setInv(prev => prev.map(p => p.id === id ? { ...p, st: status } : p));
      bridge.success();
    } catch {
      bridge.error();
    }
  }

  return (
    <div style={{ padding:'10px 14px 16px' }}>
      <BackBtn onClick={onBack} />

      <div style={{ background:'#0F1729', borderRadius:14, padding:'14px 14px 10px', marginBottom:10 }}>
        <h2 style={{ fontSize:17, fontWeight:800, color:'#fff', margin:'0 0 3px' }}>⚙ Админ-панель</h2>
        <p style={{ fontSize:10, color:'rgba(255,255,255,0.5)', margin:0 }}>Все invoices · разрешение споров</p>
      </div>

      <div style={{ display:'flex', gap:5, marginBottom:10, flexWrap:'wrap' }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setF(key)} style={{
            padding:'6px 11px', fontSize:10, fontWeight:600,
            fontFamily:'inherit', border:'none', borderRadius:7, cursor:'pointer',
            background: f===key ? '#0F1729' : '#F0F2F8',
            color: f===key ? '#fff' : '#6B7280'
          }}>{label}</button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign:'center', padding:'24px 0' }}>
          <div style={{ width:24, height:24, border:'2px solid #E5E7EB', borderTopColor:'#1B6EF3', borderRadius:'50%', margin:'0 auto', animation:'spin 0.6s linear infinite' }} />
        </div>
      )}

      {!loading && invoices.map(p => {
        const sc = STATUS_COLORS[p.st] || '#999';
        return (
          <div key={p.id} style={{
            background:'#fff', borderRadius:12, padding:'11px 12px',
            marginBottom:7, boxShadow:'0 1px 4px rgba(0,0,0,0.05)',
            borderLeft:`3px solid ${sc}`
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
              <span style={{ fontSize:13, fontWeight:700 }}>#{p.id}</span>
              <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:10, background:`${sc}18`, color:sc }}>{p.st}</span>
            </div>
            <div style={{ fontSize:11, color:'#6B7280', lineHeight:1.8 }}>
              <div>••••{p.pan} · {p.tp}</div>
              <div>{fk(p.amt)} ₽</div>
              {p.sid && <div>serviceId: {p.sid}</div>}
              <div>{p.dt}</div>
            </div>
            {p.st === 'CREATED' && (
              <div style={{ display:'flex', gap:6, marginTop:7 }}>
                <button onClick={() => handleStatus(p.id, 'PAID')} style={{
                  flex:1, padding:7, fontSize:11, fontWeight:600,
                  fontFamily:'inherit', border:'none', borderRadius:6,
                  cursor:'pointer', background:'#E5FBF0', color:'#00A651'
                }}>→ PAID</button>
                <button onClick={() => handleStatus(p.id, 'CANCELED')} style={{
                  flex:1, padding:7, fontSize:11, fontWeight:600,
                  fontFamily:'inherit', border:'none', borderRadius:6,
                  cursor:'pointer', background:'#FEE4E2', color:'#F04438'
                }}>→ CANCELED</button>
              </div>
            )}
          </div>
        );
      })}

      {!loading && !invoices.length && (
        <p style={{ textAlign:'center', fontSize:12, color:'#9CA3AF', padding:'20px 0' }}>Нет записей</p>
      )}
    </div>
  );
}
