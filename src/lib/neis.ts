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
