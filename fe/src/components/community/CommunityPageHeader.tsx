"use client";

import React from "react";
import { CommunitySearchBar } from "@/components/community/CommunitySearchBar";
import CommunityTabs from "@/components/community/CommunityTabs";
import FilterChipsSection from "@/components/community/FilterChipsSection";
import { MyCertificationToggle } from "@/components/community/MyCertificationToggle";
import type { CommunityTab } from "@/types/community/_community-tabs-types";

type FilterChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

type CommunityPageHeaderProps = {
  activeTab: CommunityTab;
  searchQuery: string;
  onSearchInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onSearchBlur: () => void;
  onSearchClick: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  hasFilterChanges: boolean;
  onFilterClick: () => void;
  filterChips: FilterChip[];
  toggleSection?: {
    show: boolean;
    id: string;
    checked: boolean;
    label: string;
    ariaLabel?: string;
    onChange: (checked: boolean) => void;
  };
  searchPlaceholder?: string;
};

/**
 * @description 커뮤니티 페이지 헤더 컴포넌트
 * - CommunityTabs, CommunitySearchBar, FilterChipsSection, MyCertificationToggle을 포함
 */
const CommunityPageHeader = ({
  activeTab,
  searchQuery,
  onSearchInputChange,
  onSearchKeyDown,
  onSearchBlur,
  onSearchClick,
  searchInputRef,
  hasFilterChanges,
  onFilterClick,
  filterChips,
  toggleSection,
  searchPlaceholder,
}: CommunityPageHeaderProps) => {
  return (
    <div className="sticky top-0 z-40 border-b border-gray-100 bg-white px-5">
      <div className="relative">
        <CommunityTabs activeTab={activeTab} />
        <CommunitySearchBar
          inputRef={searchInputRef}
          value={searchQuery}
          onChange={onSearchInputChange}
          onKeyDown={onSearchKeyDown}
          onBlur={onSearchBlur}
          onSearchClick={onSearchClick}
          hasFilterChanges={hasFilterChanges}
          onFilterClick={onFilterClick}
          placeholder={searchPlaceholder}
        />
        <FilterChipsSection chips={filterChips} />
        {toggleSection?.show && (
          <MyCertificationToggle
            id={toggleSection.id}
            checked={toggleSection.checked}
            label={toggleSection.label}
            ariaLabel={toggleSection.ariaLabel}
            onChange={toggleSection.onChange}
          />
        )}
      </div>
    </div>
  );
};

export default CommunityPageHeader;
