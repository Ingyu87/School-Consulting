import { useState } from "react";
import {
  establishmentOptions,
  leadingSchoolOptions,
  regionOptions,
  schoolCharacterOptions,
  schoolLevelOptions,
  studentDeviceRatioOptions,
  teacherDeviceOptions,
  technicalIssueOptions
} from "../data/officialOptions";
import { fetchNeisSchoolInfo, type NeisSchoolInfo } from "../lib/neis";
import type { SchoolInfo } from "../types";
import { CheckGroup, FormArea, FormInput, RadioGroup } from "./fields";

export function SchoolInfoForm({
  school,
  schoolName,
  onChange
}: {
  school: SchoolInfo;
  schoolName: string;
  onChange: (patch: Partial<SchoolInfo>) => void;
}) {
  const [neisStatus, setNeisStatus] = useState("");
  const [isLoadingNeis, setIsLoadingNeis] = useState(false);

  async function loadNeisInfo() {
    if (!schoolName.trim()) {
      setNeisStatus("학교명이 있어야 나이스 학교기본정보를 조회할 수 있습니다.");
      return;
    }

    setIsLoadingNeis(true);
    setNeisStatus("나이스 학교기본정보 조회 중");
    try {
      const info = await fetchNeisSchoolInfo(schoolName);
      onChange(mapNeisToSchoolInfo(info));
      setNeisStatus(`${info.schoolName || schoolName} 학교기본정보를 반영했습니다.`);
    } catch (error) {
      setNeisStatus(error instanceof Error ? error.message : "나이스 학교기본정보 조회에 실패했습니다.");
    } finally {
      setIsLoadingNeis(false);
    }
  }

  return (
    <section className="panel formPanel">
      <div className="sectionToolbar">
        <div>
          <h2>Ⅱ. 학교 일반사항 및 인프라 현황</h2>
          <p className="formHint">심층면담지 Ⅱ장에 그대로 출력됩니다. 학교명은 진단 CSV에서 자동으로 채워집니다.</p>
        </div>
        <button className="button ghost" type="button" onClick={loadNeisInfo} disabled={isLoadingNeis}>
          {isLoadingNeis ? "조회 중" : "나이스 정보 불러오기"}
        </button>
      </div>
      {neisStatus && <div className="inlineStatus">{neisStatus}</div>}

      <div className="twoColumnFields">
        <FormInput label="학교명" value={schoolName} onChange={() => undefined} />
        <div className="field">
          <span>권역</span>
          <div className="choiceGroup">
            {regionOptions.map((option) => (
              <label className={`choice ${school.region === option ? "checked" : ""}`} key={option}>
                <input type="radio" name="권역" checked={school.region === option} onChange={() => onChange({ region: option })} />
                {option}
              </label>
            ))}
          </div>
        </div>
      </div>

      <FormInput label="소재지" value={school.address} onChange={(address) => onChange({ address })} />

      <div className="twoColumnFields">
        <RadioGroup label="학교급" options={schoolLevelOptions} value={school.schoolLevel} onChange={(schoolLevel) => onChange({ schoolLevel })} />
        <RadioGroup label="설립 구분" options={establishmentOptions} value={school.establishment} onChange={(establishment) => onChange({ establishment })} />
        <RadioGroup label="학교 유형" options={schoolCharacterOptions} value={school.schoolCharacter} onChange={(schoolCharacter) => onChange({ schoolCharacter })} />
        <RadioGroup label="선도학교" options={leadingSchoolOptions} value={school.leadingSchool} onChange={(leadingSchool) => onChange({ leadingSchool })} />
      </div>

      <div className="twoColumnFields">
        <FormInput label="교원 수" value={school.teacherCount} onChange={(teacherCount) => onChange({ teacherCount })} />
        <FormInput label="교직원 수" value={school.staffCount} onChange={(staffCount) => onChange({ staffCount })} />
        <FormInput label="학급 수" value={school.classCount} onChange={(classCount) => onChange({ classCount })} />
        <FormInput label="학생 수" value={school.studentCount} onChange={(studentCount) => onChange({ studentCount })} />
      </div>

      <CheckGroup
        label="교사용 기기 유형"
        options={teacherDeviceOptions}
        values={school.teacherDeviceTypes}
        onChange={(teacherDeviceTypes) => onChange({ teacherDeviceTypes })}
      />
      <FormInput label="교사용 기기 기타" value={school.teacherDeviceEtc} onChange={(teacherDeviceEtc) => onChange({ teacherDeviceEtc })} />
      <RadioGroup
        label="학생 1인당 기기 보급 비율"
        options={studentDeviceRatioOptions}
        value={school.studentDeviceRatio}
        onChange={(studentDeviceRatio) => onChange({ studentDeviceRatio })}
      />
      <CheckGroup
        label="기술적 애로사항"
        options={technicalIssueOptions}
        values={school.technicalIssues}
        onChange={(technicalIssues) => onChange({ technicalIssues })}
      />
      <FormInput label="기술적 애로사항 기타" value={school.technicalIssueEtc} onChange={(technicalIssueEtc) => onChange({ technicalIssueEtc })} />
      <FormArea
        label="디지털 교육 전환 관련 학교 예산 집행 현황"
        value={school.budgetStatus}
        onChange={(budgetStatus) => onChange({ budgetStatus })}
        compact
      />
      <FormArea
        label="기타 시설 및 인프라 관련 학교 특이사항"
        value={school.infrastructureNotes}
        onChange={(infrastructureNotes) => onChange({ infrastructureNotes })}
        compact
      />
    </section>
  );
}

function mapNeisToSchoolInfo(info: NeisSchoolInfo): Partial<SchoolInfo> {
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
