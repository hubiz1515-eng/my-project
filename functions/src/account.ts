import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { col, db } from './db';

/** 진행 중(환불·픽업이 끝나지 않은) 주문 상태 */
const ACTIVE_STATUSES = ['paid', 'accepted'];

/**
 * 회원 탈퇴.
 * - 진행 중인 주문(고객으로 산 것 / 사장님으로 받은 것)이 있으면 거부 → 먼저 취소·픽업 완료.
 * - 사장님: 매장과 상품을 삭제해 지도·목록에서 즉시 사라지게 한다.
 * - users/{uid}(푸시 토큰 포함)와 Auth 계정을 삭제한다.
 * - 주문·결제 내역(orders, checkouts)은 전자상거래법상 거래 기록 보존 의무(5년) 때문에 남긴다.
 *   주문에는 주문 시점 스냅샷(매장명·상품명·닉네임)만 있어 계정이 없어도 내역 표시에 문제없다.
 *
 * - 탈퇴 기록 account_deletions/{uid} 를 남긴다 (운영·분쟁 대응용). 개인정보(이메일·이름·전화)는
 *   즉시 파기 원칙에 따라 넣지 않고 uid·역할·시각·삭제 건수만 저장. 클라이언트는 읽기·쓰기 불가(규칙).
 *
 * 재인증(비밀번호 재확인)은 클라이언트가 호출 직전에 수행한다.
 */
export async function deleteAccount(uid: string) {
  const [asCustomer, asSeller] = await Promise.all([
    col.orders().where('customerId', '==', uid).where('status', 'in', ACTIVE_STATUSES).limit(1).get(),
    col.orders().where('storeOwnerId', '==', uid).where('status', 'in', ACTIVE_STATUSES).limit(1).get(),
  ]);
  if (!asCustomer.empty) {
    throw new HttpsError('failed-precondition', '진행 중인 주문이 있어요. 픽업하거나 취소한 뒤 탈퇴해 주세요.');
  }
  if (!asSeller.empty) {
    throw new HttpsError('failed-precondition', '처리하지 않은 손님 주문이 있어요. 픽업 완료 또는 거절한 뒤 탈퇴해 주세요.');
  }

  // 매장 상품 + 매장 + 프로필 (500건 단위 배치)
  const [items, profile, store] = await Promise.all([
    col.foodItems().where('ownerId', '==', uid).select().get(),
    col.users().doc(uid).get(),
    col.stores().doc(uid).get(),
  ]);
  const record: AccountDeletionDoc = {
    uid,
    role: (profile.get('role') as AccountDeletionDoc['role']) ?? 'unknown',
    deletedItemCount: items.size,
    hadStore: store.exists,
    deletedAt: FieldValue.serverTimestamp(),
  };
  // 기록을 먼저 남겨, 이후 단계가 실패해도 재시도 시 덮어쓰며 추적 가능
  await col.accountDeletions().doc(uid).set(record);

  const refs = [...items.docs.map((d) => d.ref), col.stores().doc(uid), col.users().doc(uid)];
  for (let i = 0; i < refs.length; i += 500) {
    const batch = db.batch();
    refs.slice(i, i + 500).forEach((r) => batch.delete(r));
    await batch.commit();
  }

  try {
    await getAuth().deleteUser(uid);
  } catch (e) {
    if ((e as { code?: string }).code !== 'auth/user-not-found') throw e;
  }
  logger.info('account deleted', { uid, deletedItems: items.size });
  return { deleted: true };
}

/** account_deletions/{uid} — 개인정보 없는 탈퇴 기록 */
export interface AccountDeletionDoc {
  uid: string;
  role: 'customer' | 'seller' | 'unknown';
  deletedItemCount: number;
  hadStore: boolean;
  deletedAt: FieldValue;
}
