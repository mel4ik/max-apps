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

export default function AdminPage() {
  var _auth = useState(null); var auth = _auth[0]; var setAuth = _auth[1];
  var _login = useState(''); var login = _login[0]; var setLogin = _login[1];
  var _pass = useState(''); var pass = _pass[0]; var setPass = _pass[1];
  var _key = useState(''); var key = _key[0]; var setKey = _key[1];
  var _err = useState(''); var err = _err[0]; var setErr = _err[1];
  var _stats = useState(null); var stats = _stats[0]; var setStats = _stats[1];
  var _users = useState([]); var users = _users[0]; var setUsers = _users[1];
  var _cards = useState([]); var cards = _cards[0]; var setCards = _cards[1];
  var _tab = useState('stats'); var tab = _tab[0]; var setTab = _tab[1];
  var _invoices = useState([]); var invoices = _invoices[0]; var setInvoices = _invoices[1];
  var _loading = useState(false); var loading = _loading[0]; var setLoading = _loading[1];

  function handleLogin(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    adminFetch('/stats', login, pass, key).then(function(data) {
      setAuth({ login: login, password: pass, key: key });
      setStats(data);
      setLoading(false);
    }).catch(function(e) {
      setErr(e.message);
      setLoading(false);
    });
  }

  function af(path) {
    return adminFetch(path, auth.login, auth.password, auth.key);
  }

  useEffect(function() {
    if (!auth) return;
    if (tab === 'stats') af('/stats').then(setStats).catch(function(){});
    if (tab === 'users') af('/users').then(function(d) { setUsers(d.users || []); }).catch(function(){});
    if (tab === 'cards') af('/cards').then(function(d) { setCards(d.cards || []); }).catch(function(){});
    if (tab === 'invoices') af('/invoices').then(function(d) { setInvoices(d.invoices || []); }).catch(function(){});
  }, [auth, tab]);

  if (!auth) {
    return React.createElement('div', { style: { maxWidth:400, margin:'80px auto', padding:'0 20px', fontFamily:"'Manrope',sans-serif" } },
      React.createElement('div', { style: { background:'#fff', borderRadius:16, padding:24, boxShadow:'0 4px 24px rgba(0,0,0,0.08)' } },
        React.createElement('div', { style: { textAlign:'center', marginBottom:20 } },
          React.createElement('div', { style: { fontSize:32, marginBottom:8 } }, '🔐'),
          React.createElement('h1', { style: { fontSize:20, fontWeight:800, margin:0 } }, 'Часпик Админ'),
          React.createElement('p', { style: { fontSize:12, color:'#9CA3AF', margin:'4px 0 0' } }, 'Введите данные для входа')
        ),
        React.createElement('form', { onSubmit: handleLogin },
          React.createElement('input', { value:login, onChange:function(e){setLogin(e.target.value);setErr('');}, placeholder:'Логин', style: { width:'100%', padding:12, fontSize:14, fontFamily:'inherit', background:'#F0F2F8', border:'2px solid #E5E7EB', borderRadius:10, outline:'none', marginBottom:8, boxSizing:'border-box' } }),
          React.createElement('input', { value:pass, onChange:function(e){setPass(e.target.value);setErr('');}, placeholder:'Пароль', type:'password', style: { width:'100%', padding:12, fontSize:14, fontFamily:'inherit', background:'#F0F2F8', border:'2px solid #E5E7EB', borderRadius:10, outline:'none', marginBottom:8, boxSizing:'border-box' } }),
          React.createElement('input', { value:key, onChange:function(e){setKey(e.target.value);setErr('');}, placeholder:'Secret Key', style: { width:'100%', padding:12, fontSize:14, fontFamily:'inherit', background:'#F0F2F8', border:'2px solid #E5E7EB', borderRadius:10, outline:'none', marginBottom:12, boxSizing:'border-box' } }),
          err && React.createElement('p', { style: { color:'#F04438', fontSize:13, fontWeight:600, margin:'0 0 8px' } }, err),
          React.createElement('button', { type:'submit', disabled:loading, style: { width:'100%', padding:14, fontSize:14, fontWeight:700, fontFamily:'inherit', color:'#fff', background:'#0F1729', border:'none', borderRadius:10, cursor:'pointer', opacity:loading?0.5:1 } }, loading ? 'Вход...' : 'Войти')
        )
      )
    );
  }

  return React.createElement('div', { style: { maxWidth:800, margin:'0 auto', padding:20, fontFamily:"'Manrope',sans-serif" } },
    React.createElement('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 } },
      React.createElement('h1', { style: { fontSize:20, fontWeight:800, margin:0 } }, '⚙ Часпик Админ'),
      React.createElement('button', { onClick:function(){setAuth(null);}, style: { padding:'6px 14px', fontSize:12, fontWeight:600, fontFamily:'inherit', color:'#F04438', background:'#FEE4E2', border:'none', borderRadius:8, cursor:'pointer' } }, 'Выйти')
    ),

    // Табы
    React.createElement('div', { style: { display:'flex', gap:6, marginBottom:16 } },
      ['stats','users','cards','invoices'].map(function(t) {
        var labels = { stats:'📊 Статистика', users:'👥 Пользователи', cards:'💳 Карты', invoices:'💰 Платежи' };
        return React.createElement('button', { key:t, onClick:function(){setTab(t);}, style: { padding:'8px 16px', fontSize:12, fontWeight:600, fontFamily:'inherit', border:'none', borderRadius:8, cursor:'pointer', background: tab===t ? '#0F1729' : '#F0F2F8', color: tab===t ? '#fff' : '#6B7280' } }, labels[t]);
      })
    ),

    // Статистика
    tab === 'stats' && stats && React.createElement('div', { style: { display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 } },
      React.createElement('div', { style: { background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,0.04)' } },
        React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:'0 0 4px', textTransform:'uppercase', fontWeight:700 } }, 'Пользователей'),
        React.createElement('p', { style: { fontSize:28, fontWeight:800, margin:0 } }, stats.users)
      ),
      React.createElement('div', { style: { background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,0.04)' } },
        React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:'0 0 4px', textTransform:'uppercase', fontWeight:700 } }, 'Активных карт'),
        React.createElement('p', { style: { fontSize:28, fontWeight:800, margin:0 } }, stats.cards)
      )
    ),

    // Пользователи
    tab === 'users' && React.createElement('div', null,
      users.map(function(u) {
        return React.createElement('div', { key:u.id, style: { background:'#fff', borderRadius:10, padding:'12px 14px', marginBottom:6, boxShadow:'0 1px 4px rgba(0,0,0,0.04)', display:'flex', justifyContent:'space-between', alignItems:'center' } },
          React.createElement('div', null,
            React.createElement('p', { style: { fontSize:14, fontWeight:600, margin:0 } }, u.first_name || '', ' ', u.last_name || '', u.username ? ' @'+u.username : ''),
            React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:'2px 0 0' } }, 'ID: ', u.id, ' · Last seen: ', u.last_seen)
          )
        );
      }),
      !users.length && React.createElement('p', { style: { color:'#9CA3AF', textAlign:'center', padding:20 } }, 'Нет пользователей')
    ),

    // Карты
    tab === 'cards' && React.createElement('div', null,
      cards.map(function(c) {
        return React.createElement('div', { key:c.id, style: { background:'#fff', borderRadius:10, padding:'12px 14px', marginBottom:6, boxShadow:'0 1px 4px rgba(0,0,0,0.04)', display:'flex', justifyContent:'space-between', alignItems:'center', opacity: c.is_active ? 1 : 0.5 } },
          React.createElement('div', null,
            React.createElement('p', { style: { fontSize:13, fontWeight:600, margin:0 } }, '•••• ', c.card_pan.slice(-4), ' · ', c.region || '—'),
            React.createElement('p', { style: { fontSize:11, color:'#9CA3AF', margin:'2px 0 0' } }, 'User: ', c.user_id, ' · ', c.ticket_description || '—', ' · ', c.created_at)
          ),
          React.createElement('span', { style: { fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:10, background: c.is_active ? '#E5FBF0' : '#FEE4E2', color: c.is_active ? '#00A651' : '#F04438' } }, c.is_active ? 'Active' : 'Deleted')
        );
      }),
      !cards.length && React.createElement('p', { style: { color:'#9CA3AF', textAlign:'center', padding:20 } }, 'Нет карт')
    ),

    // Платежи
    tab === 'invoices' && React.createElement('div', null,
      invoices.map(function(inv) {
        var sc = { CREATED:'#F79009', PAID:'#00A651', CANCELED:'#F04438', FAILED:'#F04438', REFUNDED:'#6B7280' };
        var clr = sc[inv.status] || '#999';
        return React.createElement('div', { key:inv.id, style: { background:'#fff', borderRadius:10, padding:'12px 14px', marginBottom:8, boxShadow:'0 1px 4px rgba(0,0,0,0.04)', borderLeft:'3px solid '+clr } },
          React.createElement('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 } },
            React.createElement('span', { style: { fontSize:13, fontWeight:700 } }, '•••• ', inv.card_pan ? inv.card_pan.slice(-4) : '?', ' · ', (inv.amount/100), ' ₽'),
            React.createElement('span', { style: { fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:10, background:clr+'18', color:clr } }, inv.status)
          ),
          React.createElement('div', { style: { fontSize:11, color:'#6B7280', lineHeight:1.8 } },
            React.createElement('div', null, 'User: ', inv.user_id, ' · ', inv.created_at),
            inv.service_desc && React.createElement('div', null, 'Услуга: ', inv.service_desc),
            React.createElement('div', null,
              'ЮKassa: ', React.createElement('span', { style: { fontWeight:600, color: inv.yukassa_status === 'succeeded' ? '#00A651' : '#6B7280' } }, inv.yukassa_status || '—'),
              ' · Корона: ', React.createElement('span', { style: { fontWeight:600, color: inv.korona_status === 'OK' ? '#00A651' : '#6B7280' } }, inv.korona_status || '—')
            ),
            inv.error_message && React.createElement('div', { style: { color:'#F04438' } }, '⚠ ', inv.error_message)
          )
        );
      }),
      !invoices.length && React.createElement('p', { style: { color:'#9CA3AF', textAlign:'center', padding:20 } }, 'Нет платежей')
    )
  );
}
