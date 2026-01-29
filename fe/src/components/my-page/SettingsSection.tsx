"use client";

import { ChevronRight } from "lucide-react";
import { Typography } from "@/components/shared/typography";
import Icon from "@/components/shared/ui/icon";
import { cn } from "@/utils/shared/cn";

interface SettingsItemProps {
  text: string;
  iconUrl?: string;
  onClick?: () => void;
  showArrow?: boolean;
  toggle?: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
  };
}

const SettingsItem = ({
  text,
  iconUrl,
  onClick,
  showArrow = false,
  toggle,
}: SettingsItemProps) => {
  const content = (
    <div className="flex w-full items-center justify-between px-5 py-6">
      <div className="flex items-center gap-5">
        {iconUrl && (
          <Icon
            src={iconUrl}
            width={24}
            height={24}
            className="text-gray-600"
          />
        )}
        <Typography font="noto" variant="body2M" className="text-black">
          {text}
        </Typography>
      </div>
      <div className="flex items-center gap-2">
        {toggle && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (toggle.disabled) return;
              toggle.onCheckedChange(!toggle.checked);
            }}
            disabled={toggle.disabled}
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors",
              toggle.checked ? "bg-main-500" : "bg-gray-300",
              toggle.disabled && "cursor-not-allowed opacity-50"
            )}
            role="switch"
            aria-checked={toggle.checked}
            aria-label={text}
            aria-disabled={toggle.disabled}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                toggle.checked ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        )}
        {showArrow && <ChevronRight className="text-gray-400" />}
      </div>
    </div>
  );

  if (toggle || !onClick) {
    return content;
  }

  return (
    <button
      onClick={onClick}
      className="w-full transition-colors hover:bg-gray-50"
    >
      {content}
    </button>
  );
};

interface SettingsSectionProps {
  title: string;
  items: SettingsItemProps[];
}

const SettingsSection = ({ title, items }: SettingsSectionProps) => {
  return (
    <div className="flex flex-col gap-2">
      {title && (
        <Typography
          as="h3"
          font="noto"
          variant="body2B"
          className="px-4 text-gray-500"
        >
          {title}
        </Typography>
      )}
      <div className="overflow-hidden rounded-2xl bg-white">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex h-[72px] items-center border-b border-gray-100 last:border-b-0"
          >
            <SettingsItem {...item} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettingsSection;
