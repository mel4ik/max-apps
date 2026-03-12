import React, { useState, useRef, useEffect } from 'react';
import { Box, BackBtn } from '../components/Shared';

export default function AddCard({ onBack, onAdded, bridge }) {
  const [val, setVal]       = useState('');
  const [loading, setLoad]  = useState(false);
  const [err, setErr]       = useState('');
  const ref = useRef(null);

  useEffect(() => { setTimeout(() => ref.current?.focus(), 200); }, []);

  const digits  = val.replace(/\D/g, '');
  const display = digits.replace(/(.{4})/g, '$1 ').trim();
  const valid   = digits.length === 19 && digits.indexOf('9643') === 0;

  function handleAdd() {
    if (digits.length !== 19) { setErr('Номер должен содержать 19 цифр'); bridge.error(); return; }
    if (digits.indexOf('9643') !== 0) { setErr('Номер должен начинаться с 9643'); bridge.error(); return; }
    setLoad(true); setErr('');
    bridge.haptic('medium');
    // Реальный вызов — App.handleAdded вызовет api.addCard
    setTimeout(() => { setLoad(false); onAdded(digits); bridge.success(); }, 800);
  }

  function handleScan() {
    bridge.haptic();
    try {
      window.WebApp?.openCodeReader(false);
      window.WebApp?.onEvent('codeReaderResult', (data) => {
        if (data?.value) {
          const d = data.value.replace(/\D/g, '');
          if (d) setVal(d);
        }
      });
    } catch {}
  }

  return (
    <div style={{ padding:'10px 14px 16px' }}>
      <BackBtn onClick={onBack} />
      <Box>
        <h2 style={{ fontSize:18, fontWeight:800, margin:'0 0 4px' }}>Добавить карту</h2>
        <p style={{ fontSize:12, color:'#9CA3AF', margin:'0 0 16px' }}>Введите 19-значный номер ЕТК или отсканируйте QR</p>

        <p style={{ fontSize:10, fontWeight:700, color:'#6B7280', margin:'0 0 6px', letterSpacing:0.5 }}>НОМЕР КАРТЫ</p>
        <div style={{ display:'flex', gap:8, marginBottom:8 }}>
          <input
            ref={ref} value={display}
            onChange={e => { setVal(e.target.value); setErr(''); }}
            placeholder="9643" maxLength={23} inputMode="numeric"
            style={{
              flex:1, padding:14, fontSize:17, fontWeight:600,
              fontFamily:'inherit', background:'#F0F2F8',
              border:`2px solid ${err ? '#F04438' : valid ? '#00A651' : '#E5E7EB'}`,
              borderRadius:12, outline:'none', color:'#0F1729', letterSpacing:1
            }}
          />
          <button onClick={handleScan} style={{
            width:52, height:52, flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            background:'#F0F2F8', border:'2px solid #E5E7EB',
            borderRadius:12, color:'#1B6EF3', cursor:'pointer', fontSize:20
          }}>📷</button>
        </div>

        {err && <p style={{ fontSize:12, color:'#F04438', margin:'0 0 8px', fontWeight:500 }}>{err}</p>}
        {valid && !err && <p style={{ fontSize:12, color:'#00A651', margin:'0 0 8px', fontWeight:500 }}>✓ Формат верный</p>}

        {/* Card preview */}
        <div style={{
          position:'relative',
          background:'linear-gradient(135deg,#FF6B00,#FF9248,#FFB347)',
          borderRadius:16, padding:'20px 16px', marginBottom:16,
          overflow:'hidden', opacity: digits.length > 0 ? 1 : 0.35
        }}>
          <div style={{ position:'absolute', top:-25, right:-25, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.15)' }} />
          <p style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.6)', textTransform:'uppercase', letterSpacing:2, margin:'0 0 16px' }}>ЕТК</p>
          <p style={{ fontSize:18, fontWeight:700, color:'#fff', letterSpacing:1.5, margin:'0 0 6px' }}>
            {digits.length > 0 ? display : '9643 •••• •••• •••• •••'}
          </p>
          <p style={{ fontSize:11, color:'rgba(255,255,255,0.5)', margin:0 }}>Единая транспортная карта</p>
        </div>

        <button onClick={handleAdd} disabled={loading || !valid} style={{
          width:'100%', padding:15, fontSize:15, fontWeight:700,
          fontFamily:'inherit', color:'#fff', background:'#1B6EF3',
          border:'none', borderRadius:12, cursor:'pointer',
          opacity: loading || !valid ? 0.5 : 1
        }}>
          {loading ? 'Проверяем...' : 'Добавить карту'}
        </button>
      </Box>
    </div>
  );
}
