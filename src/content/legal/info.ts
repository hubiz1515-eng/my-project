/**
 * 약관·개인정보처리방침에 들어가는 사업자 정보.
 * ⚠️ 대괄호([…]) 값은 아직 정해지지 않은 자리표시자다. 출시 전에 모두 실제 값으로 바꿔야 하며,
 * 하나라도 남아 있으면 문서 화면 상단에 '초안' 경고가 표시된다 (hasPlaceholders).
 */
import { noShowPolicyText } from '../../../shared/policy';
import { APP_NAME } from '../../constants/brand';

export const LEGAL_INFO = {
  serviceName: APP_NAME,
  companyName: '[상호(법인명)]',
  ceo: '[대표자 성명]',
  businessNumber: '[사업자등록번호]',
  mailOrderNumber: '[통신판매업 신고번호]',
  locationBusinessNumber: '[위치기반서비스사업 신고번호]',
  address: '[사업장 주소]',
  supportPhone: '[고객센터 전화번호]',
  supportEmail: '[고객센터 이메일]',
  privacyOfficer: '[개인정보 보호책임자 성명·직책]',
  privacyOfficerContact: '[개인정보 보호책임자 연락처(이메일)]',
  locationOfficer: '[위치정보관리책임자 성명·직책]',
  /** 사장님 판매 수수료 등 이용요금 (정해지지 않음) */
  sellerFee: '[판매 수수료 정책]',
  /** 노쇼(픽업 마감까지 미방문) 처리 정책 (정해지지 않음) */
  noShowPolicy: '[노쇼(픽업 마감 시간까지 미방문) 시 환불 정책]',
} as const;

export const isPlaceholder = (v: string) => /\[[^\]]+\]/.test(v);
