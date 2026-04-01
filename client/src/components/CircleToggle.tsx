import styles from "./CircleToggle.module.css";

interface CircleToggleProps {
  checked: boolean;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function CircleToggle({
  checked,
  label,
  onClick,
  disabled = false,
  size = "sm",
  className = ""
}: CircleToggleProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={checked}
      disabled={disabled}
      onClick={onClick}
      className={`${styles.root} ${size === "xs" ? styles.xs : size === "sm" ? styles.sm : styles.md} ${checked ? styles.checked : ""} ${className}`}
    />
  );
}
