import React from "react";
import Icon from "@/components/shared/ui/icon";
import { IMAGE_URL } from "@/constants/shared/_image-url";
import { cn } from "@/utils/shared/cn";

interface CommunitySearchBarProps {
  inputRef?: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  onSearchClick: () => void;
  hasFilterChanges?: boolean;
  onFilterClick?: () => void;
}

export const CommunitySearchBar = ({
  inputRef,
  value,
  onChange,
  onKeyDown,
  onBlur,
  placeholder = "관심있는 키워드를 검색해보세요.",
  onSearchClick,
  hasFilterChanges = false,
  onFilterClick,
}: CommunitySearchBarProps) => {
  return (
    <div className="my-3 flex items-center gap-[10px]">
      <div className="flex h-[40px] flex-1 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-gray-950 placeholder:text-gray-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={onSearchClick}
          aria-label="검색"
          className="flex items-center justify-center"
        >
          <Icon
            src={IMAGE_URL.ICON.search.url}
            aria-hidden="true"
            className="text-gray-800"
            width={20}
            height={20}
          />
        </button>
      </div>
      {onFilterClick && (
        <button
          type="button"
          onClick={onFilterClick}
          className={cn(
            "flex size-10 items-center justify-center rounded-[6px] border border-gray-100 transition-colors",
            hasFilterChanges
              ? "border-main-500 bg-main-50 text-main-500"
              : "border-gray-200 text-gray-700"
          )}
        >
          <Icon
            src={IMAGE_URL.ICON.filter.url}
            aria-hidden="true"
            className={hasFilterChanges ? "text-main-500" : "text-gray-700"}
            width={20}
            height={20}
          />
        </button>
      )}
    </div>
  );
};

export default CommunitySearchBar;
