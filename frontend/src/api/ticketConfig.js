var _ticketMap = null;
var _canPay = null;
var DEFAULT_MAP = {
  purse: ['0110'],
  pack: ['0111','0112','0191','0192','0194','1196','0195','1098','1096','1094','1113','1114','0297','1056'],
  abonement: [],
  social: ['1156'],
  can_pay: ['0110','1156']
};

export async function loadTicketConfig() {
  try {
    var h = { 'Content-Type': 'application/json' };
    if (window.WebApp && window.WebApp.initData) h['X-Max-Init-Data'] = window.WebApp.initData;
    var r = await fetch('/api/config/tickets', { headers: h });
    if (r.ok) {
      var data = await r.json();
      _ticketMap = data;
      _canPay = data.can_pay || null;
      return data;
    }
  } catch (e) {}
  _ticketMap = DEFAULT_MAP;
  _canPay = DEFAULT_MAP.can_pay;
  return DEFAULT_MAP;
}

function getMap() { return _ticketMap || DEFAULT_MAP; }

export function isPayAllowed(ticketId) {
  var list = _canPay || (getMap().can_pay) || [];
  if (!list.length) return true;
  return list.indexOf(ticketId) !== -1;
}

export var KIND_CONFIG = {
  purse: {
    color:'#FF6B00', icon:'К', label:'Электронный кошелёк',
    showBalance:true, showTrips:false, showDates:true, showTicketDesc:true,
    payType:'replenish',
    replMin:1, replMax:2800, replPresets:[200,500,1000,1500], replDynMax:true,
  },
  pack: {
    color:'#FF6B00', icon:'П', label:'Пакет пополнения',
    showBalance:false, showTrips:true, showDates:false, showTicketDesc:true,
    payType:'service',
    replMin:0, replMax:0, replPresets:[], replDynMax:false,
  },
  counter: {
    color:'#1B6EF3', icon:'С', label:'Счётчик поездок',
    showBalance:false, showTrips:true, showDates:true, showTicketDesc:true,
    payType:'none',
    replMin:0, replMax:0, replPresets:[], replDynMax:false,
  },
  abonement: {
    color:'#7C3AED', icon:'А', label:'Абонемент',
    showBalance:false, showTrips:false, showDates:true, showTicketDesc:true,
    payType:'service',
    replMin:0, replMax:0, replPresets:[], replDynMax:false,
  },
  social: {
    color:'#00A651', icon:'Л', label:'Социальная карта',
    showBalance:true, showTrips:true, showDates:true, showTicketDesc:true,
    payType:'replenish',
    replMin:1, replMax:2800, replPresets:[200,500,1000,1500], replDynMax:true,
  },
};

export var DEFAULT_KIND = 'purse';

export function resolveKind(status, cardFlags) {
  if (!status) return DEFAULT_KIND;
  cardFlags = cardFlags || {};
  var tr = status.ticket_rule || {};
  var ci = status.card_info || {};
  var ta = status.transport_application || {};
  var ticketId = tr.ticket_id || '';
  var ticketType = ta.ticket_type;
  var es = status.extra_services || {};
  var map = getMap();
  if (ticketId) {
    if (map.social && map.social.indexOf(ticketId) !== -1) return 'social';
    if (map.abonement && map.abonement.indexOf(ticketId) !== -1) return 'abonement';
    if (map.pack && map.pack.indexOf(ticketId) !== -1) return 'pack';
    if (map.purse && map.purse.indexOf(ticketId) !== -1) return 'purse';
  }
  if (ci.is_social_card || cardFlags.is_social_card) return 'social';
  if (ticketType === 1) return 'abonement';
  if (ticketType === 2) return 'counter';
  if (ticketType === 3 || ticketType === 4) {
    var hasPayments = (es.abonement && es.abonement.length > 0) ||
                      (es.counter && es.counter.length > 0) ||
                      (es.money_counter && es.money_counter.length > 0) ||
                      (es.day_counter && es.day_counter.length > 0);
    if (hasPayments) return 'pack';
    return 'purse';
  }
  return DEFAULT_KIND;
}

export function getKindConfig(kind) { return KIND_CONFIG[kind] || KIND_CONFIG[DEFAULT_KIND]; }

export function calcReplMax(cfg, balanceKopecks) {
  if (!cfg.replDynMax) return cfg.replMax;
  var balRub = Math.max(0, Math.round(balanceKopecks / 100));
  return Math.max(0, 2800 - balRub);
}
