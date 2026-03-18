import React, { useState, useEffect } from 'react';
import { Box } from '../components/Shared';
import { fk, sd, ft } from '../api/helpers';
import * as api from '../api/client';

export default function CardDetail({ card: c, onBack, onTopUp, onBuyService, bridge }) {
  var p = c.parsed || {};
  var cfg = p.cfg || {};
  var cl = cfg.color || '#999';
  var pan = c.card_pan || '';
  var canPay = p.canPay !== false;
  var payType = cfg.payType || 'none';
  var daysLeft = p.abEnd ? Math.max(0, Math.ceil((new Date(p.abEnd) - new Date()) / 86400000)) : 0;

  var _del = useState(false); var delConfirm = _del[0]; var setDelConfirm = _del[1];
  var _delLoad = useState(false); var delLoad = _delLoad[0]; var setDelLoad = _delLoad[1];
  var _refreshing = useState(false); var refreshing = _refreshing[0]; var setRefreshing = _refreshing[1];
  var _p2 = useState(p); var liveP = _p2[0]; var setLiveP = _p2[1];
  var _t = useState([]); var trips = _t[0]; var setTrips = _t[1];
  var _r = useState([]); var repls = _r[0]; var setRepls = _r[1];
  var _l = useState(true); var opsLoading = _l[0]; var setOpsLoading = _l[1];

  useEffect(function() { setLiveP(p); }, [c.id]);

  useEffect(function() {
    setOpsLoading(true);
    Promise.all([
      api.getTrips(c.id).catch(function() { return { data:[] }; }),
      api.getReplenishments(c.id).catch(function() { return { data:[] }; }),
    ]).then(function(res) {
      setTrips(res[0].data || []);
      setRepls(res[1].data || []);
    }).finally(function() { setOpsLoading(false); });
  }, [c.id]);

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

  var dp = liveP;

  return React.createElement('div', { style: { padding:'10px 14px 16px' } },
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
        dp.tripsEnd && React.createElement('p', { style: { fontSize:11, color:'rgba(255,255,255,0.55)', margin:'6px 0 0' } }, '\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0434\u043e ', sd(dp.tripsEnd))
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
    React.createElement('div', { style: { display:'flex', gap:8, marginBottom:10 } },
      canPay && payType !== 'none' && React.createElement('button', { onClick: doPay, style: { flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5, padding:13, fontSize:13, fontWeight:700, fontFamily:'inherit', color:'#fff', background:'#FF6B00', border:'none', borderRadius:12, cursor:'pointer' } }, '\u2191 \u041f\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u044c'),
      !canPay && React.createElement('div', { style: { flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:13, fontSize:12, fontWeight:600, color:'#9CA3AF', background:'var(--card)', borderRadius:12 } }, '\ud83d\udeab \u041f\u043e\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435 \u0437\u0430\u043f\u0440\u0435\u0449\u0435\u043d\u043e'),
      React.createElement('button', { onClick: doRefresh, style: { width:44, display:'flex', alignItems:'center', justifyContent:'center', padding:12, fontSize:16, fontFamily:'inherit', color:'var(--text, #0F1729)', background:'var(--card, #fff)', border:'1.5px solid var(--border, #E5E7EB)', borderRadius:12, cursor:'pointer' } }, refreshing ? '\u23f3' : '\u21bb'),
      React.createElement('button', { onClick: doDelete, disabled: delLoad, style: { width:44, display:'flex', alignItems:'center', justifyContent:'center', padding:12, fontSize:15, fontFamily:'inherit', color: delConfirm ? '#F04438' : 'var(--text-hint, #9CA3AF)', background: delConfirm ? '#3D1515' : 'var(--card, #fff)', border: '1.5px solid ' + (delConfirm ? '#FECACA' : 'var(--border, #E5E7EB)'), borderRadius:12, cursor:'pointer', opacity: delLoad ? 0.5 : 1 } }, delConfirm ? '\u274c' : '\ud83d\uddd1\ufe0f')
    ),
    React.createElement(Box, null,
      React.createElement('h3', { style: { fontSize:14, fontWeight:700, margin:'0 0 8px' } }, '\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u0438'),
      opsLoading && React.createElement('div', { style: { textAlign:'center', padding:'16px 0' } },
        React.createElement('div', { style: { width:20, height:20, border:'2px solid var(--border, #E5E7EB)', borderTopColor:'#1B6EF3', borderRadius:'50%', margin:'0 auto', animation:'spin 0.6s linear infinite' } })
      ),
      !opsLoading && repls.map(function(r, i) {
        return React.createElement('div', { key:'r'+i, style: { display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid var(--border-light, #F0F2F8)' } },
          React.createElement('div', { style: { width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'var(--green-bg, #E5FBF0)' } },
            React.createElement('span', { style: { color:'#00D26A', fontWeight:700, fontSize:13 } }, '\u2191')
          ),
          React.createElement('div', { style: { flex:1 } },
            React.createElement('p', { style: { fontSize:13, fontWeight:600, margin:'0 0 1px' } }, api.translateOp(r.type_operation)),
            React.createElement('p', { style: { fontSize:11, color:'var(--text-hint, #9CA3AF)', margin:0 } }, ft(r.replenishment_date))
          ),
          React.createElement('p', { style: { fontSize:14, fontWeight:700, color: r.replenishment_sum > 0 ? '#00D26A' : 'var(--text-hint, #9CA3AF)', margin:0 } }, r.replenishment_sum > 0 ? '+' + fk(r.replenishment_sum) + ' \u20bd' : '0 \u20bd')
        );
      }),
      !opsLoading && trips.map(function(t, i) {
        return React.createElement('div', { key:'t'+i, style: { display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid var(--border-light, #F0F2F8)' } },
          React.createElement('div', { style: { width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'var(--blue-bg, #E8F0FE)' } },
            React.createElement('span', { style: { color:'#1B6EF3', fontWeight:700, fontSize:13 } }, '\u2193')
          ),
          React.createElement('div', { style: { flex:1 } },
            React.createElement('p', { style: { fontSize:13, fontWeight:600, margin:'0 0 1px' } }, t.route_name || '\u041f\u043e\u0435\u0437\u0434\u043a\u0430'),
            React.createElement('p', { style: { fontSize:11, color:'var(--text-hint, #9CA3AF)', margin:0 } }, ft(t.pass_date || t.trip_date))
          ),
          React.createElement('p', { style: { fontSize:14, fontWeight:700, margin:0 } }, '\u2212', fk(t.pass_sum || t.sum_amount || 0), ' \u20bd')
        );
      }),
      !opsLoading && !repls.length && !trips.length && React.createElement('p', { style: { fontSize:12, color:'var(--text-hint, #9CA3AF)', textAlign:'center', padding:'16px 0' } }, '\u041d\u0435\u0442 \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u0439')
    )
  );
}
