// Netlify Blobs 저장소. 배포 환경에서는 설정이 자동 주입되고, 로컬(dev-server)에서는 NETLIFY_BLOBS_CONTEXT 로 주입한다.
// 읽고 바로 쓰는 흐름(버전 비교)이 있어서 strong consistency 를 쓴다.
import { getStore } from '@netlify/blobs';

export const savesStore = () => getStore({ name: 'blockcraft-saves', consistency: 'strong' });
export const throttleStore = () => getStore({ name: 'blockcraft-admin-throttle', consistency: 'strong' });
