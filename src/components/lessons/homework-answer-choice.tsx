/** A choice contains no answer key; checking uses the usual homework action. */
export function HomeworkAnswerChoice({
  choices, value, label, placeholder, disabled, className, onChoose,
}: {
  choices: string[];
  value: string;
  label: string;
  placeholder: string;
  disabled: boolean;
  className: string;
  onChoose: (value: string) => void;
}) {
  return (
    <select
      value={value}
      aria-label={label}
      disabled={disabled}
      className={className}
      onChange={(event) => onChoose(event.target.value)}
    >
      <option value="" disabled>{placeholder}</option>
      {value && !choices.includes(value) && <option value={value}>{value}</option>}
      {choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
    </select>
  );
}
