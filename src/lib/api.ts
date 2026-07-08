/** /api 함수 공통 호출. 로컬 vite 단독 실행처럼 API가 없는 환경이면 원인을 그대로 안내한다. */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error("네트워크 오류로 AI 서버에 연결하지 못했습니다. 인터넷 연결을 확인해주세요.");
  }

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 404 || text.trimStart().startsWith("<")) {
      throw new Error(
        "AI 서버(/api)를 찾을 수 없습니다. Vercel 배포 주소에서 사용하거나, 로컬에서는 `vercel dev`로 실행해야 AI 기능이 동작합니다."
      );
    }
    throw new Error(text || `AI 요청에 실패했습니다. (HTTP ${response.status})`);
  }

  return response.json() as Promise<T>;
}
