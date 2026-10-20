// 테스트에서만: @netlify/blobs 가 5xx/429 에 5초씩 기다리며 재시도하는 것을 1ms 로 줄인다.
// (이 값은 라이브러리를 불러올 때 정해지므로, 테스트 파일에서 다른 import 보다 먼저 불러와야 한다)
process.env.NODE_ENV = 'test';
