"use client";

import { useRouter } from "next/navigation";
import { Typography } from "@/components/shared/typography";
import BottomSheet from "@/components/shared/ui/bottom-sheet";
import Icon from "@/components/shared/ui/icon";
import { IMAGE_URL } from "@/constants/shared/_image-url";
import { useGetUsersMeParticipatingCommunities } from "@/hooks/generated/users-hooks";
import { cn } from "@/utils/shared/cn";

interface ProgramSelectBottomSheetProps {
  /** 바텀시트 열림/닫힘 상태 */
  isOpen: boolean;
  /** 바텀시트 닫기 핸들러 */
  onClose: () => void;
}

/**
 * @description 내가 참여중인 프로그램 선택 바텀시트
 * - useGetUsersMeParticipatingCommunities 훅을 사용하여 프로그램 목록 조회
 * - 프로그램 선택 시 /community/write 페이지로 이동하며 프로그램 정보 전달
 */
const ProgramSelectBottomSheet = ({
  isOpen,
  onClose,
}: ProgramSelectBottomSheetProps) => {
  const router = useRouter();

  // 내가 참여중인 커뮤니티 조회
  const { data: communitiesData } = useGetUsersMeParticipatingCommunities({
    enabled: isOpen, // 바텀시트가 열렸을 때만 조회
  });

  /**
   * 프로그램을 programStatus에 따라 분류하고 타입별로 그룹화하는 헬퍼 함수
   */
  const getProgramGroupsByStatus = (programStatus: "completed" | "ongoing") => {
    return [
      {
        type: "routine",
        label: "한끗루틴",
        items:
          communitiesData?.routine?.items?.filter(
            (item) =>
              (item as { status?: string; programStatus?: string }).status ===
                "approved" &&
              (item as { programStatus?: string }).programStatus ===
                programStatus
          ) || [],
      },
      {
        type: "gathering",
        label: "월간 소모임",
        items:
          communitiesData?.gathering?.items?.filter(
            (item) =>
              (item as { status?: string; programStatus?: string }).status ===
                "approved" &&
              (item as { programStatus?: string }).programStatus ===
                programStatus
          ) || [],
      },
      {
        type: "tmi",
        label: "TMI",
        items:
          communitiesData?.tmi?.items?.filter(
            (item) =>
              (item as { status?: string; programStatus?: string }).status ===
                "approved" &&
              (item as { programStatus?: string }).programStatus ===
                programStatus
          ) || [],
      },
    ].filter((group) => group.items.length > 0); // 아이템이 있는 그룹만 표시
  };

  // 완료한 프로그램 그룹
  const completedProgramGroups = getProgramGroupsByStatus("completed");
  // 참여중인 프로그램 그룹
  const ongoingProgramGroups = getProgramGroupsByStatus("ongoing");

  /**
   * 프로그램 선택 핸들러
   * 선택한 프로그램 정보를 쿼리 파라미터로 전달하여 작성 페이지로 이동
   */
  const handleProgramSelect = (
    programId: string,
    programName: string,
    category: string,
    isReview: boolean = false
  ) => {
    onClose();
    // 쿼리 파라미터로 프로그램 정보 전달 (isReview: true=후기, false=인증)
    router.push(
      `/community/write?communityId=${programId}&communityName=${encodeURIComponent(programName)}&category=${category}&isReview=${isReview}`
    );
  };

  /**
   * 프로그램 그룹 렌더링 헬퍼 함수
   */
  const renderProgramGroups = (
    groups: Array<{
      type: string;
      label: string;
      items: Array<{ id?: string; name?: string }>;
    }>,
    isReview: boolean
  ) => {
    if (groups.length === 0) return null;

    return (
      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <div key={group.type} className="flex flex-col gap-0">
            {/* 그룹 헤더 */}
            <Typography font="noto" variant="body3M" className="text-gray-700">
              {group.label}
            </Typography>

            {/* 그룹 아이템 목록 */}
            <div className="flex flex-col gap-0">
              {group.items.map((program, itemIndex) => (
                <button
                  key={program.id}
                  onClick={() => {
                    if (program.id && program.name) {
                      handleProgramSelect(
                        program.id,
                        program.name,
                        group.label,
                        isReview
                      );
                    }
                  }}
                  className={cn(
                    "flex w-full items-center justify-between border-b border-gray-100 px-0 py-4 transition-colors hover:bg-gray-50 active:bg-gray-100",
                    itemIndex === group.items.length - 1 && "border-b-0"
                  )}
                  aria-label={`${program.name} 선택`}
                >
                  <div className="flex flex-col items-start gap-1">
                    <Typography
                      font="noto"
                      variant="body2B"
                      className="text-gray-800"
                    >
                      {program.name}
                    </Typography>
                  </div>
                  <Icon
                    src={IMAGE_URL.ICON.settings.chevronRight.url}
                    width={20}
                    height={20}
                    className="text-gray-400"
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const hasCompletedPrograms = completedProgramGroups.length > 0;
  const hasOngoingPrograms = ongoingProgramGroups.length > 0;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} enableDrag>
      <div className="mt-5 flex flex-col">
        {/* 완료한 프로그램 후기 작성 섹션 */}
        {hasCompletedPrograms && (
          <>
            <div className="mb-8 flex gap-1">
              <Typography
                font="noto"
                variant="heading2B"
                className="text-gray-950"
              >
                완료한 프로그램
              </Typography>
              <Typography
                font="noto"
                variant="heading2B"
                className="text-gray-400"
              >
                후기 작성
              </Typography>
            </div>
            {renderProgramGroups(completedProgramGroups, true)}
          </>
        )}

        {/* 구분선 */}
        {hasCompletedPrograms && hasOngoingPrograms && (
          <div className="my-5 border-t border-gray-400" />
        )}

        {/* 참여중인 프로그램 인증 섹션 */}
        {hasOngoingPrograms && (
          <>
            <div className="mb-8 flex gap-1">
              <Typography
                font="noto"
                variant="heading2B"
                className="text-gray-950"
              >
                참여 중인 프로그램
              </Typography>
              <Typography
                font="noto"
                variant="heading2B"
                className="text-gray-400"
              >
                인증
              </Typography>
            </div>
            {renderProgramGroups(ongoingProgramGroups, false)}
          </>
        )}

        {/* 데이터가 없는 경우 */}
        {!hasCompletedPrograms && !hasOngoingPrograms && (
          <div className="flex flex-col items-center justify-center py-8">
            <Typography font="noto" variant="body2M" className="text-gray-500">
              참여 중인 프로그램이 없어요
            </Typography>
            <Typography
              font="noto"
              variant="body2R"
              className="mt-2 text-gray-400"
            >
              프로그램에 참여한 후 글을 작성할 수 있어요
            </Typography>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

export default ProgramSelectBottomSheet;
