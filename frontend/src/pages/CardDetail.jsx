import React, { useState, useEffect } from 'react';
import { Box } from '../components/Shared';
import { fk, sd, ft } from '../api/helpers';
import * as api from '../api/client';

var SHOW_STEP = 8;

export default function CardDetail({ card: c, onBack, onTopUp, onBuyService, bridge }) {
  var p = c.parsed || {};
  var cfg = p.cfg || {};
  var cl = cfg.color || '#999';
  var pan = c.card_pan || '';
  var canPay = p.canPay !== false;
  var payType = cfg.payType || 'none';
  // Остаток дней: от max(дата начала, сегодня) до даты окончания
  var now = new Date();
  var daysLeft = 0;
  if (p.abEnd) {
    var startDate = p.abStart ? new Date(p.abStart) : now;
    var fromDate = startDate > now ? startDate : now;
    daysLeft = Math.max(0, Math.ceil((new Date(p.abEnd) - fromDate) / 86400000));
  }

  var _del = useState(false); var delConfirm = _del[0]; var setDelConfirm = _del[1];
  var _delLoad = useState(false); var delLoad = _delLoad[0]; var setDelLoad = _delLoad[1];
  var _refreshing = useState(false); var refreshing = _refreshing[0]; var setRefreshing = _refreshing[1];
  var _p2 = useState(p); var liveP = _p2[0]; var setLiveP = _p2[1];

  // Для service-карт: проверяем доступность услуг через Replenisher
  var _svcAllowed = useState(null); var svcAllowed = _svcAllowed[0]; var setSvcAllowed = _svcAllowed[1];
  var _svcDenyReason = useState(''); var svcDenyReason = _svcDenyReason[0]; var setSvcDenyReason = _svcDenyReason[1];

  // Все данные загружаем разом, показываем порциями
  var _trips = useState([]); var allTrips = _trips[0]; var setAllTrips = _trips[1];
  var _repls = useState([]); var allRepls = _repls[0]; var setAllRepls = _repls[1];
  var _tripsShow = useState(SHOW_STEP); var tripsShow = _tripsShow[0]; var setTripsShow = _tripsShow[1];
  var _replsShow = useState(SHOW_STEP); var replsShow = _replsShow[0]; var setReplsShow = _replsShow[1];

  var _l = useState(true); var opsLoading = _l[0]; var setOpsLoading = _l[1];
  var _tab = useState('trips'); var tab = _tab[0]; var setTab = _tab[1];

  useEffect(function() { setLiveP(p); }, [c.id]);

  // Для service-карт: проверяем доступность покупки услуг
  useEffect(function() {
    if (payType !== 'service' || !canPay) {
      setSvcAllowed(null);
      setSvcDenyReason('');
      return;
    }
    setSvcAllowed(null); // loading
    api.getOperations(c.id).then(function(ops) {
      var sp = ops.servicePurchase || ops.service_purchase || {};
      if (sp.allowed === false) {
        setSvcAllowed(false);
        var reason = sp.denyReason || sp.deny_reason || {};
        setSvcDenyReason(reason.description || 'Покупка услуг недоступна');
      } else {
        setSvcAllowed(true);
        setSvcDenyReason('');
      }
    }).catch(function() {
      setSvcAllowed(true); // при ошибке — не блокируем, пусть BuyService покажет ошибку
    });
  }, [c.id, payType, canPay]);

  // Загружаем операции с retry
  useEffect(function() {
    setOpsLoading(true);
    setAllTrips([]); setAllRepls([]);
    setTripsShow(SHOW_STEP); setReplsShow(SHOW_STEP);

    var retried = false;

    function loadOps() {
      Promise.all([
        api.getTrips(c.id).catch(function(e) { console.error('trips err:', e); return { _err: true }; }),
        api.getReplenishments(c.id).catch(function(e) { console.error('repls err:', e); return { _err: true }; }),
      ]).then(function(res) {
        var tripsErr = res[0]._err;
        var replsErr = res[1]._err;

        // Если обе ошибки и ещё не ретраили — повторяем через 2с
        // (первый запрос мог протухнуть, keycloak re-auth уже прошёл)
        if (tripsErr && replsErr && !retried) {
          retried = true;
          setTimeout(loadOps, 2000);
          return;
        }

        var td = !tripsErr ? (res[0].data || res[0].content || []) : [];
        var rd = !replsErr ? (res[1].data || res[1].content || []) : [];
        if (!Array.isArray(td)) td = [];
        if (!Array.isArray(rd)) rd = [];
        setAllTrips(td);
        setAllRepls(rd);
        setOpsLoading(false);
      });
    }

    loadOps();
  }, [c.id]);

  // Видимые порции
  var trips = allTrips.slice(0, tripsShow);
  var repls = allRepls.slice(0, replsShow);
  var tripsHasMore = tripsShow < allTrips.length;
  var replsHasMore = replsShow < allRepls.length;

  function doRefresh() {
    setRefreshing(true);
    bridge.haptic();
    api.getCardInfo(c.id, true).then(function(info) {
      var np = api.parseCardStatus(info, c);
      if (np) setLiveP(np);
    }).catch(function(){}).finally(function() { setRefreshing(false); });
  }

  function doDelete() {
    if (!delConfirm) {
      setDelConfirm(true);
      bridge.haptic();
      setTimeout(function() { setDelConfirm(false); }, 3000);
      return;
    }
    setDelLoad(true);
    bridge.haptic('medium');
    api.deleteCard(c.id).then(function() { bridge.success(); onBack(); }).catch(function() { bridge.error(); setDelLoad(false); setDelConfirm(false); });
  }

  function doPay() {
    bridge.haptic('medium');
    if (payType === 'replenish') onTopUp(); else onBuyService();
  }

  function transportIcon(type) {
    if (!type) return '\uD83D\uDE8C';
    var t = type.toLowerCase();
    if (t.indexOf('\u0442\u0440\u0430\u043c\u0432\u0430\u0439') >= 0) return '\uD83D\uDE8B';
    if (t.indexOf('\u0442\u0440\u043e\u043b\u043b\u0435\u0439\u0431\u0443\u0441') >= 0) return '\uD83D\uDE8E';
    if (t.indexOf('\u043c\u0435\u0442\u0440\u043e') >= 0) return '\uD83D\uDE87';
    if (t.indexOf('\u044d\u043b\u0435\u043a\u0442\u0440\u0438\u0447\u043a\u0430') >= 0 || t.indexOf('\u043f\u043e\u0435\u0437\u0434') >= 0) return '\uD83D\uDE86';
    return '\uD83D\uDE8C';
  }

  var dp = liveP;

  // Для кнопки пополнения
  var payDisabled = dp.blocked || (payType === 'service' && svcAllowed === false);
  var payLoading = payType === 'service' && svcAllowed === null && canPay;

  return React.createElement('div', { className: 'cd-wrap' },
    // ── Карточка-визитка ──
    React.createElement('div', { style: { position:'relative', borderRadius:18, padding:'20px 16px', marginBottom:10, overflow:'hidden', boxShadow:'0 8px 28px '+cl+'44', background:'linear-gradient(135deg,'+cl+','+cl+'CC,'+cl+'77)' } },
      React.createElement('div', { style: { position:'absolute', top:-35, right:-35, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.1)' } }),
      React.createElement('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative', marginBottom:6 } },
        React.createElement('p', { style: { fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.6)', textTransform:'uppercase', letterSpacing:2, margin:0 } }, dp.label || 'ETK'),
        React.createElement('span', { style: { fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'rgba(255,255,255,0.15)', color:'#fff' } }, dp.stop ? '\u26d4 \u0421\u0442\u043e\u043f-\u043b\u0438\u0441\u0442' : '\u2713 \u0410\u043a\u0442\u0438\u0432\u043d\u0430')
      ),
      React.createElement('p', { style: { fontSize:14, fontWeight:700, color:'#fff', letterSpacing:1.5, margin:'0 0 2px', position:'relative' } }, pan.replace(/(.{4})/g, '$1 ').trim()),
      React.createElement('p', { style: { fontSize:11, color:'rgba(255,255,255,0.5)', margin:'0 0 14px', position:'relative' } }, '\ud83d\udccd ', c.region || '\u2014'),
      cfg.showBalance && React.createElement('div', { style: { position:'relative', marginBottom: cfg.showTrips ? 10 : 0 } },
        React.createElement('p', { style: { fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:1, margin:'0 0 3px' } }, '\u0411\u0430\u043b\u0430\u043d\u0441'),
        React.createElement('p', { style: { fontSize:32, fontWeight:800, color:'#fff', margin:0 } }, fk(dp.bal), React.createElement('span', { style: { fontSize:18, fontWeight:600, opacity:0.7 } }, ' \u20bd'))
      ),
      cfg.showTrips && dp.trips > 0 && React.createElement('div', { style: { position:'relative', marginBottom:4 } },
        React.createElement('p', { style: { fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:1, margin:'0 0 3px' } }, '\u041e\u0441\u0442\u0430\u0442\u043e\u043a \u043f\u043e\u0435\u0437\u0434\u043e\u043a'),
        React.createElement('p', { style: { fontSize: cfg.showBalance ? 25 : 32, fontWeight:800, color:'#fff', margin:0 } }, dp.trips),
        dp.tripsEnd && dp.kind !== 'pack' && React.createElement('p', { style: { fontSize:11, color:'rgba(255,255,255,0.55)', margin:'6px 0 0' } }, '\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0434\u043e ', sd(dp.tripsEnd))
      ),
      cfg.showDates && dp.kind === 'abonement' && (
        dp.hasActiveAbonement
          ? React.createElement('div', { style: { position:'relative' } },
              React.createElement('p', { style: { fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:1, margin:'0 0 3px' } }, '\u0421\u0440\u043e\u043a \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f'),
              React.createElement('p', { style: { fontSize:26, fontWeight:800, color:'#fff', margin:0 } }, 'C ', sd(dp.abStart), ' \u043f\u043e ', sd(dp.abEnd)),
              daysLeft > 0 && React.createElement('p', { style: { fontSize:12, color:'rgba(255,255,255,0.6)', margin:'6px 0 0' } }, '\u041e\u0441\u0442\u0430\u043b\u043e\u0441\u044c ', daysLeft, ' \u0434\u043d.'),
              dp.abDesc && React.createElement('p', { style: { fontSize:11, color:'rgba(255,255,255,0.55)', margin:'6px 0 0' } }, dp.abDesc)
            )
          : React.createElement('p', { style: { fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.7)', margin:0 } }, '\u041d\u0435\u0442 \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0443\u0441\u043b\u0443\u0433')
      ),
      dp.stale && React.createElement('p', { style: { fontSize:10, color:'rgba(255,255,255,0.4)', margin:'8px 0 0', fontStyle:'italic' } }, '\u26a1 \u041a\u044d\u0448 (', dp.source, ')')
    ),

    // ── Кнопки действий ──
    React.createElement('div', { className: 'cd-actions' },
      canPay && payType !== 'none' && !payDisabled && !payLoading && React.createElement('button', { onClick: doPay, className: 'cd-pay-btn' }, payType === 'service' ? '\u2191 \u041a\u0443\u043f\u0438\u0442\u044c \u0443\u0441\u043b\u0443\u0433\u0443' : '\u2191 \u041f\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u044c'),
      payLoading && React.createElement('div', { className: 'cd-no-pay' }, '\u23f3'),
      dp.blocked && React.createElement('div', { className: 'cd-no-pay cd-blocked' }, '\u26d4 \u041a\u0430\u0440\u0442\u0430 \u0437\u0430\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u0430'),
      !dp.blocked && payType === 'service' && svcAllowed === false && React.createElement('div', { className: 'cd-no-pay' }, svcDenyReason || '\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0445 \u0443\u0441\u043b\u0443\u0433'),
      !canPay && !dp.blocked && payType !== 'service' && React.createElement('div', { className: 'cd-no-pay' }, '\ud83d\udeab \u041f\u043e\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435 \u0437\u0430\u043f\u0440\u0435\u0449\u0435\u043d\u043e'),
      React.createElement('button', { onClick: doRefresh, className: 'cd-icon-btn' }, refreshing ? '\u23f3' : '\u21bb'),
      React.createElement('button', {
        onClick: doDelete, disabled: delLoad,
        className: 'cd-icon-btn' + (delConfirm ? ' delete-confirm' : ' delete'),
        style: { opacity: delLoad ? 0.5 : 1 }
      }, delConfirm ? '\u274c' : '\ud83d\uddd1\ufe0f')
    ),

    // ── Операции ──
    React.createElement(Box, null,
      React.createElement('div', { className: 'cd-ops-header' },
        React.createElement('h3', { className: 'cd-ops-title' }, '\u041e\u043f\u0435\u0440\u0430\u0446\u0438\u0438')
      ),
      React.createElement('div', { className: 'cd-tabs' },
        React.createElement('button', { className: 'cd-tab' + (tab === 'trips' ? ' active' : ''), onClick: function(){ setTab('trips'); } }, '\uD83D\uDE8C \u041f\u043e\u0435\u0437\u0434\u043a\u0438', allTrips.length > 0 ? ' (' + allTrips.length + ')' : ''),
        React.createElement('button', { className: 'cd-tab' + (tab === 'repls' ? ' active' : ''), onClick: function(){ setTab('repls'); } }, '\u2191 \u041f\u043e\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u044f', allRepls.length > 0 ? ' (' + allRepls.length + ')' : '')
      ),

      opsLoading && React.createElement('div', { style: { textAlign:'center', padding:'16px 0' } },
        React.createElement('div', { className: 'cd-ops-spinner' })
      ),

      // ── Поездки ──
      !opsLoading && tab === 'trips' && trips.map(function(t, i) {
        var routeLabel = t.route_num
          ? ('\u2116' + t.route_num + (t.route_description ? ' \u2014 ' + t.route_description.replace(/\\n|\\r/g, '').trim() : ''))
          : (t.route_name || '\u041f\u043e\u0435\u0437\u0434\u043a\u0430');
        var transportType = t.route_transport_type || '';
        var carrier = t.transport_carrier_name || '';

        return React.createElement('div', { key:'t'+i, className: 'cd-op-row' },
          React.createElement('div', { className: 'cd-op-icon trip' },
            React.createElement('span', { className: 'arrow-down' }, transportIcon(transportType))
          ),
          React.createElement('div', { style: { flex:1, minWidth:0 } },
            React.createElement('p', { className: 'cd-op-name' }, routeLabel),
            React.createElement('p', { className: 'cd-op-date' }, ft(t.trip_date || t.pass_date)),
            (transportType || carrier) && React.createElement('p', { className: 'cd-op-transport' },
              transportType, carrier ? ' \u00b7 ' + carrier : ''
            )
          ),
          React.createElement('p', { className: 'cd-op-amount' },
            t.trip_sum ? '\u2212' + fk(t.trip_sum) + ' \u20bd'
            : t.pass_sum ? '\u2212' + fk(t.pass_sum) + ' \u20bd'
            : ''
          )
        );
      }),

      !opsLoading && tab === 'trips' && tripsHasMore && React.createElement('button', {
        className: 'cd-load-more',
        onClick: function() { setTripsShow(function(v) { return v + SHOW_STEP; }); bridge.haptic(); }
      }, '\u0415\u0449\u0451 \u043f\u043e\u0435\u0437\u0434\u043a\u0438 (' + (allTrips.length - tripsShow) + ')'),

      !opsLoading && tab === 'trips' && !allTrips.length && React.createElement('p', { className: 'cd-no-ops' }, '\u041d\u0435\u0442 \u043f\u043e\u0435\u0437\u0434\u043e\u043a'),

      // ── Пополнения ──
      !opsLoading && tab === 'repls' && repls.map(function(r, i) {
        return React.createElement('div', { key:'r'+i, className: 'cd-op-row' },
          React.createElement('div', { className: 'cd-op-icon repl' },
            React.createElement('span', { className: 'arrow-up' }, '\u2191')
          ),
          React.createElement('div', { style: { flex:1, minWidth:0 } },
            React.createElement('p', { className: 'cd-op-name' }, api.translateOp(r.type_operation)),
            React.createElement('p', { className: 'cd-op-date' }, ft(r.replenishment_date)),
            r.agent_description && React.createElement('p', { className: 'cd-op-agent' }, r.agent_description)
          ),
          React.createElement('p', { className: 'cd-op-amount' + (r.replenishment_sum > 0 ? ' positive' : ' hint') },
            r.replenishment_sum > 0 ? '+' + fk(r.replenishment_sum) + ' \u20bd' : '0 \u20bd'
          )
        );
      }),

      !opsLoading && tab === 'repls' && replsHasMore && React.createElement('button', {
        className: 'cd-load-more',
        onClick: function() { setReplsShow(function(v) { return v + SHOW_STEP; }); bridge.haptic(); }
      }, '\u0415\u0449\u0451 \u043f\u043e\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u044f (' + (allRepls.length - replsShow) + ')'),

      !opsLoading && tab === 'repls' && !allRepls.length && React.createElement('p', { className: 'cd-no-ops' }, '\u041d\u0435\u0442 \u043f\u043e\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0439')
    )
  );
}
