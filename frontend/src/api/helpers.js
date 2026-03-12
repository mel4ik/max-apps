// Суммы хранятся в копейках
export function fk(v) { return Math.round(v / 100).toLocaleString('ru-RU'); }
export function fkNum(v) { return Math.round(v / 100); }

export function sd(s) {
  if (!s) return '';
  var d = new Date(s);
  return d.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit' });
}

export function ft(s) {
  var d = new Date(s);
  var n = new Date();
  var t = d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
  if (d.toDateString() === n.toDateString()) return 'Сегодня, ' + t;
  return sd(s) + ', ' + t;
}

export const KIND_COLORS = { purse:'#FF6B00', counter:'#1B6EF3', abonement:'#7C3AED' };
export const KIND_ICONS  = { purse:'💰', counter:'🎫', abonement:'📅' };
export const STATUS_COLORS = { PAID:'#00A651', CANCELED:'#F04438', CREATED:'#F79009' };
