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
  var _s = useState(0); var s = _s[0]; var setS = _s[1];
  var _custom = useState(''); var custom = _custom[0]; var setCustom = _custom[1];

  // Загружаем реальные лимиты с Короны
  useEffect(function() {
    setLoading(true);
    api.getOperations(c.id).then(function(data) {
      setOps(data);
      // Ставим дефолтный пресет
      var restr = data.counterReplenishment && data.counterReplenishment.restriction;
      if (restr) {
        var min = Math.ceil(restr.value.minAmount / 100);
        var presets = cfg.replPresets || [200, 500, 1000, 1500];
        var valid = presets.filter(function(p) { return p >= min; });
        if (valid.length > 0) setS(valid[0]);
        else setS(min);
      }
    }).catch(function(e) {
      setErr(e.message);
    }).finally(function() { setLoading(false); });
  }, [c.id]);

  if (loading) {
    return React.createElement('div', { style: { padding:'10px 14px 16px' } },
      React.createElement(BackBtn, { onClick: onBack }),
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
      React.createElement(BackBtn, { onClick: onBack }),
      React.createElement(Box, null,
        React.createElement('p', { style: { fontSize:14, fontWeight:600, color:'#F04438', textAlign:'center', padding:'20px 0' } }, '🚫 ', reason)
      )
    );
  }

  var restr = repl.restriction.value;
  var mn = Math.ceil(restr.minAmount / 100);
  var mx = Math.floor(restr.maxAmount / 100);
  var presets = (cfg.replPresets || [200, 500, 1000, 1500]).filter(function(p) { return p >= mn && p <= mx; });
  var activeSum = custom ? parseInt(custom) || 0 : s;
  var ok = activeSum >= mn && activeSum <= mx;
  var bal = ops.cardAccount ? ops.cardAccount.balanceAmount : (p.bal || 0);

  function handlePay() {
    if (!ok || paying) return;
    setPaying(true);
    setErr('');
    api.createReplenishment(c.id, activeSum * 100, 'VALUE').then(function(res) {
      if (res.payment_url) {
        // Открываем ЮKassa в MAX WebView
        if (window.WebApp && window.WebApp.openLink) {
          window.WebApp.openLink(res.payment_url);
        } else {
          window.open(res.payment_url, '_blank');
        }
        // Переходим на экран ожидания
        onPay(activeSum, res.invoice_id);
      }
    }).catch(function(e) {
      setErr(e.message);
      setPaying(false);
    });
  }

  return React.createElement('div', { style: { padding:'10px 14px 16px' } },
    React.createElement(BackBtn, { onClick: onBack }),
    React.createElement(Box, null,
      React.createElement('h2', { style: { fontSize:17, fontWeight:800, margin:'0 0 4px' } }, 'Пополнение'),
      React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:'0 0 4px' } },
        '•••• ', (c.card_pan || '').slice(-4), ' · Баланс: ', fk(bal), ' ₽'
      ),
      React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:'0 0 12px' } },
        'от ', mn, ' ₽ до ', mx, ' ₽'
      ),

      // Пресеты
      presets.length > 0 && React.createElement('div', { style: { display:'grid', gridTemplateColumns:'repeat('+Math.min(presets.length, 4)+',1fr)', gap:6, marginBottom:12 } },
        presets.map(function(a) {
          return React.createElement('button', { key: a, onClick: function() { setS(a); setCustom(''); }, style: {
            padding:'10px 0', fontSize:14, fontWeight:700, fontFamily:'inherit',
            background: !custom && s===a ? '#FF6B00' : '#F0F2F8',
            color: !custom && s===a ? '#fff' : '#0F1729',
            border:'none', borderRadius:8, cursor:'pointer'
          } }, a);
        })
      ),

      // Своя сумма
      React.createElement('input', {
        type:'text', inputMode:'numeric', value: custom,
        onChange: function(e) { setCustom(e.target.value.replace(/\D/g, '')); },
        placeholder: 'Другая сумма (' + mn + '–' + mx + ')',
        style: {
          width:'100%', padding:'12px 14px', fontSize:16, fontWeight:600,
          fontFamily:'inherit', background:'#F0F2F8',
          border:'2px solid ' + (custom && !ok ? '#F04438' : '#E5E7EB'),
          borderRadius:12, outline:'none', color:'#0F1729',
          marginBottom:12, boxSizing:'border-box'
        }
      }),

      err && React.createElement('p', { style: { fontSize:12, color:'#F04438', margin:'0 0 8px', fontWeight:600 } }, '⚠ ', err),

      React.createElement('button', { onClick: handlePay, disabled: !ok || paying, style: {
        width:'100%', padding:14, fontSize:14, fontWeight:700, fontFamily:'inherit',
        color:'#fff', background:'linear-gradient(135deg,#FF6B00,#E85D00)',
        border:'none', borderRadius:12, cursor:'pointer',
        opacity: ok && !paying ? 1 : 0.4
      } }, paying ? 'Создаём платёж...' : 'Оплатить ' + (activeSum > 0 ? activeSum + ' ₽' : '')),

      React.createElement('p', { style: { textAlign:'center', fontSize:10, color:'#9CA3AF', marginTop:6 } },
        'ЮKassa · карта, СБП, SberPay, T-Pay'
      )
    )
  );
}
