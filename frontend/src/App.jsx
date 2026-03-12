import React, { useState, useEffect, useCallback } from 'react';
import { useMaxBridge } from './hooks/useMaxBridge';
import { loadTicketConfig } from './api/ticketConfig';
import * as api from './api/client';
import CardList from './pages/CardList';
import AddCard from './pages/AddCard';
import CardDetail from './pages/CardDetail';
import TopUp from './pages/TopUp';
import BuyService from './pages/BuyService';
import YooKassa from './pages/YooKassa';
import Result from './pages/Result';
import Admin from './pages/Admin';

export default function App() {
  var bridge = useMaxBridge();
  var _scr = useState('cards'); var scr = _scr[0]; var setScr = _scr[1];
  var _cards = useState([]); var cards = _cards[0]; var setCards = _cards[1];
  var _card = useState(null); var card = _card[0]; var setCard = _card[1];
  var _amt = useState(0); var amt = _amt[0]; var setAmt = _amt[1];
  var _svc = useState(null); var svc = _svc[0]; var setSvc = _svc[1];
  var _load = useState(true); var loading = _load[0]; var setLoad = _load[1];
  var _err = useState(null); var error = _err[0]; var setError = _err[1];
  var _cfgReady = useState(false); var cfgReady = _cfgReady[0]; var setCfgReady = _cfgReady[1];

  useEffect(function() {
    loadTicketConfig().then(function() { setCfgReady(true); });
  }, []);

  var fetchCards = useCallback(async function() {
    setLoad(true); setError(null);
    try {
      var items = await api.getCards();
      var enriched = items.map(function(item) {
        return Object.assign({}, item, {
          n: item.card_pan,
          parsed: api.parseCardStatus(item.status, item),
        });
      });
      setCards(enriched);
    } catch (e) { setError(e.message); }
    finally { setLoad(false); }
  }, []);

  useEffect(function() {
    if (bridge.ready && cfgReady) fetchCards();
  }, [bridge.ready, cfgReady, fetchCards]);

  useEffect(function() {
    var backMap = { add:'cards', det:'cards', top:'det', buy:'det', pay:'det', adm:'cards' };
    var target = backMap[scr];
    if (!target) return;
    return bridge.back(true, function() { setScr(target); });
  }, [scr, bridge]);

  function handleAdded(pan) {
    api.addCard(pan).then(function(nc) {
      setCards(function(prev) { return prev.concat([Object.assign({}, nc, { n:nc.card_pan, parsed:api.parseCardStatus(nc.status, nc) })]); });
      bridge.success();
    }).catch(function() { bridge.error(); });
    setScr('cards');
  }

  async function handleSelect(c) {
    setCard(c); setScr('det');
    try {
      var info = await api.getCardInfo(c.id);
      var parsed = api.parseCardStatus(info, c);
      setCard(function(prev) { return Object.assign({}, prev, { status:info, parsed:parsed||prev.parsed }); });
    } catch(e) {}
  }

  return (
    <div style={{ maxWidth:480, margin:'0 auto', background:'#F4F6FA', minHeight:'100dvh', fontFamily:"'Manrope',sans-serif", color:'#0F1729', display:'flex', flexDirection:'column' }}>
      <div style={{ flex:1, overflowY:'auto', overflowX:'hidden' }}>
        {scr==='cards' && <CardList cards={cards} loading={loading} error={error} onRefresh={fetchCards} onSelect={handleSelect} onAdd={function(){setScr('add');}} />}
        {scr==='add' && <AddCard onBack={function(){setScr('cards');}} onAdded={handleAdded} bridge={bridge} />}
        {scr==='det' && card && <CardDetail card={card} onBack={function(){setScr('cards');fetchCards();}} onTopUp={function(){setScr('top');}} onBuyService={function(){setScr('buy');}} bridge={bridge} />}
        {scr==='top' && card && <TopUp card={card} onBack={function(){setScr('det');}} onPay={function(a){setAmt(a);setSvc(null);setScr('pay');}} />}
        {scr==='buy' && card && <BuyService card={card} onBack={function(){setScr('det');}} onPay={function(a,s){setAmt(a);setSvc(s);setScr('pay');}} />}
        {scr==='pay' && card && <YooKassa card={card} amt={amt} svc={svc} onBack={function(){setScr('det');}} onDone={function(){setScr('res');}} bridge={bridge} />}
        {scr==='res' && card && <Result card={card} amt={amt} svc={svc} onDone={function(){setScr('cards');fetchCards();}} />}
        {scr==='adm' && <Admin onBack={function(){setScr('cards');}} bridge={bridge} />}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 20px 10px', background:'#F4F6FA', borderTop:'1px solid #E5E7EB' }}>
        <div style={{ width:32 }} />
        <div style={{ width:134, height:5, borderRadius:100, background:'#1C1C1E', opacity:0.15 }} />
        <button onClick={function(){setScr('adm');}} style={{ width:32, height:32, borderRadius:'50%', background:'#F0F2F8', border:'1px solid #E5E7EB', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:14, padding:0 }} title="Админка">📞</button>
      </div>
    </div>
  );
}
