import { serverTimestamp, updateDoc } from 'firebase/firestore';
import { userDoc } from '../config/collections';
import { LEGAL_DOCS, type LegalDocKey } from '../content/legal/documents';
import type { User } from '../types/models';

/** 가입·재동의 화면의 필수 동의 항목 (모두 필수 — 선택 항목은 아직 없음) */
export const CONSENT_ITEMS: { key: 'over14' | LegalDocKey; label: string; doc?: LegalDocKey }[] = [
  { key: 'over14', label: '만 14세 이상입니다' },
  { key: 'terms', label: '서비스 이용약관 동의', doc: 'terms' },
  { key: 'privacy', label: '개인정보 수집·이용 동의', doc: 'privacy' },
  { key: 'location', label: '위치기반서비스 이용약관 동의', doc: 'location' },
];

/** users/{uid}.agreements 에 저장할 값 (현재 문서 버전) */
export function currentAgreements() {
  return {
    termsVersion: LEGAL_DOCS.terms.version,
    privacyVersion: LEGAL_DOCS.privacy.version,
    locationVersion: LEGAL_DOCS.location.version,
    over14: true as const,
    agreedAt: serverTimestamp(),
  };
}

/** 동의 기록이 없거나, 동의한 뒤 개정된 문서 목록 (비어 있으면 재동의 불필요) */
export function outdatedDocs(profile: Pick<User, 'agreements'>): LegalDocKey[] {
  const a = profile.agreements;
  const agreed: Record<LegalDocKey, string | undefined> = {
    terms: a?.termsVersion,
    privacy: a?.privacyVersion,
    location: a?.locationVersion,
  };
  return (Object.keys(LEGAL_DOCS) as LegalDocKey[]).filter((k) => !agreed[k] || agreed[k]! < LEGAL_DOCS[k].version);
}

/** 재동의: 현재 버전으로 동의 기록 갱신 */
export async function acceptCurrentAgreements(uid: string) {
  await updateDoc(userDoc(uid), { agreements: currentAgreements(), updatedAt: serverTimestamp() });
}
