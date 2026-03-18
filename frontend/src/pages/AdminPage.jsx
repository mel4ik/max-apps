import React, { useState, useEffect } from 'react';

var API = '/api/admin';

function adminFetch(path, login, password, secretKey) {
  return fetch(API + path, {
    headers: {
      'Authorization': 'Basic ' + btoa(login + ':' + password),
      'X-Secret-Key': secretKey,
    }
  }).then(function(r) {
    if (r.status === 401) throw new Error('Неверные данные');
    if (!r.ok) throw new Error('Ошибка ' + r.status);
    return r.json();
  });
}

function fk(v) { return (v / 100).toLocaleString('ru-RU'); }

export default function AdminPage() {
  var _auth = useState(null); var auth = _auth[0]; var setAuth = _auth[1];
  var _login = useState(''); var login = _login[0]; var setLogin = _login[1];
  var _pass = useState(''); var pass = _pass[0]; var setPass = _pass[1];
  var _key = useState(''); var key = _key[0]; var setKey = _key[1];
  var _err = useState(''); var err = _err[0]; var setErr = _err[1];
  var _stats = useState(null); var stats = _stats[0]; var setStats = _stats[1];
  var _users = useState([]); var users = _users[0]; var setUsers = _users[1];
  var _cards = useState([]); var cards = _cards[0]; var setCards = _cards[1];
  var _invoices = useState([]); var invoices = _invoices[0]; var setInvoices = _invoices[1];
  var _tab = useState('stats'); var tab = _tab[0]; var setTab = _tab[1];
  var _loading = useState(false); var loading = _loading[0]; var setLoading = _loading[1];
  var _filter = useState('all'); var filter = _filter[0]; var setFilter = _filter[1];
  var _search = useState(''); var search = _search[0]; var setSearch = _search[1];

  function handleLogin(e) {
    e.preventDefault();
    setErr(''); setLoading(true);
    adminFetch('/stats', login, pass, key).then(function(data) {
      setAuth({ login: login, password: pass, key: key });
      setStats(data); setLoading(false);
    }).catch(function(e) { setErr(e.message); setLoading(false); });
  }

  function af(path) { return adminFetch(path, auth.login, auth.password, auth.key); }

  useEffect(function() {
    if (!auth) return;
    if (tab === 'stats') af('/stats').then(setStats).catch(function(){});
    if (tab === 'users') af('/users').then(function(d) { setUsers(d.users || []); }).catch(function(){});
    if (tab === 'cards') af('/cards').then(function(d) { setCards(d.cards || []); }).catch(function(){});
    if (tab === 'invoices') {
      var url = '/invoices';
      if (filter !== 'all') url += '?status=' + filter;
      af(url).then(function(d) { setInvoices(d.invoices || []); }).catch(function(){});
    }
  }, [auth, tab, filter]);

  // Фильтрация по поиску
  var filteredInvoices = invoices;
  if (search.trim()) {
    var q = search.trim().toLowerCase();
    filteredInvoices = invoices.filter(function(inv) {
      return (inv.card_pan || '').includes(q) ||
             (inv.id || '').toLowerCase().includes(q) ||
             (inv.yukassa_id || '').toLowerCase().includes(q) ||
             String(inv.user_id).includes(q);
    });
  }

  if (!auth) {
    return React.createElement('div', { style: { maxWidth:400, margin:'80px auto', padding:'0 20px', fontFamily:"'Manrope',sans-serif" } },
      React.createElement('div', { style: { background:'#1E2D4A', borderRadius:16, padding:24, boxShadow:'0 4px 24px rgba(0,0,0,0.3)' } },
        React.createElement('div', { style: { textAlign:'center', marginBottom:20 } },
          React.createElement('div', { style: { fontSize:32, marginBottom:8 } }, '\uD83D\uDD10'),
          React.createElement('h1', { style: { fontSize:20, fontWeight:800, margin:0, color:'#fff' } }, '\u0427\u0430\u0441\u043f\u0438\u043a \u0410\u0434\u043c\u0438\u043d'),
          React.createElement('p', { style: { fontSize:12, color:'#9CA3AF', margin:'4px 0 0' } }, '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0434\u0430\u043d\u043d\u044b\u0435 \u0434\u043b\u044f \u0432\u0445\u043e\u0434\u0430')
        ),
        React.createElement('form', { onSubmit: handleLogin },
          React.createElement('input', { value:login, onChange:function(e){setLogin(e.target.value);setErr('');}, placeholder:'\u041b\u043e\u0433\u0438\u043d', style: { width:'100%', padding:12, fontSize:14, fontFamily:'inherit', background:'#243049', border:'2px solid #2D3A54', borderRadius:10, outline:'none', marginBottom:8, boxSizing:'border-box', color:'#fff' } }),
          React.createElement('input', { value:pass, onChange:function(e){setPass(e.target.value);setErr('');}, placeholder:'\u041f\u0430\u0440\u043e\u043b\u044c', type:'password', style: { width:'100%', padding:12, fontSize:14, fontFamily:'inherit', background:'#243049', border:'2px solid #2D3A54', borderRadius:10, outline:'none', marginBottom:8, boxSizing:'border-box', color:'#fff' } }),
          React.createElement('input', { value:key, onChange:function(e){setKey(e.target.value);setErr('');}, placeholder:'Secret Key', style: { width:'100%', padding:12, fontSize:14, fontFamily:'inherit', background:'#243049', border:'2px solid #2D3A54', borderRadius:10, outline:'none', marginBottom:12, boxSizing:'border-box', color:'#fff' } }),
          err && React.createElement('p', { style: { color:'#F04438', fontSize:13, fontWeight:600, margin:'0 0 8px' } }, err),
          React.createElement('button', { type:'submit', disabled:loading, style: { width:'100%', padding:14, fontSize:14, fontWeight:700, fontFamily:'inherit', color:'#fff', background:'#1B6EF3', border:'none', borderRadius:10, cursor:'pointer', opacity:loading?0.5:1 } }, loading ? '\u0412\u0445\u043e\u0434...' : '\u0412\u043e\u0439\u0442\u0438')
        )
      )
    );
  }

  var statusFilters = [['all','\u0412\u0441\u0435'],['PAID','\u2705 PAID'],['PENDING','\u23f3 PENDING'],['CANCELED','\u274c CANCELED'],['FAILED','\u26a0 FAILED']];

  return React.createElement('div', { style: { maxWidth:900, margin:'0 auto', padding:20, fontFamily:"'Manrope',sans-serif", color:'#F0F2F8' } },
    React.createElement('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 } },
      React.createElement('h1', { style: { fontSize:20, fontWeight:800, margin:0 } }, '\u2699 \u0427\u0430\u0441\u043f\u0438\u043a \u0410\u0434\u043c\u0438\u043d'),
      React.createElement('button', { onClick:function(){setAuth(null);}, style: { padding:'6px 14px', fontSize:12, fontWeight:600, fontFamily:'inherit', color:'#F04438', background:'#3D1515', border:'none', borderRadius:8, cursor:'pointer' } }, '\u0412\u044b\u0439\u0442\u0438')
    ),

    // Табы
    React.createElement('div', { style: { display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' } },
      ['stats','users','cards','invoices'].map(function(t) {
        var labels = { stats:'\uD83D\uDCCA \u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430', users:'\uD83D\uDC65 \u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438', cards:'\uD83D\uDCB3 \u041a\u0430\u0440\u0442\u044b', invoices:'\uD83D\uDCB0 \u041f\u043b\u0430\u0442\u0435\u0436\u0438' };
        return React.createElement('button', { key:t, onClick:function(){setTab(t);}, style: { padding:'8px 16px', fontSize:12, fontWeight:600, fontFamily:'inherit', border:'none', borderRadius:8, cursor:'pointer', background: tab===t ? '#1B6EF3' : '#243049', color: tab===t ? '#fff' : '#9CA3AF' } }, labels[t]);
      })
    ),

    // Статистика
    tab === 'stats' && stats && React.createElement('div', { style: { display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 } },
      React.createElement('div', { style: { background:'#1E2D4A', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,0.2)' } },
        React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:'0 0 4px', textTransform:'uppercase', fontWeight:700 } }, '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439'),
        React.createElement('p', { style: { fontSize:28, fontWeight:800, margin:0 } }, stats.users)
      ),
      React.createElement('div', { style: { background:'#1E2D4A', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,0.2)' } },
        React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:'0 0 4px', textTransform:'uppercase', fontWeight:700 } }, '\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u043a\u0430\u0440\u0442'),
        React.createElement('p', { style: { fontSize:28, fontWeight:800, margin:0 } }, stats.cards)
      )
    ),

    // Пользователи
    tab === 'users' && React.createElement('div', null,
      users.map(function(u) {
        return React.createElement('div', { key:u.id, style: { background:'#1E2D4A', borderRadius:10, padding:'12px 14px', marginBottom:6, boxShadow:'0 1px 4px rgba(0,0,0,0.2)' } },
          React.createElement('p', { style: { fontSize:14, fontWeight:600, margin:0 } }, u.first_name || '', ' ', u.last_name || '', u.username ? ' @'+u.username : ''),
          React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:'2px 0 0' } }, 'ID: ', u.id, ' \u00b7 Last seen: ', u.last_seen)
        );
      })
    ),

    // Карты
    tab === 'cards' && React.createElement('div', null,
      cards.map(function(c) {
        var panFmt = c.card_pan ? c.card_pan.replace(/(.{4})/g, '$1 ').trim() : '';
        return React.createElement('div', { key:c.id, style: { background:'#1E2D4A', borderRadius:10, padding:'12px 14px', marginBottom:6, boxShadow:'0 1px 4px rgba(0,0,0,0.2)', opacity: c.is_active ? 1 : 0.5 } },
          React.createElement('p', { style: { fontSize:13, fontWeight:600, margin:0 } }, panFmt, ' \u00b7 ', c.region || ''),
          React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:'2px 0 0' } }, 'User: ', c.user_id, ' \u00b7 ', c.ticket_description || '', ' \u00b7 ', c.created_at),
          React.createElement('span', { style: { fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:10, background: c.is_active ? '#0A3320' : '#3D1515', color: c.is_active ? '#00A651' : '#F04438' } }, c.is_active ? 'Active' : 'Deleted')
        );
      })
    ),

    // Платежи
    tab === 'invoices' && React.createElement('div', null,
      // Фильтры по статусу
      React.createElement('div', { style: { display:'flex', gap:5, marginBottom:10, flexWrap:'wrap' } },
        statusFilters.map(function(sf) {
          return React.createElement('button', { key:sf[0], onClick:function(){setFilter(sf[0]);}, style: { padding:'6px 12px', fontSize:11, fontWeight:600, fontFamily:'inherit', border:'none', borderRadius:7, cursor:'pointer', background: filter===sf[0] ? '#1B6EF3' : '#243049', color: filter===sf[0] ? '#fff' : '#9CA3AF' } }, sf[1]);
        })
      ),
      // Поиск
      React.createElement('input', {
        value: search,
        onChange: function(e) { setSearch(e.target.value); },
        placeholder: '\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u043d\u043e\u043c\u0435\u0440\u0443 \u043a\u0430\u0440\u0442\u044b, ID, user_id...',
        style: { width:'100%', padding:'10px 14px', fontSize:13, fontFamily:'inherit', background:'#243049', border:'2px solid #2D3A54', borderRadius:10, outline:'none', marginBottom:12, boxSizing:'border-box', color:'#fff' }
      }),
      // Список
      filteredInvoices.map(function(inv) {
        var sc = { CREATED:'#F79009', PAID:'#00A651', PENDING:'#1B6EF3', CANCELED:'#F04438', FAILED:'#F04438' };
        var clr = sc[inv.status] || '#999';
        var panFmt = inv.card_pan ? inv.card_pan.replace(/(.{4})/g, '$1 ').trim() : '';
        var amtRub = (inv.amount / 100).toFixed(0);
        var date = inv.created_at ? inv.created_at.replace('T',' ').split('.')[0] : '';
        return React.createElement('div', { key:inv.id, style: { background:'#1E2D4A', borderRadius:12, padding:'14px 16px', marginBottom:8, boxShadow:'0 2px 8px rgba(0,0,0,0.2)', borderLeft:'4px solid '+clr } },
          // Заголовок
          React.createElement('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 } },
            React.createElement('span', { style: { fontSize:15, fontWeight:700 } }, panFmt, ' \u00b7 ', amtRub, ' \u20bd'),
            React.createElement('span', { style: { fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:10, background:clr+'22', color:clr } }, inv.status)
          ),
          // Детали
          React.createElement('div', { style: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 16px', fontSize:12, color:'#9CA3AF', lineHeight:1.6 } },
            React.createElement('div', null, '\uD83D\uDC64 User: ', React.createElement('span', { style: { color:'#F0F2F8' } }, inv.user_id)),
            React.createElement('div', null, '\uD83D\uDCC5 ', React.createElement('span', { style: { color:'#F0F2F8' } }, date)),
            React.createElement('div', null, '\u042eKassa: ', React.createElement('span', { style: { fontWeight:600, color: inv.yukassa_status === 'succeeded' ? '#00A651' : '#F0F2F8' } }, inv.yukassa_status || '\u2014')),
            React.createElement('div', null, '\u041a\u043e\u0440\u043e\u043d\u0430: ', React.createElement('span', { style: { fontWeight:600, color: inv.korona_status === 'PAID' ? '#00A651' : '#F0F2F8' } }, inv.korona_status || '\u2014')),
            inv.service_id && React.createElement('div', null, '\uD83D\uDCE6 \u0423\u0441\u043b\u0443\u0433\u0430: ', React.createElement('span', { style: { color:'#F0F2F8' } }, inv.service_desc || inv.service_id)),
            inv.yukassa_id && React.createElement('div', { style: { gridColumn:'1/3' } }, '\uD83C\uDD94 YK: ', React.createElement('span', { style: { color:'#6B7280', fontSize:11 } }, inv.yukassa_id))
          ),
          inv.error_message && React.createElement('div', { style: { marginTop:6, padding:'6px 10px', background:'#3D1515', borderRadius:6, fontSize:11, color:'#F04438' } }, '\u26a0 ', inv.error_message),
          // ID invoice
          React.createElement('div', { style: { marginTop:6, fontSize:10, color:'#6B7280' } }, 'ID: ', inv.id)
        );
      }),
      !filteredInvoices.length && React.createElement('p', { style: { color:'#9CA3AF', textAlign:'center', padding:20 } }, '\u041d\u0435\u0442 \u043f\u043b\u0430\u0442\u0435\u0436\u0435\u0439')
    )
  );
}
