import React, { useState, useRef, useEffect } from 'react';
import { Box } from '../components/Shared';

export default function AddCard({ onBack, onAdded, bridge }) {
  const [val, setVal]       = useState('');
  const [loading, setLoad]  = useState(false);
  const [err, setErr]       = useState('');
  const ref = useRef(null);

  useEffect(() => { setTimeout(() => ref.current?.focus(), 200); }, []);

  const digits  = val.replace(/\D/g, '');
  const display = digits.replace(/(.{4})/g, '$1 ').trim();
  const valid   = digits.length === 19 && digits.indexOf('9643') === 0;

  function handleAdd() {
    if (digits.length !== 19) { setErr('Номер должен содержать 19 цифр'); bridge.error(); return; }
    if (digits.indexOf('9643') !== 0) { setErr('Номер должен начинаться с 9643'); bridge.error(); return; }
    setLoad(true); setErr('');
    bridge.haptic('medium');
    setTimeout(() => { setLoad(false); onAdded(digits); bridge.success(); }, 800);
  }

  function handleScan() {
    bridge.haptic();
    try {
      window.WebApp?.openCodeReader(false);
      window.WebApp?.onEvent('codeReaderResult', (data) => {
        if (data?.value) {
          const d = data.value.replace(/\D/g, '');
          if (d) setVal(d);
        }
      });
    } catch {}
  }

  var inputCls = 'ac-input' + (err ? ' error' : valid ? ' valid' : '');

  return (
    <div className="ac-wrap">
      <Box>
        <h2 className="ac-title">Добавить карту</h2>
        <p className="ac-subtitle">Введите 19-значный номер ЕТК или отсканируйте QR</p>

        <p className="ac-field-label">НОМЕР КАРТЫ</p>
        <div className="ac-input-row">
          <input
            ref={ref} value={display}
            onChange={e => { setVal(e.target.value); setErr(''); }}
            placeholder="9643" maxLength={23} inputMode="numeric"
            className={inputCls}
          />
          <button onClick={handleScan} className="ac-scan-btn">📷</button>
        </div>

        {err && <p className="ac-error-msg">{err}</p>}
        {valid && !err && <p className="ac-valid-msg">✓ Формат верный</p>}

        {/* Card preview */}
        <div className="ac-preview" style={{ opacity: digits.length > 0 ? 1 : 0.35 }}>
          <div className="ac-preview-circle" />
          <p className="ac-preview-label">ЕТК</p>
          <p className="ac-preview-pan">
            {digits.length > 0 ? display : '9643 •••• •••• •••• •••'}
          </p>
          <p className="ac-preview-desc">Единая транспортная карта</p>
        </div>

        <button onClick={handleAdd} disabled={loading || !valid} className="ac-submit-btn">
          {loading ? 'Проверяем...' : 'Добавить карту'}
        </button>
      </Box>
    </div>
  );
}
