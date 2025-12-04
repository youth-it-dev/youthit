import GrayCheckbox from "@/components/shared/GrayCheckbox";
import { Typography } from "../shared/typography";

interface MyCertificationToggleProps {
  id: string;
  checked: boolean;
  label: string;
  ariaLabel?: string;
  onChange: (checked: boolean) => void;
}

export function MyCertificationToggle({
  id,
  checked,
  label,
  ariaLabel,
  onChange,
}: MyCertificationToggleProps) {
  const handleContainerClick = () => {
    onChange(!checked);
  };

  return (
    <div
      className="flex w-fit cursor-pointer items-center gap-2 py-2"
      onClick={handleContainerClick}
    >
      <GrayCheckbox
        id={id}
        checked={checked}
        aria-label={ariaLabel ?? label}
        onCheckedChange={onChange}
      />
      <Typography font="noto" variant="label1M" className="text-gray-500">
        {label}
      </Typography>
    </div>
  );
}

export default MyCertificationToggle;
