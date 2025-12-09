"use client";

import { useMemo } from "react";
import { Typography } from "@/components/shared/typography";
import BottomSheet from "@/components/shared/ui/bottom-sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { useSidoList, useSigunguList } from "@/hooks/shared/useRegions";
import { cn } from "@/utils/shared/cn";
import type { ActivityApplicationFormData } from "./types";

/**
 * @description 바텀시트 타입
 */
export type PickerType =
  | "region"
  | "situation"
  | "source"
  | "motivation"
  | "terms";

interface ActivityPickerBottomSheetProps {
  /** 바텀시트 타입 */
  pickerType: PickerType | null;
  /** 열림/닫힘 상태 */
  isOpen: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 폼 데이터 */
  formData: ActivityApplicationFormData;
  /** 지역 선택 시 호출 */
  onRegionSelect?: (city: string, district: string) => void;
  /** 현재 상황 선택 시 호출 */
  onSituationSelect?: (value: string) => void;
  /** 참여 경로 선택 시 호출 */
  onSourceSelect?: (value: string) => void;
  /** 참여 동기 선택 시 호출 */
  onMotivationSelect?: (value: string) => void;
  /** 약관 동의 시 호출 */
  onTermsAgree?: () => void;
  /** 약관 동의 상태 변경 */
  onTermsCheckChange?: (checked: boolean) => void;
  /** 약관 동의 로딩 상태 */
  isTermsAgreeLoading?: boolean;
  /** 선택된 지역 코드 (region picker용) */
  selectedRegionCode?: string | null;
  /** 지역 코드 선택 핸들러 (region picker용) */
  onRegionCodeSelect?: (code: string | null) => void;
}

/**
 * @description 활동 신청 폼용 통합 바텀시트 컴포넌트
 * - 지역, 현재 상황, 참여 경로, 참여 동기, 약관 동의를 하나의 컴포넌트로 통합
 */
export const ActivityPickerBottomSheet = ({
  pickerType,
  isOpen,
  onClose,
  formData,
  onRegionSelect,
  onSituationSelect,
  onSourceSelect,
  onMotivationSelect,
  onTermsAgree,
  onTermsCheckChange,
  isTermsAgreeLoading = false,
  selectedRegionCode,
  onRegionCodeSelect,
}: ActivityPickerBottomSheetProps) => {
  // 바텀시트 제목
  const title = useMemo(() => {
    switch (pickerType) {
      case "region":
        return "지역을 선택해주세요";
      case "situation":
        return "현재 상황을 알려주세요";
      case "source":
        return "참여 경로를 알려주세요";
      case "motivation":
        return "참여 동기를 알려주세요";
      case "terms":
        return "서비스 이용약관 동의";
      default:
        return "";
    }
  }, [pickerType]);

  // 시도 목록 조회
  const { data: sidoList = [], isLoading: isLoadingSido } = useSidoList();

  // 선택된 시도 코드로 시군구 목록 조회
  const { data: sigunguList = [], isLoading: isLoadingSigungu } =
    useSigunguList(selectedRegionCode ?? null);

  // 지역 선택 바텀시트 컨텐츠
  const renderRegionContent = () => {
    // 로딩 중
    if (isLoadingSido) {
      return (
        <div className="flex items-center justify-center py-8">
          <Typography font="noto" variant="body2R" className="text-gray-400">
            지역 정보를 불러오는 중...
          </Typography>
        </div>
      );
    }

    // 선택된 시도 정보 찾기
    const selectedSido = sidoList.find(
      (sido) => sido.code === selectedRegionCode
    );

    // 시도에 구/군이 없는 경우 (세종특별자치시 등)
    const hasNoDistricts =
      selectedSido && sigunguList.length === 0 && !isLoadingSigungu;

    return (
      <div className="flex max-h-[60vh] gap-4 overflow-hidden">
        {/* 시/도 목록 */}
        <div className="flex-1 overflow-y-auto">
          {sidoList.map((sido) => {
            // 세종특별자치시는 구/군이 없으므로 바로 선택 가능
            const isSejong = sido.code === "29"; // 세종특별자치시 코드

            return (
              <button
                key={sido.code}
                onClick={() => {
                  onRegionCodeSelect?.(sido.code);
                  if (isSejong) {
                    onRegionSelect?.(sido.name, "");
                  }
                }}
                className={cn(
                  "w-full rounded-lg px-4 py-3 text-left transition-colors",
                  selectedRegionCode === sido.code
                    ? "bg-main-100 text-main-700"
                    : "bg-white text-gray-900 hover:bg-gray-50"
                )}
              >
                <Typography font="noto" variant="body2R">
                  {sido.name}
                </Typography>
              </button>
            );
          })}
        </div>
        {/* 구/군 목록 */}
        {selectedRegionCode && selectedSido && (
          <div className="flex-1 overflow-y-auto border-l border-gray-200 pl-4">
            {isLoadingSigungu ? (
              <div className="flex items-center justify-center py-8">
                <Typography
                  font="noto"
                  variant="body2R"
                  className="text-gray-400"
                >
                  구/군 정보를 불러오는 중...
                </Typography>
              </div>
            ) : hasNoDistricts ? (
              <div className="flex items-center justify-center py-8">
                <Typography
                  font="noto"
                  variant="body2R"
                  className="text-gray-400"
                >
                  구/군이 없습니다
                </Typography>
              </div>
            ) : sigunguList.length > 0 ? (
              sigunguList.map((sigungu) => (
                <button
                  key={sigungu.code}
                  onClick={() => {
                    onRegionSelect?.(selectedSido.name, sigungu.name);
                  }}
                  className="w-full rounded-lg bg-white px-4 py-3 text-left text-gray-900 transition-colors hover:bg-gray-50"
                >
                  <Typography font="noto" variant="body2R">
                    {sigungu.name}
                  </Typography>
                </button>
              ))
            ) : null}
          </div>
        )}
      </div>
    );
  };

  // 현재 상황 선택 바텀시트 컨텐츠
  const renderSituationContent = () => {
    const options = [
      "현재 학교를 다니고 있지 않아요",
      "자퇴를 고민 중이에요",
      "학업 중단 숙려제에 참여 중이에요",
      "과거 자퇴한 경험이 있어요",
      "학교를 다니고 있어요",
    ];

    return (
      <div className="space-y-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onSituationSelect?.(option)}
            className="flex w-full items-center justify-between rounded-lg bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50"
          >
            <Typography font="noto" variant="body2R">
              {option}
            </Typography>
            {formData.currentSituation === option && (
              <svg
                className="text-main-500 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </button>
        ))}
      </div>
    );
  };

  // 참여 경로 선택 바텀시트 컨텐츠
  const renderSourceContent = () => {
    const options = [
      "SNS(인스타그램, 블로그 등)",
      "포털 사이트 검색",
      "가족 추천(부모님, 친척 등)",
      "지인 추천(선생님, 친구 등)",
      "기관/센터 추천",
    ];

    return (
      <div className="space-y-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onSourceSelect?.(option)}
            className="flex w-full items-center justify-between rounded-lg bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50"
          >
            <Typography font="noto" variant="body2R">
              {option}
            </Typography>
            {formData.applicationSource === option && (
              <svg
                className="text-main-500 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </button>
        ))}
      </div>
    );
  };

  // 참여 동기 선택 바텀시트 컨텐츠
  const renderMotivationContent = () => {
    const options = [
      "새로운 습관을 만들고 싶어서",
      "일상을 좀 더 규칙적으로 관리하고 싶어서",
      "다른 참여자들과 교류하며 동기부여를 얻고싶어서",
      "나만의 변화를 기록하고싶어서",
      "추천을 받아 관심이 생겨서",
      "직접 입력하기",
    ];

    return (
      <div className="space-y-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onMotivationSelect?.(option)}
            className="flex w-full items-center justify-between rounded-lg bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50"
          >
            <Typography font="noto" variant="body2R">
              {option}
            </Typography>
            {formData.applicationMotivation === option && (
              <svg
                className="text-main-500 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </button>
        ))}
      </div>
    );
  };

  // 약관 동의 바텀시트 컨텐츠
  const renderTermsContent = () => (
    <>
      <div className="mb-6">
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={formData.agreedToTerms}
              onCheckedChange={(checked) =>
                onTermsCheckChange?.(checked === true)
              }
              className="data-[state=checked]:border-main-500 data-[state=checked]:bg-main-500 data-[state=checked]:text-white"
            />
            <Typography font="noto" variant="body2R">
              개인정보 제3자 제공 동의
            </Typography>
          </label>
          <a
            href="https://www.notion.so/youthvoice/2a845f524cd080d6ab97dd121d47e24b?source=copy_link#2a845f524cd080d0b276ca0f1769bdd5"
            target="_blank"
            rel="noopener noreferrer"
            className="text-main-500 underline"
          >
            <Typography font="noto" variant="body2R" className="text-main-500">
              보기
            </Typography>
          </a>
        </div>
      </div>
      <button
        onClick={onTermsAgree}
        disabled={!formData.agreedToTerms || isTermsAgreeLoading}
        className="bg-main-500 hover:bg-main-600 w-full rounded-lg px-4 py-3 text-white transition-colors disabled:bg-gray-300 disabled:hover:bg-gray-300"
      >
        <Typography font="noto" variant="body2M" className="text-white">
          {isTermsAgreeLoading ? "신청 중..." : "동의하기"}
        </Typography>
      </button>
    </>
  );

  // 컨텐츠 렌더링
  const renderContent = () => {
    switch (pickerType) {
      case "region":
        return renderRegionContent();
      case "situation":
        return renderSituationContent();
      case "source":
        return renderSourceContent();
      case "motivation":
        return renderMotivationContent();
      case "terms":
        return renderTermsContent();
      default:
        return null;
    }
  };

  if (!pickerType) {
    return null;
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <Typography as="h3" font="noto" variant="heading2B" className="mb-4">
        {title}
      </Typography>
      {renderContent()}
    </BottomSheet>
  );
};
