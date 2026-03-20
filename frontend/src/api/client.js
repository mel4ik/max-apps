import { resolveKind, getKindConfig, calcReplMax, isPayAllowed } from './ticketConfig';

var API = '/api';

function headers() {
  var h = { 'Content-Type': 'application/json' };
  if (window.WebApp && window.WebApp.initData) h['X-Max-Init-Data'] = window.WebApp.initData;
  return h;
}

async function req(path, opts) {
  opts = opts || {};
  var r = await fetch(API + path, Object.assign({ headers: headers() }, opts));
  if (!r.ok) {
    var d = await r.json().catch(function() { return null; });
    throw new Error((d && d.detail) || 'Ошибка ' + r.status);
  }
  return r.json();
}

export async function getCards() { var d = await req('/cards'); return d.cards || []; }
export function addCard(pan) { return req('/cards', { method:'POST', body:JSON.stringify({ card_pan: pan }) }); }
export function deleteCard(id) { return req('/cards/' + id, { method:'DELETE' }); }
export function getCardInfo(id, force) { return req('/cards/' + id + '/info' + (force ? '?force=true' : '')); }
export function getTrips(id, page, size) { return req('/cards/' + id + '/trips?page=' + (page||0) + '&size=' + (size||20)); }
export function getReplenishments(id, page, size) { return req('/cards/' + id + '/replenishments?page=' + (page||0) + '&size=' + (size||20)); }

// Перевод type_operation
var OP_NAMES = {
  'REPLENISHMENT': 'Пополнение баланса',
  'MONEY_TRANSFER': 'Перевод на карту',
  'PURCHASE_TRANSFER': 'Покупка услуги',
  'PURCHASE_WITHDRAWAL': 'Списание за услугу',
  'PURCHASE_WRITE_OFF': 'Списание за услугу',
  'MONEY_WRITE_OFF': 'Списание средств',
  'PURCHASE': 'Покупка услуги',
  'REFUND': 'Возврат',
  'TRANSFER': 'Перевод',
  'WRITE_OFF': 'Списание',
};
export function translateOp(op) { return OP_NAMES[op] || op || 'Операция'; }

export function parseCardStatus(status, cardFlags) {
  if (!status) return null;
  var ci = status.card_info || {};
  var ta = status.transport_application || {};
  var counter = ta.counter || {};
  var ct = counter.counter_trips;
  var cm = counter.counter_money || {};
  var tr = status.ticket_rule || {};
  var es = status.extra_services || {};

  var kind = resolveKind(status, cardFlags || {});
  var cfg = getKindConfig(kind);
  var bal = cm.card_money_value || 0;

  // Поездки: из extra_services.counter[0] (как в PHP) или transport_application
  var tripsVal = null;
  var tripsEnd = null;
  if (es.counter && es.counter.length > 0 && es.counter[0].counter_value) {
    tripsVal = es.counter[0].counter_value;
    tripsEnd = es.counter[0].end_date || null;
  } else if (ct) {
    tripsVal = ct.counter_value || null;
  }
  var tripsMax = ct ? ct.counter_max_value : null;

  // Абонемент: из extra_services.abonement[] (как в PHP)
  var abonements = es.abonement || [];
  var hasActiveAbonement = abonements.length > 0;
  var abStart = null;
  var abEnd = null;
  var abDesc = '';

  if (hasActiveAbonement) {
    // PHP: first = end(array), last = reset(array) — берём первый и последний
    var sorted = abonements.slice().sort(function(a, b) {
      return new Date(a.start_date || 0) - new Date(b.start_date || 0);
    });
    abStart = sorted[0].start_date || null;
    abEnd = sorted[sorted.length - 1].end_date || null;
    abDesc = abonements[0].description || '';
  }

  // Услуги для покупки (из Informator — активные на карте)
  var svcs = [].concat(es.abonement||[], es.counter||[], es.money_counter||[], es.day_counter||[]);
  var dynReplMax = calcReplMax(cfg, bal);

  // Блокировка: только stop_list_status === 'BLOCKED' запрещает пополнение
  // WAIT_REPLENISHMENT — карта ждёт пополнения, это нормально
  var stopStatus = ci.stop_list_status || '';
  var isBlocked = stopStatus === 'BLOCKED';
  var showStopBadge = isBlocked;
  var canPay = isPayAllowed(tr.ticket_id) && !isBlocked;

  return {
    kind: kind, cfg: cfg,
    stop: showStopBadge,
    stopStatus: stopStatus,
    blocked: isBlocked,
    blockedReason: isBlocked ? 'BLOCKED' : null,
    bal: bal, currency: cm.counter_money_currency,
    trips: tripsVal || 0, tripsMax: tripsMax,
    tripsEnd: tripsEnd || null,
    hasActiveAbonement: hasActiveAbonement,
    abStart: abStart,
    abEnd: abEnd,
    abDesc: abDesc,
    ticketType: ta.ticket_type,
    label: tr.ticket_description || tr.short_description || cfg.label,
    ticketId: tr.ticket_id || null,
    svcs: svcs, dynReplMax: dynReplMax,
    canPay: canPay,
    stale: status._stale || false, source: status._source || 'unknown',
    cardImgUri: ci.card_img_uri || null,
    dateEnd: ci.card_expiration_date || null,
  };
}

// ─── Payment API ───

export function getOperations(cardId) {
  return req('/pay/cards/' + cardId + '/operations');
}

export function createReplenishment(cardId, amount, type) {
  return req('/pay/cards/' + cardId + '/replenish', {
    method: 'POST',
    body: JSON.stringify({ amount: amount, type: type || 'VALUE' }),
  });
}

export function createPurchase(cardId, serviceId, usedCounter) {
  return req('/pay/cards/' + cardId + '/purchase', {
    method: 'POST',
    body: JSON.stringify({ service_id: serviceId, used_counter_amount: usedCounter || 0 }),
  });
}

export function checkInvoiceStatus(invoiceId) {
  return req('/pay/invoices/' + invoiceId + '/status');
}
