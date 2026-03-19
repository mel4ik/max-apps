import React, { useState, useEffect, useRef } from 'react';
import { Box } from '../components/Shared';
import * as api from '../api/client';

export default function YooKassa({ card, amt, svc, onBack, onDone, bridge }) {
  var invoiceId = svc;
  var pan = card.card_pan || '';
  var panFmt = pan.replace(/(.{4})/g, '$1 ').trim();
  var region = card.region || '';
  var p = card.parsed || {};
  var cfg = p.cfg || {};
  var isReplenish = cfg.payType === 'replenish';

  var _status = useState('widget'); var status = _status[0]; var setStatus = _status[1];
  var _err = useState(''); var err = _err[0]; var setErr = _err[1];
  var widgetRef = useRef(null);
  var checkRef = useRef(null);

  useEffect(function() {
    if (!invoiceId) return;

    function startPolling() {
      checkRef.current = setInterval(function() {
        api.checkInvoiceStatus(invoiceId).then(function(res) {
          if (res.status === 'PAID') {
            clearInterval(checkRef.current);
            // Сразу скрываем виджет ЮKassa чтобы не показывать его экран успеха
            var el = document.getElementById('yk-widget-container');
            if (el) el.style.display = 'none';
            if (widgetRef.current && widgetRef.current.destroy) { try { widgetRef.current.destroy(); } catch(e) {} widgetRef.current = null; }
            bridge.success();
            setStatus('done');
            return;
          } else if (res.status === 'CANCELED' || res.status === 'FAILED') {
            clearInterval(checkRef.current);
            var el2 = document.getElementById('yk-widget-container');
            if (el2) el2.style.display = 'none';
            if (widgetRef.current && widgetRef.current.destroy) { try { widgetRef.current.destroy(); } catch(e) {} widgetRef.current = null; }
            setStatus('failed');
            setErr(res.error_message || 'Оплата не прошла');
            bridge.error();
          }
        }).catch(function() {});
      }, 2000);
    }

    var token = window._ykToken;
    if (token && window.YooMoneyCheckoutWidget) {
      try {
        var checkout = new window.YooMoneyCheckoutWidget({
          confirmation_token: token,
          return_url: window.location.origin,
          customization: { modal: false, colors: { control_primary: '#FF6B00' } },
          error_callback: function() {
            setErr('Ошибка оплаты');
            setStatus('failed');
            bridge.error();
          }
        });
        checkout.render('yk-widget-container').then(function() { startPolling(); });
        widgetRef.current = checkout;
      } catch (e) {
        setErr('Не удалось загрузить форму');
        setStatus('failed');
      }
    } else {
      startPolling();
    }

    return function() {
      clearInterval(checkRef.current);
      if (widgetRef.current && widgetRef.current.destroy) {
        try { widgetRef.current.destroy(); } catch(e) {}
      }
    };
  }, [invoiceId]);

  if (status === 'done') {
    var title = isReplenish ? 'Баланс пополнен!' : 'Услуга подключена!';
    var subtitle = isReplenish ? '+' + amt + ' \u20bd' : amt + ' \u20bd';
    return React.createElement('div', { className: 'yk-wrap' },
      React.createElement(Box, null,
        React.createElement('div', { className: 'yk-result' },
          React.createElement('div', { className: 'yk-result-icon success' }, '\u2705'),
          React.createElement('h2', { className: 'yk-result-title' }, title),
          React.createElement('p', { className: 'yk-result-amount' }, subtitle),
          React.createElement('p', { className: 'yk-result-pan' }, panFmt),
          React.createElement('p', { className: 'yk-result-region' }, region),
          React.createElement('button', { onClick: onDone, className: 'yk-btn-primary' }, 'Готово')
        )
      )
    );
  }

  if (status === 'failed') {
    return React.createElement('div', { className: 'yk-wrap' },
      React.createElement(Box, null,
        React.createElement('div', { className: 'yk-result' },
          React.createElement('div', { className: 'yk-result-icon fail' }, '\u274c'),
          React.createElement('h2', { className: 'yk-result-title' }, 'Оплата не прошла'),
          React.createElement('p', { className: 'yk-result-err' }, err || 'Попробуйте ещё раз'),
          React.createElement('button', { onClick: onBack, className: 'yk-btn-secondary' }, 'Назад')
        )
      )
    );
  }

  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var widgetCls = 'yk-widget-box' + (isIOS ? ' yk-ios' : '');

  return React.createElement('div', { className: 'yk-wrap' },
    React.createElement('div', { className: 'yk-header' },
      React.createElement('p', { className: 'yk-header-label' }, isReplenish ? 'Пополнение' : 'Покупка услуги'),
      React.createElement('p', { className: 'yk-header-amount' }, amt + ' \u20bd'),
      React.createElement('p', { className: 'yk-header-pan' }, panFmt)
    ),
    React.createElement('div', { id:'yk-widget-container', className: widgetCls }),
    React.createElement('p', { className: 'yk-footer' }, 'ЮKassa \u00b7 Безопасная оплата')
  );
}
