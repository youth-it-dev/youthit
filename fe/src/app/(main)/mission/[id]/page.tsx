"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import "react-notion-x/src/styles.css";
import MissionDetailActionBar from "@/components/mission/mission-detail-action-bar";
import MissionInfoBox from "@/components/mission/mission-info-box";
import MissionReviewCard from "@/components/mission/mission-review-card";
import MissionTag from "@/components/mission/mission-tag";
import { CustomImage, CustomPageLink } from "@/components/shared/notion";
import { Typography } from "@/components/shared/typography";
import AccordionItem from "@/components/shared/ui/accordion-item";
import DetailImage from "@/components/shared/ui/detail-image";
import HorizontalScrollContainer from "@/components/shared/ui/horizontal-scroll-container";
import Modal from "@/components/shared/ui/modal";
import ShareButton from "@/components/shared/ui/share-button";
import { Skeleton } from "@/components/ui/skeleton";
import { missionsKeys } from "@/constants/generated/query-keys";
import {
  DEFAULT_MODAL_CONTENT,
  MAX_MISSION_ERROR_MODAL,
  MAX_TITLE_LENGTH,
} from "@/constants/mission/_mission-constants";
import { LINK_URL } from "@/constants/shared/_link-url";
import {
  useGetMissionsById,
  useGetMissionsFaqsById,
  useGetMissionsPosts,
  usePostMissionsApplyById,
  usePostMissionsLikeById,
} from "@/hooks/generated/missions-hooks";
import useToggle from "@/hooks/shared/useToggle";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import { getTomorrow4AM59 } from "@/utils/shared/date";
import { getErrorStatus } from "@/utils/shared/error";
import { shareContent } from "@/utils/shared/share";
import { showToast } from "@/utils/shared/toast";

// NotionRenderer는 클라이언트 전용으로 렌더링하여 hydration 불일치 방지
const NotionRenderer = dynamic(
  () => import("react-notion-x").then((m) => m.NotionRenderer),
  { ssr: false }
);

/**
 * @description 미션 상세 페이지
 */
const Page = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams();
  const missionId = params.id as string;
  const setTitle = useTopBarStore((state) => state.setTitle);
  const setRightSlot = useTopBarStore((state) => state.setRightSlot);
  const resetTopBar = useTopBarStore((state) => state.reset);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // 미션 상세 조회 API
  const {
    data: missionResponse,
    isLoading,
    error,
  } = useGetMissionsById({
    request: { missionId },
  });

  const missionData = missionResponse?.mission;

  // 미션 FAQ 조회 API
  const { data: missionFaqsResponse } = useGetMissionsFaqsById({
    request: { missionId },
  });

  const missionFaqs = missionFaqsResponse?.faqs ?? [];

  // 미션 인증글 목록 조회 API
  const { data: postsResponse } = useGetMissionsPosts({
    request: {
      sort: "latest",
      missionId,
    },
  });

  const missionPosts = postsResponse?.posts || [];

  const [isLiked, setIsLiked] = useState(missionData?.isLiked || false);
  const [modalContent, setModalContent] = useState(DEFAULT_MODAL_CONTENT);
  const [isMaxMissionError, setIsMaxMissionError] = useState(false);
  const {
    isOpen: isConfirmModalOpen,
    open: openConfirmModal,
    close: closeConfirmModal,
  } = useToggle();

  // 미션 신청 API
  const { mutate: applyMission, isPending: isApplying } =
    usePostMissionsApplyById({
      onSuccess: () => {
        // 진행중인 미션 목록 쿼리 무효화하여 목록 갱신
        queryClient.invalidateQueries({
          queryKey: missionsKeys.getMissionsMe({}),
        });
        // 미션 통계 쿼리 무효화하여 통계 갱신
        queryClient.invalidateQueries({
          queryKey: missionsKeys.getMissionsStats,
        });
        closeConfirmModal();
        router.push(LINK_URL.MISSION);
      },
      onError: (error: unknown) => {
        const errorStatus = getErrorStatus(error);

        if (errorStatus === 409) {
          // 409 Conflict: 미션 최대 개수 초과
          setModalContent(MAX_MISSION_ERROR_MODAL);
          setIsMaxMissionError(true);
          if (!isConfirmModalOpen) {
            openConfirmModal();
          }
        } else {
          closeConfirmModal();
          showToast("미션 신청 중 오류가 발생했습니다. 다시 시도해주세요.");
        }
      },
    });

  // 미션 데이터의 isLiked 값으로 상태 초기화
  useEffect(() => {
    if (missionData?.isLiked !== undefined) {
      setIsLiked(missionData.isLiked);
    }
  }, [missionData?.isLiked]);

  // 미션 찜하기 mutation
  const { mutateAsync: likeMissionAsync, isPending: isLikePending } =
    usePostMissionsLikeById({
      onMutate: () => {
        // Optimistic update: 즉시 UI 업데이트
        const previousIsLiked = isLiked;
        const newIsLiked = !previousIsLiked;
        setIsLiked(newIsLiked);

        return { previousIsLiked };
      },
      onError: (error, _variables, context) => {
        // 에러 발생 시 롤백
        if (context) {
          setIsLiked(context.previousIsLiked);
        }
        showToast("찜하기 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
      },
      onSuccess: (response) => {
        // 성공 시 서버 응답으로 상태 업데이트
        if (response.data?.liked !== undefined) {
          setIsLiked(response.data.liked);
        }

        // 미션 상세 정보 쿼리 무효화하여 최신 데이터 반영
        queryClient.invalidateQueries({
          queryKey: missionsKeys.getMissionsById({ missionId }),
        });
        // 미션 목록 캐시 무효화하여 최신 데이터 반영
        queryClient.invalidateQueries({
          queryKey: missionsKeys.getMissions({}),
        });
      },
    });

  // TopBar 설정
  useEffect(() => {
    if (!missionData?.title) return;

    const missionTitle = missionData.title;
    const truncatedTitle =
      missionTitle.length > MAX_TITLE_LENGTH
        ? `${missionTitle.slice(0, MAX_TITLE_LENGTH)}...`
        : missionTitle;
    setTitle(truncatedTitle);

    const handleShare = async () => {
      const shareUrl =
        typeof window !== "undefined" ? window.location.href : "";
      const shareText = missionData.notes || missionTitle;

      await shareContent({
        title: missionTitle,
        text: shareText,
        url: shareUrl,
      });
    };

    setRightSlot(<ShareButton onClick={handleShare} />);

    return () => {
      resetTopBar();
    };
  }, [missionData, setTitle, setRightSlot, resetTopBar]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <Typography font="noto" variant="body2R" className="text-red-500">
          미션 정보를 불러오는 중 오류가 발생했습니다.
        </Typography>
      </div>
    );
  }

  if (isLoading || !missionData) {
    return (
      <div className="min-h-screen bg-white pt-12">
        <div className="space-y-6 p-4">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // 정보 박스 데이터 구성
  const infoItems = [
    {
      label: "신청 기간",
      value: missionData.isUnlimited
        ? "무제한"
        : missionData.applicationDeadline || "-",
    },
    {
      label: "인증 마감",
      value: "매일 새벽 4시 59분",
    },
    {
      label: "참여 대상",
      value: missionData.targetAudience || "-",
    },
  ];

  return (
    <div className="min-h-screen bg-white pt-12">
      {/* 메인 이미지 */}
      <DetailImage
        imageUrl={missionData.coverImage || "/imgs/mockup.jpg"}
        alt={missionData.title || "미션 이미지"}
      />
      <div className="flex flex-col gap-2 p-5 pb-12">
        {/* 미션 제목 */}
        <Typography
          as="h2"
          font="noto"
          variant="title5"
          className="text-gray-950"
        >
          {missionData.title || "-"}
        </Typography>
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
          <Typography font="noto" variant="body1B" className="text-gray-950">
            미션 소개
          </Typography>
          <Typography font="noto" variant="body3R" className="text-gray-950">
            {missionData.missionIntroduction || "-"}
          </Typography>
          {missionData.certificationMethod &&
            missionData.certificationMethod.length > 0 && (
              <>
                <Typography
                  font="noto"
                  variant="body1B"
                  className="text-gray-950"
                >
                  인증 방법
                </Typography>
                <div className="flex gap-1">
                  {missionData.certificationMethod.map((method, index) => (
                    <MissionTag key={index} tagName={method} />
                  ))}
                </div>
              </>
            )}
        </div>

        {/* 정보 박스 */}
        <MissionInfoBox items={infoItems} />
        {/* 하단 안내 문구 */}
        <Typography font="noto" variant="label2R" className="text-gray-400">
          {missionData.notes || "-"}
        </Typography>
      </div>

      <div className="border-t-8 border-b-8 border-t-gray-200 border-b-gray-200 bg-white px-5 py-10">
        <div className="flex flex-col gap-4">
          {/* TODO: 실제 미션 후기 컨텐츠로 교체 */}
          <div className="flex items-center justify-between">
            <Typography
              font="noto"
              variant="heading3B"
              className="text-gray-950"
            >
              미션에 참여한 인증글이에요!
            </Typography>
            <button
              className="flex items-center gap-1"
              onClick={() => router.push(LINK_URL.COMMUNITY_MISSION)}
            >
              <Typography
                font="noto"
                variant="body3R"
                className="text-main-500"
              >
                피드 보러가기
              </Typography>
              <ChevronRight className="text-main-500 size-3" />
            </button>
          </div>
          {/* y scroll layout */}
          <HorizontalScrollContainer
            className="-mx-5"
            containerClassName="flex gap-2 px-5"
            gradientColor="white"
          >
            {missionPosts.length > 0 ? (
              missionPosts.map((post) => (
                <MissionReviewCard
                  key={post.id}
                  imageUrl={post.preview?.thumbnail?.url || "/imgs/mockup2.jpg"}
                  imageAlt={post.title || "미션 인증글"}
                  title={post.title || "-"}
                  content={post.preview?.description || "-"}
                  onClick={() => {
                    if (post.id) {
                      router.push(`${LINK_URL.COMMUNITY_MISSION}/${post.id}`);
                    }
                  }}
                />
              ))
            ) : (
              <Typography
                font="noto"
                variant="body3R"
                className="px-5 text-gray-400"
              >
                아직 인증글이 없어요.
              </Typography>
            )}
          </HorizontalScrollContainer>
        </div>
      </div>
      <div className="flex flex-col">
        <Typography
          font="noto"
          variant="heading3B"
          className="border-b border-gray-200 px-5 pt-10 pb-5 text-gray-950"
        >
          자주 묻는 질문이에요!
        </Typography>
        {missionFaqs.length > 0 ? (
          missionFaqs.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            const isLast = index === missionFaqs.length - 1;

            return (
              <AccordionItem
                key={faq.id ?? index}
                title={faq.title ?? "-"}
                content={
                  faq.recordMap ? (
                    <div className="notion-page">
                      <NotionRenderer
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        recordMap={faq.recordMap as any}
                        fullPage={false}
                        darkMode={false}
                        forceCustomImages
                        components={{
                          Image: CustomImage,
                          PageLink: CustomPageLink,
                        }}
                      />
                    </div>
                  ) : (
                    "내용이 없습니다."
                  )
                }
                isOpen={isOpen}
                onToggle={() => setOpenFaqIndex(isOpen ? null : index)}
                isLast={isLast}
              />
            );
          })
        ) : (
          <div className="px-5 py-4">
            <Typography font="noto" variant="body2R" className="text-gray-500">
              아직 등록된 질문이 없습니다.
            </Typography>
          </div>
        )}
      </div>
      {/* 하단 액션 바 */}
      <MissionDetailActionBar
        deadline={getTomorrow4AM59()}
        isLiked={isLiked}
        isRecruiting={missionData.isRecruiting}
        onLikeClick={async () => {
          if (isLikePending) return;

          try {
            await likeMissionAsync({ missionId });
          } catch {
            // 에러는 onError에서 처리됨
          }
        }}
        onStartClick={() => {
          setModalContent({
            title: DEFAULT_MODAL_CONTENT.title,
            description: `${missionData.title}\n미션을 시작해 볼까요?`,
          });
          setIsMaxMissionError(false);
          openConfirmModal();
        }}
      />
      {/* 미션 시작 확인 모달 */}
      <Modal
        isOpen={isConfirmModalOpen}
        title={modalContent.title}
        description={modalContent.description || undefined}
        confirmText={
          isMaxMissionError ? "확인" : isApplying ? "신청 중..." : "시작하기"
        }
        cancelText={isMaxMissionError ? undefined : "취소"}
        onConfirm={() => {
          if (isMaxMissionError) {
            closeConfirmModal();
          } else {
            applyMission({ missionId });
          }
        }}
        onClose={() => {
          closeConfirmModal();
          setModalContent(DEFAULT_MODAL_CONTENT);
          setIsMaxMissionError(false);
        }}
        variant="primary"
      />
    </div>
  );
};

export default Page;
