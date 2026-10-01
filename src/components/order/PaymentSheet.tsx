import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { CheckoutResult } from '../../services/checkout';
import { buildPortOneRequest, isPortOneEnabled, type PaymentCustomer } from '../../services/payments';
import type { PaymentMethod } from '../../types/models';
import { MockPaymentSheet } from './MockPaymentSheet';
import { PortOnePayment } from './PortOnePayment';

interface Props {
  /** 서버가 확정한 결제 정보. null 이면 닫힘 */
  checkout: CheckoutResult | null;
  method: PaymentMethod;
  customer: PaymentCustomer;
  /** 결제창 성공 → 서버 확정(completeCheckout). 이 Promise 가 끝날 때까지 '확인 중' 표시 */
  onPaid: (paymentId: string) => Promise<void>;
  onFailed: (message: string) => void;
  onClose: () => void;
}

/** PortOne 설정이 있으면 실결제창(네이티브 SDK / 웹 SDK), 없으면 Mock 시트 */
export function PaymentSheet({ checkout, method, customer, onPaid, onFailed, onClose }: Props) {
  const [confirming, setConfirming] = useState(false);
  const portone = isPortOneEnabled(method);

  const request = useMemo(() => {
    if (!checkout || !portone) return null;
    const redirectUrl = Platform.OS === 'web' ? `${window.location.origin}/payment-complete` : undefined;
    return buildPortOneRequest(checkout, method, customer, redirectUrl);
  }, [checkout, portone, method, customer]);

  const handlePaid = useCallback(
    async (paymentId: string) => {
      setConfirming(true);
      try {
        await onPaid(paymentId);
      } finally {
        setConfirming(false);
      }
    },
    [onPaid],
  );

  if (!checkout) return null;
  if (!request) {
    return (
      <MockPaymentSheet
        visible
        paymentId={checkout.paymentId}
        amount={checkout.totalAmount}
        method={method}
        orderName={checkout.orderName}
        onClose={onClose}
        onPaid={handlePaid}
      />
    );
  }
  return <PortOnePayment request={request} onPaid={handlePaid} onFailed={onFailed} onClose={onClose} confirming={confirming} />;
}
