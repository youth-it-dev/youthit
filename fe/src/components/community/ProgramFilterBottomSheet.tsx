"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import BottomSheet from "@/components/shared/ui/bottom-sheet";
import Icon from "@/components/shared/ui/icon";
import { IMAGE_URL } from "@/constants/shared/_image-url";
import { cn } from "@/utils/shared/cn";
import { Typography } from "../shared/typography";

export type ProgramSortOption = "latest" | "popular";
export type ProgramStateFilter = "all" | "ongoing" | "finished";
export type ProgramCategoryFilter = "TMI" | "한끗루틴" | "월간소모임";

interface ProgramFilterBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (values: {
    sort: ProgramSortOption;
    programState: ProgramStateFilter;
    categories: ProgramCategoryFilter[];
  }) => void;
  selectedSort: ProgramSortOption;
  selectedProgramState: ProgramStateFilter;
  selectedCategories: ProgramCategoryFilter[];
}

const PROGRAM_SORT_OPTIONS: { id: ProgramSortOption; label: string }[] = [
  { id: "latest", label: "최신순" },
  { id: "popular", label: "인기순" },
];

const PROGRAM_STATE_OPTIONS: {
  id: ProgramStateFilter;
  label: string;
}[] = [
  { id: "all", label: "전체" },
  { id: "ongoing", label: "진행중" },
  { id: "finished", label: "종료됨" },
];

const PROGRAM_CATEGORY_OPTIONS: {
  id: ProgramCategoryFilter;
  label: string;
}[] = [
  { id: "TMI", label: "TMI" },
  { id: "한끗루틴", label: "한끗루틴" },
  { id: "월간소모임", label: "월간 소모임" },
];

const RadioIndicator = ({ isActive }: { isActive: boolean }) => {
  return (
    <span
      className={cn(
        "flex size-5 items-center justify-center rounded-full border border-gray-300"
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          isActive ? "bg-main-500" : "bg-transparent"
        )}
      />
    </span>
  );
};

const CategoryCheckbox = ({ isChecked }: { isChecked: boolean }) => {
  return (
    <span
      className={cn(
        "flex size-5 items-center justify-center rounded-[2px] border text-white",
        isChecked
          ? "border-main-500 bg-main-500"
          : "border-gray-300 bg-white text-transparent"
      )}
    >
      <Check className="size-3" strokeWidth={3} />
    </span>
  );
};

const ProgramFilterBottomSheet = ({
  isOpen,
  onClose,
  onApply,
  selectedCategories,
  selectedProgramState,
  selectedSort,
}: ProgramFilterBottomSheetProps) => {
  const [tempSort, setTempSort] = useState<ProgramSortOption>(selectedSort);
  const [tempProgramState, setTempProgramState] =
    useState<ProgramStateFilter>(selectedProgramState);
  const [tempCategories, setTempCategories] =
    useState<ProgramCategoryFilter[]>(selectedCategories);

  useEffect(() => {
    if (!isOpen) return;
    setTempSort(selectedSort);
    setTempProgramState(selectedProgramState);
    setTempCategories(selectedCategories);
  }, [isOpen, selectedSort, selectedProgramState, selectedCategories]);

  const handleRadioKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    callback: () => void
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      callback();
    }
  };

  const handleCategoryToggle = (category: ProgramCategoryFilter) => {
    setTempCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((item) => item !== category);
      }
      return [...prev, category];
    });
  };

  const handleReset = () => {
    setTempSort("latest");
    setTempProgramState("all");
    setTempCategories([]);
  };

  const handleApply = () => {
    onApply({
      sort: tempSort,
      programState: tempProgramState,
      categories: tempCategories,
    });
  };

  const categoryLabel = useMemo(
    () =>
      PROGRAM_CATEGORY_OPTIONS.reduce<Record<ProgramCategoryFilter, string>>(
        (acc, option) => {
          acc[option.id] = option.label;
          return acc;
        },
        {} as Record<ProgramCategoryFilter, string>
      ),
    []
  );

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} enableDrag>
      <div className="space-y-8">
        {/* 스크롤 가능한 필터 옵션 영역 */}
        <div className="flex-1 space-y-8 overflow-y-auto">
          <section className="space-y-3">
            <p className="text-sm font-semibold text-gray-900">정렬</p>
            <div className="space-y-2">
              {PROGRAM_SORT_OPTIONS.map((option) => {
                const isActive = tempSort === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    tabIndex={0}
                    onClick={() => setTempSort(option.id)}
                    onKeyDown={(event) =>
                      handleRadioKeyDown(event, () => setTempSort(option.id))
                    }
                    className="focus-visible:ring-main-500 flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <RadioIndicator isActive={isActive} />
                    <Typography
                      font="noto"
                      variant="body2M"
                      className="text-gray-900"
                    >
                      {option.label}
                    </Typography>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-semibold text-gray-900">프로그램 상태</p>
            <div className="space-y-2">
              {PROGRAM_STATE_OPTIONS.map((option) => {
                const isActive = tempProgramState === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    tabIndex={0}
                    onClick={() => setTempProgramState(option.id)}
                    onKeyDown={(event) =>
                      handleRadioKeyDown(event, () =>
                        setTempProgramState(option.id)
                      )
                    }
                    className="focus-visible:ring-main-500 flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <RadioIndicator isActive={isActive} />
                    <Typography
                      font="noto"
                      variant="body2M"
                      className="text-gray-900"
                    >
                      {option.label}
                    </Typography>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-semibold text-gray-900">카테고리</p>
            <div className="grid gap-2">
              {PROGRAM_CATEGORY_OPTIONS.map((option) => {
                const isChecked = tempCategories.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    tabIndex={0}
                    onClick={() => handleCategoryToggle(option.id)}
                    onKeyDown={(event) =>
                      handleRadioKeyDown(event, () =>
                        handleCategoryToggle(option.id)
                      )
                    }
                    className="focus-visible:ring-main-500 flex w-full items-center gap-3 rounded-2xl px-4 py-3 focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <CategoryCheckbox isChecked={isChecked} />
                    <Typography
                      font="noto"
                      variant="body2M"
                      className="text-gray-900"
                    >
                      {categoryLabel[option.id]}
                    </Typography>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <div className="pb-safe sticky bottom-0 z-10 mt-2 flex shrink-0 items-center gap-3 border-t border-gray-100 bg-white pt-5">
        <button
          type="button"
          onClick={handleReset}
          className="flex min-w-[112px] items-center justify-center gap-2 rounded-lg border border-gray-100 bg-white px-5 py-3 text-sm font-semibold text-gray-900"
        >
          <Icon
            src={IMAGE_URL.ICON.refresh.url}
            aria-hidden="true"
            width={18}
            height={18}
          />
          <Typography font="noto" variant="body2M">
            초기화
          </Typography>
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="bg-main-500 flex flex-1 items-center justify-center rounded-lg px-5 py-3 text-white"
        >
          <Typography font="noto" variant="body1B">
            적용
          </Typography>
        </button>
      </div>
    </BottomSheet>
  );
};

export default ProgramFilterBottomSheet;
