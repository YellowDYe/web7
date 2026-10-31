import { useEffect, useRef, useState } from 'react';
import { Clock, ShieldAlert, ArrowLeft } from 'lucide-react';

const WARNING_THRESHOLD_MS = 2 * 60 * 1000;
const RETURN_DELAY_S = 6;

interface PaymentCountdownProps {
  deadline: number;
  paused: boolean;
  onLeave: () => void;
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function PaymentCountdown({ deadline, paused, onLeave }: PaymentCountdownProps) {
  const [now, setNow] = useState(() => Date.now());
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [returnIn, setReturnIn] = useState(RETURN_DELAY_S);
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = deadline - now;
  const expired = remaining <= 0 && !paused;
  const inWarning = remaining <= WARNING_THRESHOLD_MS && remaining > 0;
  const showWarning = inWarning && !warningDismissed && !paused;

  useEffect(() => {
    if (!expired) return;
    if (returnIn <= 0) {
      onLeaveRef.current();
      return;
    }
    const id = setTimeout(() => setReturnIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [expired, returnIn]);

  return (
    <>
      <div
        className={`mx-4 sm:mx-6 mt-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors duration-500 ${
          inWarning || remaining <= 0
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : 'bg-gray-50 border-gray-200 text-gray-700'
        }`}
        role="timer"
        aria-live="off"
      >
        <div className="flex items-center gap-2 text-sm">
          <Clock className={`w-4 h-4 shrink-0 ${inWarning ? 'text-amber-600 animate-pulse' : 'text-gray-500'}`} />
          <span>{paused ? 'Procesando tu pago...' : 'Tiempo para completar tu pago'}</span>
        </div>
        <span className="font-mono text-lg font-semibold tabular-nums">{formatRemaining(remaining)}</span>
      </div>

      {(showWarning || expired) && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="payment-timeout-title"
            aria-describedby="payment-timeout-desc"
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6"
          >
            <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${expired ? 'bg-red-50' : 'bg-amber-50'}`}>
              {expired ? <ShieldAlert className="h-6 w-6 text-red-600" /> : <Clock className="h-6 w-6 text-amber-600" />}
            </div>
            <h3 id="payment-timeout-title" className="text-center text-lg font-semibold text-gray-900">
              {expired ? 'Tu sesion de pago expiro' : 'Tu sesion de pago esta por expirar'}
            </h3>
            <p id="payment-timeout-desc" className="mt-2 text-center text-sm leading-relaxed text-gray-600">
              {expired
                ? `Por tu seguridad, cerramos esta sesion de pago. Tu pedido sigue guardado; te regresaremos a revisarlo en ${returnIn} segundos para que puedas pagar de nuevo.`
                : `Por tu seguridad, esta sesion de pago se cerrara en ${formatRemaining(remaining)}. Si no completas tu pago a tiempo, te regresaremos a revisar tu pedido. Tu pedido no se perdera.`}
            </p>
            <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
              {!expired && (
                <button
                  onClick={onLeave}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Volver a mi pedido
                </button>
              )}
              <button
                autoFocus
                onClick={expired ? onLeave : () => setWarningDismissed(true)}
                className="flex-1 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
              >
                {expired ? 'Volver a mi pedido ahora' : 'Continuar con mi pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
