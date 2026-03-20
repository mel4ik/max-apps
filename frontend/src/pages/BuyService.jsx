import React, { useState, useEffect } from 'react';
import { Box } from '../components/Shared';
import { fk, sd } from '../api/helpers';
import * as api from '../api/client';

export default function BuyService({ card: c, onBack, onPay }) {
  var _ops = useState(null); var ops = _ops[0]; var setOps = _ops[1];
  var _loading = useState(true); var loading = _loading[0]; var setLoading = _loading[1];
  var _selected = useState(null); var selected = _selected[0]; var setSelected = _selected[1];
  var _paying = useState(false); var paying = _paying[0]; var setPaying = _paying[1];
  var _err = useState(''); var err = _err[0]; var setErr = _err[1];
  var _email = useState(''); var email = _email[0]; var setEmail = _email[1];
  var _showEmail = useState(false); var showEmail = _showEmail[0]; var setShowEmail = _showEmail[1];

  useEffect(function() {
    setLoading(true);
    api.getOperations(c.id).then(function(data) { setOps(data); })
      .catch(function(e) { setErr(e.message); })
      .finally(function() { setLoading(false); });
  }, [c.id]);

  if (loading) {
    return React.createElement('div', { className: 'bs-wrap' },
      React.createElement(Box, null,
        React.createElement('div', { style: { textAlign:'center', padding:'32px 0' } },
          React.createElement('div', { className: 'bs-spinner' })
        )
      )
    );
  }

  var sp = ops && ops.servicePurchase;
  if (!sp || !sp.allowed || !sp.services || sp.services.length === 0) {
    var reason = sp && sp.denyReason ? sp.denyReason.description : 'Покупка услуг недоступна';
    return React.createElement('div', { className: 'bs-wrap' },
      React.createElement(Box, null,
        React.createElement('p', { className: 'bs-blocked' }, '\uD83D\uDEAB ', reason)
      )
    );
  }

  var services = sp.services;
  var sel = selected ? services.find(function(s) { return s.serviceId === selected; }) : null;

  function handlePay() {
    if (!sel || paying) return;
    setPaying(true);
    setErr('');
    api.createPurchase(c.id, sel.serviceId, 0, email || null).then(function(res) {
      window._ykToken = res.confirmation_token;
      onPay(Math.round(sel.cost / 100), res.invoice_id);
    }).catch(function(e) {
      setErr(e.message);
      setPaying(false);
    });
  }

  return React.createElement('div', { className: 'bs-wrap' },
    React.createElement(Box, null,
      React.createElement('h2', { className: 'bs-title' }, 'Покупка услуги'),
      React.createElement('p', { className: 'bs-subtitle' },
        '\u2022\u2022\u2022\u2022 ', (c.card_pan || '').slice(-4)
      ),
      services.map(function(svc) {
        var isSelected = selected === svc.serviceId;
        var ar = svc.actionRange || {};
        var desc = svc.description || {};
        return React.createElement('button', {
          key: svc.serviceId,
          onClick: function() { setSelected(svc.serviceId); },
          className: 'bs-service-btn' + (isSelected ? ' selected' : '')
        },
          React.createElement('div', { style: { flex:1 } },
            React.createElement('p', { className: 'bs-service-name' }, desc.textNote || 'Услуга'),
            React.createElement('p', { className: 'bs-service-info' },
              sd(ar.startDate), ' \u2013 ', sd(ar.endDate),
              desc.intervalAmount ? ' \u00b7 ' + desc.intervalAmount + (desc.intervalLength === 'M' ? ' мес.' : ' дн.') : ''
            )
          ),
          React.createElement('p', { className: 'bs-service-cost' }, fk(svc.cost), ' \u20bd')
        );
      }),
      err && React.createElement('p', { className: 'bs-error' }, '\u26a0 ', err),
      !showEmail && React.createElement('p', {
        className:'tu-email-link',
        onClick: function() { setShowEmail(true); }
      }, '\ud83d\udce7 \u0427\u0435\u043a \u043d\u0430 email'),
      showEmail && React.createElement('input', {
        type:'email', value:email, onChange:function(e){setEmail(e.target.value);},
        placeholder:'\u0412\u0430\u0448 email \u0434\u043b\u044f \u0447\u0435\u043a\u0430 (\u043d\u0435\u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e)',
        className:'tu-email-input'
      }),
      sel && React.createElement('button', { onClick: handlePay, disabled: paying, className: 'bs-pay-btn' },
        paying ? 'Создаём платёж...' : 'Оплатить ' + fk(sel.cost) + ' \u20bd'
      )
    )
  );
}
