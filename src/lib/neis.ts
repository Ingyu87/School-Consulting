export type NeisSchoolInfo = {
  schoolName: string;
  educationOffice: string;
  districtOffice: string;
  address: string;
  location: string;
  schoolKind: string;
  establishment: string;
  coeducation: string;
  dayNight: string;
  homepage: string;
  phone: string;
  foundedDate: string;
};

export async function fetchNeisSchoolInfo(schoolName: string): Promise<NeisSchoolInfo> {
  const response = await fetch(`/api/neis-school-info?schoolName=${encodeURIComponent(schoolName)}`);
  if (!response.ok) {
    throw new Error((await response.text()) || `나이스 학교기본정보 조회 실패 (HTTP ${response.status})`);
  }
  return response.json() as Promise<NeisSchoolInfo>;
}

export function mapNeisToSchoolInfo(info: NeisSchoolInfo) {
  return {
    region: mapRegion(info.educationOffice || info.address || info.location),
    address: info.address,
    schoolLevel: mapSchoolLevel(info.schoolKind),
    establishment: mapEstablishment(info.establishment),
    schoolCharacter: mapSchoolCharacter(info.schoolKind),
    infrastructureNotes: [
      info.educationOffice && `관할 시도교육청: ${info.educationOffice}`,
      info.districtOffice && `관할 교육지원청: ${info.districtOffice}`,
      info.phone && `대표 전화: ${info.phone}`,
      info.homepage && `홈페이지: ${info.homepage}`,
      info.foundedDate && `개교기념일: ${info.foundedDate}`
    ]
      .filter(Boolean)
      .join("\n")
  };
}

function mapRegion(value: string) {
  if (value.includes("서울")) return "서울";
  if (value.includes("인천")) return "인천";
  if (value.includes("강원")) return "강원";
  if (value.includes("제주")) return "제주";
  return "";
}

function mapSchoolLevel(value: string) {
  if (value.includes("초")) return "초";
  if (value.includes("중")) return "중";
  if (value.includes("고")) return "고";
  if (value.includes("특수")) return "특수";
  return "";
}

function mapEstablishment(value: string) {
  if (value.includes("공립")) return "공립";
  if (value.includes("국립")) return "국립";
  if (value.includes("사립")) return "사립";
  return "";
}

function mapSchoolCharacter(value: string) {
  if (value.includes("특수")) return "특목";
  return "일반";
}
