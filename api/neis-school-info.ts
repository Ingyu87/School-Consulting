import { checkRateLimit } from "./_lib/rate-limit.js";

const NEIS_BASE_URL = "https://open.neis.go.kr/hub/schoolInfo";

export default async function handler(request: any, response: any) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).send("Method Not Allowed");
  }
  if (!checkRateLimit(request, response, "neis-school-info")) return;

  const apiKey = process.env.NEIS_API_KEY;
  if (!apiKey) {
    return response.status(500).send("NEIS_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const schoolName = String(request.query?.schoolName ?? "").trim();
  if (!schoolName) {
    return response.status(400).send("학교명을 입력해주세요.");
  }

  try {
    const url = new URL(NEIS_BASE_URL);
    url.searchParams.set("KEY", apiKey);
    url.searchParams.set("Type", "json");
    url.searchParams.set("pIndex", "1");
    url.searchParams.set("pSize", "10");
    url.searchParams.set("SCHUL_NM", schoolName);

    const neisResponse = await fetch(url);
    if (!neisResponse.ok) {
      return response.status(502).send(`나이스 API 호출 실패 (HTTP ${neisResponse.status})`);
    }

    const data = await neisResponse.json();
    const rows = data?.schoolInfo?.find((item: any) => Array.isArray(item?.row))?.row ?? [];
    if (!rows.length) {
      const message = data?.RESULT?.MESSAGE || "나이스 학교기본정보에서 학교를 찾지 못했습니다.";
      return response.status(404).send(message);
    }

    const exact = rows.find((row: any) => normalize(row?.SCHUL_NM) === normalize(schoolName));
    const row = exact ?? rows[0];

    return response.status(200).json({
      schoolName: row.SCHUL_NM ?? "",
      educationOffice: row.ATPT_OFCDC_SC_NM ?? "",
      districtOffice: row.JU_ORG_NM ?? "",
      address: row.ORG_RDNMA ?? row.ORG_RDNDA ?? "",
      location: row.LCTN_SC_NM ?? "",
      schoolKind: row.SCHUL_KND_SC_NM ?? "",
      establishment: row.FOND_SC_NM ?? "",
      coeducation: row.COEDU_SC_NM ?? "",
      dayNight: row.DGHT_SC_NM ?? "",
      homepage: row.HMPG_ADRES ?? "",
      phone: row.ORG_TELNO ?? "",
      foundedDate: row.FOAS_MEMRD ?? ""
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "나이스 학교기본정보 조회 중 오류가 발생했습니다.";
    return response.status(500).send(message);
  }
}

function normalize(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").trim();
}
