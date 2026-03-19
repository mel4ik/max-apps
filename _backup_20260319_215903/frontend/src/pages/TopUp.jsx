import React, { useState, useEffect } from 'react';
import { Box } from '../components/Shared';
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
    api.getOperations(c.id).then(function(data) { setOps(data); })
      .catch(function(e) { setErr(e.message); })
      .finally(function() { setLoading(false); });
  }, [c.id]);

  if (loading) {
    return React.createElement('div', { className:'tu-wrap' },
      React.createElement(Box, null,
        React.createElement('div', { style:{textAlign:'center',padding:'32px 0'} },
          React.createElement('div', { className:'tu-spinner' })
        )
      )
    );
  }

  var repl = ops && ops.counterReplenishment;
  if (!repl || !repl.allowed) {
    var reason = repl && repl.denyReason ? repl.denyReason.description : 'Пополнение недоступно';
    return React.createElement('div', { className:'tu-wrap' },
      React.createElement(Box, null,
        React.createElement('p', { className:'tu-blocked' }, '\ud83d\udeab ', reason)
      )
    );
  }

  var restr = repl.restriction.value;
  var mn = Math.ceil(restr.minAmount / 100);
  var mx = Math.floor(restr.maxAmount / 100);
  var bal = ops.cardAccount ? ops.cardAccount.balanceAmount : (p.bal || 0);
  var allPresets = cfg.replPresets || [200, 500, 1000, 1500];
  var presets = allPresets.filter(function(v) { return v >= mn && v <= mx; });
  var activeSum = 0;
  if (custom !== '') { activeSum = parseInt(custom) || 0; }
  else if (selected !== null) { activeSum = selected; }
  var ok = activeSum >= mn && activeSum <= mx;

  function selectPreset(v) { setSelected(v); setCustom(''); }
  function onCustomChange(e) { var val = e.target.value.replace(/\D/g, ''); setCustom(val); setSelected(null); }

  function handlePay() {
    if (!ok || paying) return;
    setPaying(true); setErr('');
    api.createReplenishment(c.id, activeSum * 100, 'VALUE').then(function(res) {
      window._ykToken = res.confirmation_token;
      onPay(activeSum, res.invoice_id);
    }).catch(function(e) { setErr(e.message); setPaying(false); });
  }

  var panFmt = (c.card_pan || '').replace(/(.{4})/g, '$1 ').trim();
  var gridCls = 'tu-grid tu-grid' + Math.min(presets.length, 4);

  return React.createElement('div', { className:'tu-wrap' },
    React.createElement(Box, null,
      React.createElement('h2', { className:'tu-title' }, '\u041f\u043e\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435'),
      React.createElement('p', { className:'tu-sub' }, panFmt, ' \u00b7 \u0411\u0430\u043b\u0430\u043d\u0441: ', fk(bal), ' \u20bd'),
      React.createElement('p', { className:'tu-limit' }, '\u041d\u0435 \u043c\u0435\u043d\u0435\u0435 ', mn, ' \u20bd \u00b7 \u041d\u0435 \u0431\u043e\u043b\u0435\u0435 ', mx, ' \u20bd'),
      presets.length > 0 && React.createElement('div', null,
        React.createElement('p', { className:'tu-label' }, '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0443\u043c\u043c\u0443'),
        React.createElement('div', { className: gridCls },
          presets.map(function(a) {
            var cls = 'tu-preset' + (custom === '' && selected === a ? ' active' : '');
            return React.createElement('button', { key:a, className:cls, onClick:function(){selectPreset(a);} }, a + ' \u20bd');
          })
        )
      ),
      React.createElement('p', { className:'tu-label' }, '\u0418\u043b\u0438 \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0441\u0443\u043c\u043c\u0443'),
      React.createElement('input', {
        type:'text', inputMode:'numeric', value:custom, onChange:onCustomChange,
        placeholder: mn + ' \u2013 ' + mx + ' \u20bd',
        className: 'tu-input' + (custom !== '' && !ok ? ' invalid' : custom !== '' && ok ? ' valid' : '')
      }),
      custom !== '' && !ok && React.createElement('p', { className:'tu-hint err' }, activeSum < mn ? '\u041c\u0438\u043d\u0438\u043c\u0443\u043c ' + mn + ' \u20bd' : '\u041c\u0430\u043a\u0441\u0438\u043c\u0443\u043c ' + mx + ' \u20bd'),
      custom !== '' && ok && React.createElement('p', { className:'tu-hint ok' }, '\u2713 \u0421\u0443\u043c\u043c\u0430 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0430'),
      React.createElement('div', { style:{height:8} }),
      err && React.createElement('p', { className:'tu-err' }, '\u26a0 ', err),
      React.createElement('button', {
        onClick:handlePay, disabled:!ok || paying,
        className: 'tu-pay' + (paying ? ' loading' : '')
      }, paying ? '\u0421\u043e\u0437\u0434\u0430\u0451\u043c \u043f\u043b\u0430\u0442\u0451\u0436...' : ok ? '\u041e\u043f\u043b\u0430\u0442\u0438\u0442\u044c ' + activeSum + ' \u20bd' : '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0443\u043c\u043c\u0443'),
      React.createElement('p', { className:'tu-footer' }, '\u042eKassa \u00b7 \u043a\u0430\u0440\u0442\u0430, \u0421\u0411\u041f, SberPay, T-Pay')
    )
  );
}
