export function FormInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function FormArea({ label, value, onChange, placeholder, compact }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; compact?: boolean }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea className={compact ? "compactArea" : undefined} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function RadioGroup({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="choiceGroup">
        {options.map((option) => (
          <label className={`choice ${value === option ? "checked" : ""}`} key={option}>
            <input
              type="radio"
              name={label}
              checked={value === option}
              onChange={() => onChange(value === option ? "" : option)}
              onClick={() => value === option && onChange("")}
            />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}

export function CheckGroup({ label, options, values, onChange }: { label: string; options: readonly string[]; values: string[]; onChange: (values: string[]) => void }) {
  function toggle(option: string) {
    onChange(values.includes(option) ? values.filter((item) => item !== option) : [...values, option]);
  }
  return (
    <div className="field">
      <span>{label}</span>
      <div className="choiceGroup">
        {options.map((option) => (
          <label className={`choice ${values.includes(option) ? "checked" : ""}`} key={option}>
            <input type="checkbox" checked={values.includes(option)} onChange={() => toggle(option)} />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}
