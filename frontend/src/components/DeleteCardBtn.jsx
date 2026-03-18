import React, { useState } from 'react';
import * as api from '../api/client';

export default function DeleteCardBtn({ cardId, onDeleted, bridge }) {
  var _s = useState(false); var confirm = _s[0]; var setConfirm = _s[1];
  var _l = useState(false); var loading = _l[0]; var setLoading = _l[1];

  function handleClick() {
    if (!confirm) {
      setConfirm(true);
      bridge.haptic();
      setTimeout(function() { setConfirm(false); }, 4000);
      return;
    }
    setLoading(true);
    bridge.haptic('medium');
    api.deleteCard(cardId).then(function() {
      bridge.success();
      onDeleted();
    }).catch(function() {
      bridge.error();
      setLoading(false);
      setConfirm(false);
    });
  }

  return React.createElement('button', {
    onClick: handleClick,
    disabled: loading,
    style: {
      width:'auto', padding:'6px 0', fontSize:11, fontWeight:500,
      fontFamily:'inherit',
      color: confirm ? '#F04438' : '#9CA3AF',
      background: 'transparent',
      border: 'none',
      cursor:'pointer',
      opacity: loading ? 0.5 : 1,
      marginTop:4,
      display:'block',
      margin:'4px auto 0',
      textDecoration: confirm ? 'none' : 'underline',
      textDecorationColor: '#9CA3AF44',
    }
  }, loading ? 'Удаление...' : confirm ? '⚠️ Нажмите ещё раз для подтверждения' : 'Удалить карту');
}
