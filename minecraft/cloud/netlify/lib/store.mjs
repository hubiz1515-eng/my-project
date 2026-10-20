// Netlify Blobs 저장소. 배포 환경에서는 설정이 자동 주입되고, 로컬(dev-server)에서는 NETLIFY_BLOBS_CONTEXT 로 주입한다.
// 읽고 바로 쓰는 흐름(버전 비교)이 있어서 strong consistency 를 쓴다.
import { getStore } from '@netlify/blobs';

export const savesStore = () => getStore({ name: 'blockcraft-saves', consistency: 'strong' });
export const throttleStore = () => getStore({ name: 'blockcraft-admin-throttle', consistency: 'strong' });
export const tombStore = () => getStore({ name: 'blockcraft-tombs', consistency: 'strong' });   // 삭제된 닉네임의 마지막 버전 (번호가 되돌아가지 않게)

/**
 * Blobs 조건부 쓰기(onlyIfNew/onlyIfMatch)의 결과가 '정말 성공'인지 판단한다.
 * 라이브러리는 조건이 있을 때 412 만 modified:false 로 돌려주고 401/403/409/413/429/5xx 는 모두 modified:true 로 보고한다.
 * 그래서 성공 응답에 붙어 오는 etag 가 있어야 성공으로 본다 (없으면 호출한 쪽이 다시 읽어서 확인).
 */
export const writeLanded = (res) => !!res && res.modified === true && !!res.etag;
