"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import BottomSheet from "@/components/shared/ui/bottom-sheet";
import Icon from "@/components/shared/ui/icon";
import { IMAGE_URL } from "@/constants/shared/_image-url";
import { useGetMissionsCategories } from "@/hooks/generated/missions-hooks";
import { cn } from "@/utils/shared/cn";
import { Typography } from "../shared/typography";

export type MissionPostsSortOption = "latest" | "popular";

interface MissionPostsFilterBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (values: {
    sort: MissionPostsSortOption;
    categories: string[];
  }) => void;
  selectedSort: MissionPostsSortOption;
  selectedCategories: string[];
}

const MISSION_POSTS_SORT_OPTIONS: {
  id: MissionPostsSortOption;
  label: string;
}[] = [
  { id: "latest", label: "최신순" },
  { id: "popular", label: "인기순" },
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

const MissionPostsFilterBottomSheet = ({
  isOpen,
  onClose,
  onApply,
  selectedCategories,
  selectedSort,
}: MissionPostsFilterBottomSheetProps) => {
  const [tempSort, setTempSort] =
    useState<MissionPostsSortOption>(selectedSort);
  const [tempCategories, setTempCategories] =
    useState<string[]>(selectedCategories);

  const { data: categoriesResponse } = useGetMissionsCategories();

  const categoryOptions = useMemo(
    () => categoriesResponse?.categories ?? [],
    [categoriesResponse]
  );

  useEffect(() => {
    if (!isOpen) return;
    setTempSort(selectedSort);
    setTempCategories(selectedCategories);
  }, [isOpen, selectedSort, selectedCategories]);

  const handleRadioKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    callback: () => void
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      callback();
    }
  };

  const handleCategoryToggle = (category: string) => {
    setTempCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((item) => item !== category);
      }
      return [...prev, category];
    });
  };

  const handleReset = () => {
    setTempSort("latest");
    setTempCategories([]);
  };

  const handleApply = () => {
    onApply({
      sort: tempSort,
      categories: tempCategories,
    });
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} enableDrag>
      <div className="space-y-8">
        <section className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">정렬</p>
          <div className="space-y-2">
            {MISSION_POSTS_SORT_OPTIONS.map((option) => {
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
          <p className="text-sm font-semibold text-gray-900">카테고리</p>
          <div className="grid gap-2">
            {categoryOptions.map((category) => {
              const isChecked = tempCategories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  role="checkbox"
                  aria-checked={isChecked}
                  tabIndex={0}
                  onClick={() => handleCategoryToggle(category)}
                  onKeyDown={(event) =>
                    handleRadioKeyDown(event, () =>
                      handleCategoryToggle(category)
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
                    {category}
                  </Typography>
                </button>
              );
            })}
            {categoryOptions.length === 0 && (
              <Typography
                font="noto"
                variant="body2R"
                className="text-gray-400"
              >
                사용할 수 있는 카테고리가 없어요.
              </Typography>
            )}
          </div>
        </section>

        <div className="mt-2 flex items-center gap-3 border-t border-gray-100 pt-5">
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
      </div>
    </BottomSheet>
  );
};

export default MissionPostsFilterBottomSheet;
