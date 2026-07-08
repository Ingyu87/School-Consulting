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
import type { SchoolInfo } from "../types";
import { CheckGroup, FormArea, FormInput, RadioGroup } from "./fields";

export function SchoolInfoForm({ school, schoolName, onChange }: { school: SchoolInfo; schoolName: string; onChange: (patch: Partial<SchoolInfo>) => void }) {
  return (
    <section className="panel formPanel">
      <h2>Ⅱ. 학교 일반사항 및 인프라 현황</h2>
      <p className="formHint">심층면담지 Ⅱ장에 그대로 출력됩니다. 학교명은 진단 CSV에서 자동으로 채워집니다.</p>
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
