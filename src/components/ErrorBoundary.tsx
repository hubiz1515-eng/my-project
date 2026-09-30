import { Component, type ReactNode } from 'react';

/** 하위 트리 렌더링 오류 시 화면 전체가 죽지 않도록 대체 UI 표시 */
export class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (__DEV__) console.warn('[ErrorBoundary]', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
