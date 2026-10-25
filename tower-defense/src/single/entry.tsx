// 단일 HTML 빌드의 진입점 ('expo-router/entry' 를 대신한다 — metro.config.js 참고)
import { registerRootComponent } from 'expo';
import { SingleApp } from './SingleApp';

registerRootComponent(SingleApp);
