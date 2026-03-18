import React, { useState, useEffect } from 'react';
import { Box, BackBtn } from '../components/Shared';
import { fk } from '../api/helpers';
import * as api from '../api/client';

export default function TopUp({ card: c, onBack, onPay }) {
  var p = c.parsed || {};
  var cfg = p.cfg || {};
  var _ops = useState(null); var ops = _ops[0]; var setOps = _ops[1];
  var _loading = useState(true); var loading = _loading[0]; var setLoading = _loading[1];
  var _paying = useState(false); var paying = _paying[0]; var setPaying = _paying[1];
  var _err = useState(''); var err = _err[0]; var setErr = _err[1];
  var _selected = useState(null); var selected = _selected[0]; var setSelected = _selected[1];
  var _custom = useState(''); var custom = _custom[0]; var setCustom = _custom[1];

  useEffect(function() {
    setLoading(true);
    api.getOperations(c.id).then(function(data) {
      setOps(data);
    }).catch(function(e) { setErr(e.message); }).finally(function() { setLoading(false); });
  }, [c.id]);

  if (loading) {
    return React.createElement('div', { style: { padding:'10px 14px 16px' } },
      
      React.createElement(Box, null,
        React.createElement('div', { style: { textAlign:'center', padding:'32px 0' } },
          React.createElement('div', { style: { width:24, height:24, border:'2px solid #E5E7EB', borderTopColor:'#1B6EF3', borderRadius:'50%', margin:'0 auto', animation:'spin 0.6s linear infinite' } })
        )
      )
    );
  }

  var repl = ops && ops.counterReplenishment;
  if (!repl || !repl.allowed) {
    var reason = repl && repl.denyReason ? repl.denyReason.description : 'Пополнение недоступно';
    return React.createElement('div', { style: { padding:'10px 14px 16px' } },
      
      React.createElement(Box, null,
        React.createElement('p', { style: { fontSize:14, fontWeight:600, color:'#F04438', textAlign:'center', padding:'20px 0' } }, 'Пополнение недоступно: ', reason)
      )
    );
  }

  var restr = repl.restriction.value;
  var mnKop = restr.minAmount;
  var mxKop = restr.maxAmount;
  var mn = Math.ceil(mnKop / 100);
  var mx = Math.floor(mxKop / 100);
  var bal = ops.cardAccount ? ops.cardAccount.balanceAmount : (p.bal || 0);
  var allPresets = cfg.replPresets || [200, 500, 1000, 1500];
  var presets = allPresets.filter(function(v) { return v >= mn && v <= mx; });
  var activeSum = 0;
  if (custom !== '') {
    activeSum = parseInt(custom) || 0;
  } else if (selected !== null) {
    activeSum = selected;
  }
  var ok = activeSum >= mn && activeSum <= mx;

  function selectPreset(v) {
    setSelected(v);
    setCustom('');
  }

  function onCustomChange(e) {
    var val = e.target.value.replace(/\D/g, '');
    setCustom(val);
    setSelected(null);
  }

  function handlePay() {
    if (!ok || paying) return;
    setPaying(true);
    setErr('');
    api.createReplenishment(c.id, activeSum * 100, 'VALUE').then(function(res) {
      window._ykToken = res.confirmation_token;
      onPay(activeSum, res.invoice_id);
    }).catch(function(e) {
      setErr(e.message);
      setPaying(false);
    });
  }

  return React.createElement('div', { style: { padding:'10px 14px 16px' } },
    
    React.createElement(Box, null,
      React.createElement('h2', { style: { fontSize:17, fontWeight:800, margin:'0 0 4px' } }, 'Пополнение'),
      React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:'0 0 4px' } },
        '\u2022\u2022\u2022\u2022 ', (c.card_pan || '').slice(-4), ' \u00b7 Баланс: ', fk(bal), ' \u20bd'
      ),
      React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:'0 0 14px' } },
        'Не менее ', mn, ' \u20bd \u00b7 Не более ', mx, ' \u20bd'
      ),
      presets.length > 0 && React.createElement('div', null,
        React.createElement('p', { style: { fontSize:12, fontWeight:700, color:'#6B7280', margin:'0 0 6px' } }, 'Выберите сумму'),
        React.createElement('div', { style: { display:'grid', gridTemplateColumns:'repeat('+Math.min(presets.length, 4)+',1fr)', gap:6, marginBottom:14 } },
          presets.map(function(a) {
            var isActive = custom === '' && selected === a;
            return React.createElement('button', {
              key: a, onClick: function() { selectPreset(a); },
              style: { padding:'12px 0', fontSize:15, fontWeight:700, fontFamily:'inherit', background: isActive ? '#FF6B00' : '#F0F2F8', color: isActive ? '#fff' : '#0F1729', border:'none', borderRadius:10, cursor:'pointer' }
            }, a + ' \u20bd');
          })
        )
      ),
      React.createElement('p', { style: { fontSize:12, fontWeight:700, color:'#6B7280', margin:'0 0 6px' } }, 'Или введите сумму'),
      React.createElement('input', {
        type: 'text', inputMode: 'numeric', value: custom, onChange: onCustomChange,
        placeholder: mn + ' \u2013 ' + mx + ' \u20bd',
        style: { width:'100%', padding:'14px 14px', fontSize:18, fontWeight:700, fontFamily:'inherit', background:'#F0F2F8', border: '2px solid ' + (custom !== '' && !ok ? '#F04438' : custom !== '' && ok ? '#00A651' : '#E5E7EB'), borderRadius:12, outline:'none', color:'#0F1729', marginBottom: 4, boxSizing:'border-box', textAlign:'center' }
      }),
      custom !== '' && !ok && React.createElement('p', { style: { fontSize:11, color:'#F04438', margin:'0 0 8px', textAlign:'center' } }, activeSum < mn ? 'Минимум ' + mn + ' \u20bd' : 'Максимум ' + mx + ' \u20bd'),
      custom !== '' && ok && React.createElement('p', { style: { fontSize:11, color:'#00A651', margin:'0 0 8px', textAlign:'center' } }, '\u2713 Сумма корректна'),
      React.createElement('div', { style: { height: 8 } }),
      err && React.createElement('p', { style: { fontSize:12, color:'#F04438', margin:'0 0 8px', fontWeight:600 } }, '\u26a0 ', err),
      React.createElement('button', {
        onClick: handlePay, disabled: !ok || paying,
        style: { width:'100%', padding:15, fontSize:15, fontWeight:700, fontFamily:'inherit', color:'#fff', background: ok ? 'linear-gradient(135deg,#FF6B00,#E85D00)' : '#ccc', border:'none', borderRadius:12, cursor: ok ? 'pointer' : 'default', opacity: paying ? 0.5 : 1 }
      }, paying ? 'Создаём платёж...' : ok ? 'Оплатить ' + activeSum + ' \u20bd' : 'Выберите сумму'),
      React.createElement('p', { style: { textAlign:'center', fontSize:10, color:'#9CA3AF', marginTop:8 } }, '\u042eKassa \u00b7 карта, СБП, SberPay, T-Pay')
    )
  );
}
