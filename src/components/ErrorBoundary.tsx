import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * 입력 내용은 450ms 간격으로 IndexedDB에 자동저장되므로, 렌더링 중 예기치 못한 오류가 나도
 * 새로고침만 하면 대부분 복구된다. 흰 화면 대신 새로고침 안내를 보여준다.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crashScreen">
        <div className="crashCard">
          <h1>화면을 표시하는 중 문제가 발생했습니다</h1>
          <p>입력한 내용은 자동저장되어 있습니다. 새로고침하면 대부분 복구됩니다.</p>
          <button className="button primary" onClick={() => window.location.reload()}>
            새로고침
          </button>
          <pre>{this.state.error.message}</pre>
        </div>
      </div>
    );
  }
}
