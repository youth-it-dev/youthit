"use client";

import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Info, ListFilterIcon, RefreshCwIcon } from "lucide-react";
import * as Api from "@/api/generated/users-api";
import CommunityInfiniteScrollTrigger from "@/components/community/CommunityInfiniteScrollTrigger";
import ButtonBase from "@/components/shared/base/button-base";
import SingleSelectFilterButtons from "@/components/shared/SingleSelectFilterButtons";
import { Typography } from "@/components/shared/typography";
import BottomSheet from "@/components/shared/ui/bottom-sheet";
import { PeriodOptionButton } from "@/components/store/PeriodOptionButton";
import { usersKeys } from "@/constants/generated/query-keys";
import {
  ACTION_KEY,
  DELETION_ACTION_KEYS,
  EXPIRATION_DESCRIPTION_TEMPLATE,
  HISTORY_TYPE_LABEL,
  NADAUM_GUIDE_TEXT,
  PAGE_FILTER,
  CHANGE_TYPE,
} from "@/constants/store/_nadaum-history-constants";
import { NADAUM_HISTORY_FILTER_OPTIONS } from "@/constants/store/_nadaum-history-filter-options";
import { PERIOD_OPTIONS } from "@/constants/store/_nadaum-history-period-options";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import type { TGETUsersMeRewardsEarnedRes } from "@/types/generated/users-types";
import type { HistorySection, HistoryType } from "@/types/reward-history";
import type {
  PageFilterType,
  PeriodOption,
} from "@/types/store/_nadaum-history-types";
import { cn } from "@/utils/shared/cn";
import { formatDateWithDayKorean } from "@/utils/shared/date";
import { mapPageFilterToApiFilter } from "@/utils/store/map-api-filter";
import { periodToMonth } from "@/utils/store/period-to-month";

const PAGE_SIZE = 20;

/**
 * @description 나다움 내역 페이지
 */
const Page = () => {
  const [activeFilter, setActiveFilter] = useState<PageFilterType>(
    PAGE_FILTER.ALL
  );
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isPeriodFilterOpen, setIsPeriodFilterOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] =
    useState<PeriodOption>("thisMonth");
  const [appliedPeriod, setAppliedPeriod] = useState<PeriodOption>("thisMonth");

  const setTitle = useTopBarStore((state) => state.setTitle);
  const setRightSlot = useTopBarStore((state) => state.setRightSlot);
  const resetTopBar = useTopBarStore((state) => state.reset);

  // API 필터 매핑
  const apiFilter = mapPageFilterToApiFilter(activeFilter);
  const monthParam = periodToMonth(appliedPeriod);

  // 무한 스크롤 API 호출
  const {
    data: rewardsPagesData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<TGETUsersMeRewardsEarnedRes, Error>({
    queryKey: usersKeys.getUsersMeRewardsEarned({
      page: undefined,
      size: PAGE_SIZE,
      filter: apiFilter,
      month: monthParam,
    }),
    queryFn: async ({ pageParam }) => {
      const response = await Api.getUsersMeRewardsEarned({
        page: (pageParam as number) ?? 0,
        size: PAGE_SIZE,
        filter: apiFilter,
        month: monthParam,
      });
      return response.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage?.pagination?.hasNext) {
        const currentPage = lastPage.pagination.pageNumber ?? 0;
        return currentPage + 1;
      }
      return undefined;
    },
  });

  // 첫 페이지에서 availableRewards와 expiringThisMonth 가져오기
  const firstPage = rewardsPagesData?.pages?.[0];
  const availableNadaum = firstPage?.availableRewards ?? 0;
  const expiringNadaum = firstPage?.expiringThisMonth ?? 0;
  const period = firstPage?.period;

  // 모든 페이지의 history를 합치기
  const allHistory = useMemo(() => {
    if (!rewardsPagesData?.pages) return [];
    return rewardsPagesData.pages.flatMap((page) => page?.history ?? []);
  }, [rewardsPagesData]);

  // API 응답을 HistorySection[] 형태로 변환
  const historySections = useMemo(() => {
    if (!allHistory || allHistory.length === 0) {
      return [];
    }

    // 날짜별로 그룹화
    const groupedByDate = allHistory.reduce(
      (acc, item) => {
        if (!item.createdAt) return acc;

        const dateKey = formatDateWithDayKorean(item.createdAt);
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }

        // changeType에 따라 type 결정
        let type: HistoryType;
        let label: string;
        let description: string | undefined;

        if (item.changeType === CHANGE_TYPE.ADD) {
          type = PAGE_FILTER.EARN;
          label = HISTORY_TYPE_LABEL[PAGE_FILTER.EARN];
          // 소멸 예정일이 있으면 description 추가
          if (item.expiresAt && !item.isExpired) {
            const expirationDate = formatDateWithDayKorean(item.expiresAt);
            description = EXPIRATION_DESCRIPTION_TEMPLATE(expirationDate);
          }
        } else if (item.changeType === CHANGE_TYPE.DEDUCT) {
          // actionKey로 사용/소멸/삭제 구분
          const isDeletion = DELETION_ACTION_KEYS.includes(
            (item.actionKey as string) ?? ""
          );

          if (item.actionKey === ACTION_KEY.EXPIRATION) {
            type = PAGE_FILTER.EXPIRE;
            label = HISTORY_TYPE_LABEL[PAGE_FILTER.EXPIRE];
          } else if (isDeletion) {
            type = PAGE_FILTER.USE;
            label = "게시글/댓글 삭제";
          } else {
            type = PAGE_FILTER.USE;
            label = HISTORY_TYPE_LABEL[PAGE_FILTER.USE];
          }
        } else {
          // 기본값
          type = PAGE_FILTER.EARN;
          label = HISTORY_TYPE_LABEL[PAGE_FILTER.EARN];
        }

        acc[dateKey].push({
          id: item.id ?? "",
          title: item.reason ?? label,
          amount: item.amount ?? 0,
          type,
          label,
          description,
        });

        return acc;
      },
      {} as Record<string, HistorySection["items"]>
    );

    // Object.entries는 삽입 순서를 보장하므로 백엔드 정렬 순서가 유지됨
    return Object.entries(groupedByDate).map(([date, items]) => ({
      date,
      items,
    }));
  }, [allHistory]);

  const handlePeriodApply = () => {
    setAppliedPeriod(selectedPeriod);
    setIsPeriodFilterOpen(false);
  };

  const handlePeriodReset = () => {
    setSelectedPeriod("thisMonth");
  };

  useEffect(() => {
    const infoButton = (
      <button
        type="button"
        aria-label="나다움 안내"
        onClick={() => setIsGuideOpen(true)}
        className="flex items-center justify-center text-gray-950"
      >
        <Info className="h-5 w-5" />
      </button>
    );
    setTitle("나다움 내역");
    setRightSlot(infoButton);

    return () => {
      resetTopBar();
    };
  }, [setTitle, setRightSlot, resetTopBar]);

  return (
    <>
      <div className="min-h-screen bg-white">
        {/* 상단 고정 영역: 나다움 요약 + 필터 + 날짜 표시 */}
        <div className="sticky top-0 z-10 bg-white">
          {/* 나다움 요약 섹션 */}
          <section className="bg-white px-5 pt-16 pb-4">
            <div className="rounded-lg bg-gray-50">
              <div className="flex items-center justify-between border-b border-b-gray-100 px-4 py-3">
                <Typography
                  font="noto"
                  variant="label1M"
                  className="text-gray-600"
                >
                  사용 가능한 나다움
                </Typography>
                <Typography
                  font="noto"
                  variant="heading2B"
                  className="text-main-500 font-semibold"
                >
                  {availableNadaum}N
                </Typography>
              </div>
              <div className="flex items-center justify-between px-4 py-2">
                <Typography
                  font="noto"
                  variant="label2M"
                  className="text-gray-400"
                >
                  30일 이내 소멸 예정인 나다움
                </Typography>
                <Typography
                  font="noto"
                  variant="label1B"
                  className="text-gray-600"
                >
                  {expiringNadaum}N
                </Typography>
              </div>
            </div>
          </section>

          {/* 필터 섹션 */}
          <div>
            <div className="flex w-full items-center justify-between bg-white px-5 py-4">
              <SingleSelectFilterButtons
                selectedId={activeFilter}
                onSelect={setActiveFilter}
                options={NADAUM_HISTORY_FILTER_OPTIONS}
              />
              {/* 리스트 필터 */}
              <ButtonBase
                className="rounded-md border border-gray-100 p-2"
                onClick={() => {
                  setSelectedPeriod(appliedPeriod);
                  setIsPeriodFilterOpen(true);
                }}
              >
                <ListFilterIcon className="size-6 text-gray-800" />
              </ButtonBase>
            </div>
            {period?.startDate && period?.endDate && (
              <div className="px-5 py-2.5">
                <Typography
                  font="noto"
                  variant="body3M"
                  className="text-gray-400"
                >
                  {period.startDate} ~ {period.endDate}
                </Typography>
              </div>
            )}
          </div>
        </div>

        {/* 거래 내역 목록 */}
        <div className="">
          {isLoading ? (
            <div className="bg-white py-16 text-center">
              <Typography
                font="noto"
                variant="body2R"
                className="text-gray-400"
              >
                로딩 중...
              </Typography>
            </div>
          ) : historySections.length === 0 ? (
            <div className="bg-white py-16 text-center">
              <Typography
                font="noto"
                variant="body2R"
                className="text-gray-400"
              >
                해당 내역이 아직 없어요.
              </Typography>
            </div>
          ) : null}

          {historySections.map((section) => (
            <section
              key={section.date}
              className="flex flex-col border-t-5 border-t-gray-50"
            >
              <Typography
                font="noto"
                variant="body2M"
                className="px-5 py-5 text-gray-950"
              >
                {section.date}
              </Typography>
              <div className="divide-y divide-gray-50 border-t border-b border-gray-50">
                {section.items.map((item) => {
                  const originalItem = allHistory.find((h) => h.id === item.id);
                  const isExpired = originalItem?.isExpired ?? false;
                  const amount =
                    originalItem?.changeType === CHANGE_TYPE.ADD
                      ? `+ ${item.amount}N`
                      : `- ${item.amount}N`;
                  const amountColor =
                    item.type === "earn" ? "text-main-500" : "text-gray-500";
                  const detailText = item.description ?? item.label;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-5 py-5"
                    >
                      <div className="flex max-w-[65%] flex-col gap-3">
                        <Typography
                          font="noto"
                          variant="body2M"
                          className="text-gray-950"
                        >
                          {item.title}
                        </Typography>
                        <Typography
                          font="noto"
                          variant="label2R"
                          className="mt-1 text-gray-500"
                        >
                          {detailText}
                        </Typography>
                      </div>
                      <div className="text-right">
                        <Typography
                          font="noto"
                          variant="body2M"
                          className={cn(amountColor, isExpired && "opacity-50")}
                        >
                          {amount}
                        </Typography>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {/* 무한 스크롤 트리거 */}
          {hasNextPage && (
            <CommunityInfiniteScrollTrigger
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onLoadMore={() => fetchNextPage()}
            />
          )}

          {/* 로딩 중 표시 */}
          {isFetchingNextPage && (
            <div className="bg-white py-8 text-center">
              <Typography
                font="noto"
                variant="body2R"
                className="text-gray-400"
              >
                더 불러오는 중...
              </Typography>
            </div>
          )}
        </div>
      </div>

      {/* 나다움 가이드 바텀시트 */}
      <BottomSheet isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)}>
        <Typography
          font="noto"
          variant="heading2B"
          className="mt-5 mb-2.5 text-gray-950"
          as="h2"
          id="nadaum-guide-title"
        >
          나다움 가이드
        </Typography>
        <Typography
          font="noto"
          variant="body2R"
          className="pb-6 leading-6 whitespace-pre-line text-gray-950"
        >
          {NADAUM_GUIDE_TEXT}
        </Typography>
      </BottomSheet>

      {/* 조회 기간 필터 바텀시트 */}
      <BottomSheet
        isOpen={isPeriodFilterOpen}
        onClose={() => setIsPeriodFilterOpen(false)}
      >
        <div className="flex flex-col">
          <div className="flex flex-col gap-1.5 py-5">
            <div className="flex gap-1">
              {/* 제목 */}
              <Typography
                font="noto"
                variant="body3M"
                className="text-gray-700"
              >
                조회 기간
              </Typography>
              <Typography
                font="noto"
                variant="body3M"
                className="text-gray-400"
              >
                (최대 1년)
              </Typography>
            </div>

            {/* 기간 선택 버튼 그룹 */}
            <div className="flex flex-col gap-2">
              {/* 첫 번째 줄: 이번달, 1개월, 3개월 */}
              <div className="flex gap-3">
                {PERIOD_OPTIONS.slice(0, 3).map((option) => (
                  <PeriodOptionButton
                    key={option.value}
                    value={option.value}
                    label={option.label}
                    isSelected={selectedPeriod === option.value}
                    onClick={() => setSelectedPeriod(option.value)}
                  />
                ))}
              </div>

              {/* 두 번째 줄: 6개월, 1년 */}
              <div className="flex gap-2">
                {PERIOD_OPTIONS.slice(3).map((option) => (
                  <PeriodOptionButton
                    key={option.value}
                    value={option.value}
                    label={option.label}
                    isSelected={selectedPeriod === option.value}
                    onClick={() => setSelectedPeriod(option.value)}
                  />
                ))}
              </div>
            </div>

            {/* 하단 액션 버튼 그룹 */}
          </div>
          {/* border가 바텀시트 양 끝까지 가도록 음수 마진 사용 */}
          <div className="-mx-5 flex gap-2 border-t border-t-gray-100 px-5 py-3">
            {/* 초기화 버튼 */}
            <button
              type="button"
              onClick={handlePeriodReset}
              className="flex items-center justify-center gap-2 rounded-md border border-gray-100 bg-white px-7.5"
            >
              <RefreshCwIcon className="size-4 text-gray-950" />
              <Typography
                font="noto"
                variant="body2M"
                className="text-gray-950"
              >
                초기화
              </Typography>
            </button>

            {/* 적용 버튼 */}
            <button
              type="button"
              onClick={handlePeriodApply}
              className="bg-main-500 flex flex-1 items-center justify-center rounded-md py-2.5"
            >
              <Typography font="noto" variant="body1B" className="text-white">
                적용
              </Typography>
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
};

export default Page;
