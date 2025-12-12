/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef, useLayoutEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useForm } from "react-hook-form";
import MissionCertificationStatusCard from "@/components/mission/mission-certification-status-card";
import ButtonBase from "@/components/shared/base/button-base";
import TextEditor from "@/components/shared/text-editor/index";
import { Typography } from "@/components/shared/typography";
import { LoadingOverlay } from "@/components/shared/ui/loading-overlay";
import Modal from "@/components/shared/ui/modal";
import SubmitButton from "@/components/shared/ui/submit-button";
import {
  MAX_FILES,
  WRITE_MESSAGES,
  ERROR_MESSAGES,
} from "@/constants/community/_write-constants";
import { LINK_URL } from "@/constants/shared/_link-url";
import { MIN_POST_TEXT_LENGTH } from "@/constants/shared/_post-constants";
import { useRequireAuth } from "@/hooks/auth/useRequireAuth";
import { usePostCommunitiesPostsById } from "@/hooks/generated/communities-hooks";
import useToggle from "@/hooks/shared/useToggle";
import { getCurrentUser } from "@/lib/auth";
import { useTopBarStore } from "@/stores/shared/topbar-store";
import type { WriteFormValues } from "@/types/community/_write-types";
import type * as CommunityTypes from "@/types/generated/communities-types";
import { hasAuthCookie, removeAuthCookie } from "@/utils/auth/auth-cookie";
import {
  replaceEditorFileHrefWithUploadedUrls,
  replaceEditorImageSrcWithUploadedUrls,
} from "@/utils/community/editor-content";
import {
  dedupeFiles,
  rollbackUploadedFiles,
  isHandledError,
} from "@/utils/community/file-utils";
import { uploadFileQueue } from "@/utils/community/upload-utils";
import {
  extractTextFromHtml,
  checkPostTextLength,
  hasImageInContent,
} from "@/utils/shared/text-editor";

/**
 * @description 커뮤니티 글 작성 페이지 콘텐츠 (useSearchParams 사용)
 */
const WritePageContent = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { mutate, isPending } = usePostCommunitiesPostsById();
  const [isAuthGuideOpen, setIsAuthGuideOpen] = useState(false);
  const {
    isOpen: isUploading,
    open: openUploading,
    close: closeUploading,
  } = useToggle();
  const {
    isOpen: isSuccessModalOpen,
    open: openSuccessModal,
    close: closeSuccessModal,
  } = useToggle();
  const {
    isOpen: isErrorModalOpen,
    open: openErrorModal,
    close: closeErrorModal,
  } = useToggle();
  const [successPostData, setSuccessPostData] = useState<{
    postId: string;
    communityId: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // 이미지 개수 초과 모달
  const {
    isOpen: isImageLimitModalOpen,
    open: openImageLimitModal,
    close: closeImageLimitModal,
  } = useToggle();

  // 파일 개수 초과 모달
  const {
    isOpen: isFileLimitModalOpen,
    open: openFileLimitModal,
    close: closeFileLimitModal,
  } = useToggle();

  // 이미지 업로드 부분 실패 모달
  const {
    isOpen: isImageUploadPartialModalOpen,
    open: openImageUploadPartialModal,
    close: closeImageUploadPartialModal,
  } = useToggle();
  const [imageUploadPartialMessage, setImageUploadPartialMessage] =
    useState<string>("");

  // 이미지 업로드 실패 모달
  const {
    isOpen: isImageUploadFailedModalOpen,
    open: openImageUploadFailedModal,
    close: closeImageUploadFailedModal,
  } = useToggle();

  // 이미지 URL 교체 실패 모달
  const {
    isOpen: isImageUrlReplaceFailedModalOpen,
    open: openImageUrlReplaceFailedModal,
    close: closeImageUrlReplaceFailedModal,
  } = useToggle();

  // 파일 업로드 실패 모달
  const {
    isOpen: isFileUploadFailedModalOpen,
    open: openFileUploadFailedModal,
    close: closeFileUploadFailedModal,
  } = useToggle();

  // 인증 체크: 로그인하지 않은 사용자는 로그인 페이지로 리다이렉트
  // returnTo를 명시하지 않으면 현재 경로 + 쿼리 파라미터가 자동으로 사용됨
  const { isReady, user } = useRequireAuth({
    redirectTo: LINK_URL.LOGIN,
  });

  // 쿼리 파라미터에서 프로그램 정보 가져오기
  const selectedCommunityId =
    searchParams.get("communityId") || "CP:VYTTZW33IH";
  const selectedCommunityName = searchParams.get("communityName") || "";
  const selectedCategory =
    searchParams.get("category") || "선택된 카테고리 없음";
  const isReview = searchParams.get("isReview") === "true";

  // 선택된 커뮤니티 ID가 있으면 사용, 없으면 기본값 사용
  const COMMUNITY_ID = selectedCommunityId;

  const { handleSubmit, setValue, getValues, watch, reset } =
    useForm<WriteFormValues>({
      defaultValues: {
        title: "",
        content: "",
        category: "한끗루틴",
        isPublic: false,
      },
      mode: "onChange",
    });

  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const allowLeaveCountRef = useRef(0);
  const setRightSlot = useTopBarStore((state) => state.setRightSlot);
  const setTitle = useTopBarStore((state) => state.setTitle);
  const resetTopBar = useTopBarStore((state) => state.reset);

  // 제출 시 일괄 업로드할 파일 큐 (a 태그 href 교체용)
  const [fileQueue, setFileQueue] = useState<
    Array<{ clientId: string; file: File }>
  >([]);
  // 제출 시 일괄 업로드할 이미지 큐 (clientId와 함께 보관)
  const [imageQueue, setImageQueue] = useState<
    Array<{ clientId: string; file: File }>
  >([]);

  // 이미지 파일은 TextEditor에서 업로드 콜백을 통해 즉시 처리합니다.

  /**
   * 이미지 선택 시 clientId를 발급/등록하고 반환 (즉시 업로드는 하지 않음)
   */
  const registerImage = (file: File): string => {
    const clientId = crypto.randomUUID();
    setImageQueue((prev) => {
      if (prev.length >= MAX_FILES) {
        openImageLimitModal();
        return prev;
      }
      return [...prev, { clientId, file }];
    });
    return clientId;
  };

  /**
   * 단일 일반 파일 추가 (clientId 발급 후 큐에 등록)
   */
  const addAttachFile = (file: File): string => {
    const clientId = crypto.randomUUID();
    setFileQueue((prev) => {
      // 중복 체크
      const merged = dedupeFiles([...prev.map((item) => item.file), file]);
      if (merged.length > MAX_FILES) {
        openFileLimitModal();
        return prev;
      }
      return [...prev, { clientId, file }];
    });
    return clientId;
  };

  /**
   * 파일 다건 업로드
   * - 각 파일명을 `clientId__원래이름`으로 리네임하여 업로드
   * - 응답의 originalFileName/fileName에서 clientId를 파싱하여 안전 매핑
   * - 입력 순서대로 업로드 경로(path) 배열을 반환
   */
  // 첨부 리스트 별도 업로드는 제거(파일 큐를 통해서만 업로드)

  /**
   * 이미지 업로드 및 검증
   * @returns 업로드된 이미지 경로와 URL 매핑
   */
  const handleImageUpload = async () => {
    const {
      byIdToPath: imgIdToPath,
      byIdToUrl: imgIdToUrl,
      failedCount: imageFailedCount,
    } = await uploadFileQueue(imageQueue, "이미지");

    // 이미지 업로드 실패 확인
    if (imageQueue.length > 0 && imageFailedCount > 0) {
      setImageUploadPartialMessage(
        WRITE_MESSAGES.IMAGE_UPLOAD_PARTIAL_FAILED(imageFailedCount)
      );
      openImageUploadPartialModal();
      throw new Error(ERROR_MESSAGES.IMAGE_UPLOAD_FAILED);
    }

    // 이미지가 있는데 URL 매핑이 제대로 안 된 경우
    if (imageQueue.length > 0 && imgIdToUrl.size === 0) {
      openImageUploadFailedModal();
      throw new Error(ERROR_MESSAGES.IMAGE_UPLOAD_FAILED);
    }

    return {
      imagePaths: Array.from(imgIdToPath.values()),
      imageUrlMap: imgIdToUrl,
    };
  };

  /**
   * 이미지 URL 교체 및 검증
   * @param content - 원본 콘텐츠 HTML
   * @param imageUrlMap - 이미지 URL 매핑
   * @returns URL이 교체된 콘텐츠 HTML
   */
  const handleImageUrlReplacement = (
    content: string,
    imageUrlMap: Map<string, string>
  ): string => {
    const contentWithUrls = replaceEditorImageSrcWithUploadedUrls(
      content,
      imageUrlMap
    );

    // 이미지가 있는데 src가 교체되지 않은 경우 확인
    if (imageQueue.length > 0) {
      const tempContainer = document.createElement("div");
      tempContainer.innerHTML = contentWithUrls;
      const imagesWithClientId = tempContainer.querySelectorAll(
        "img[data-client-id]"
      );
      if (imagesWithClientId.length > 0) {
        openImageUrlReplaceFailedModal();
        throw new Error(ERROR_MESSAGES.IMAGE_URL_REPLACE_FAILED);
      }
    }

    return contentWithUrls;
  };

  /**
   * 파일 업로드 및 URL 교체
   * @param content - 콘텐츠 HTML
   * @returns 업로드된 파일 경로와 URL이 교체된 콘텐츠, 실패 시 null
   */
  const handleFileUpload = async (
    content: string
  ): Promise<{ filePaths: string[]; content: string } | null> => {
    const queueToUse = fileQueue;

    const {
      byIdToPath: fileIdToPath,
      byIdToUrl: fileIdToUrl,
      failedCount: fileFailedCount,
    } = await uploadFileQueue(queueToUse, "파일");

    if (queueToUse.length > 0 && fileFailedCount > 0) {
      openFileUploadFailedModal();
      return null;
    }

    if (queueToUse.length > 0 && fileIdToUrl.size === 0) {
      openFileUploadFailedModal();
      return null;
    }

    const uploadedFilePaths = Array.from(fileIdToPath.values());
    const contentWithUrls = replaceEditorFileHrefWithUploadedUrls(
      content,
      fileIdToUrl
    );

    setValue("content", contentWithUrls, {
      shouldDirty: true,
      shouldValidate: false,
    });

    return { filePaths: uploadedFilePaths, content: contentWithUrls };
  };

  /**
   * 게시글 등록
   * @param title - 제목
   * @param content - 콘텐츠 HTML
   * @param category - 카테고리
   * @param media - 미디어 파일 경로 배열
   * @returns 등록된 게시글 ID와 커뮤니티 ID
   */
  const createPost = (
    title: string,
    content: string,
    category: string,
    media: string[],
    isPublic: boolean,
    isReview: boolean
  ): Promise<{ postId: string; communityId: string }> => {
    return new Promise((resolve, reject) => {
      const requestParam = {
        communityId: COMMUNITY_ID,
        data: {
          title,
          content,
          category,
          media,
          isPublic,
          isReview,
        },
      } as unknown as CommunityTypes.TPOSTCommunitiesPostsByIdReq;

      mutate(requestParam, {
        onSuccess: (res) => {
          const responseData = (res as any)?.data as
            | CommunityTypes.TPOSTCommunitiesPostsByIdRes
            | undefined;
          const postId = responseData?.id;
          const communityId = responseData?.communityId;

          if (!postId || !communityId) {
            reject(new Error(WRITE_MESSAGES.POST_RESPONSE_INVALID));
            return;
          }

          // 커뮤니티 게시글 목록 쿼리 무효화
          queryClient.invalidateQueries({
            predicate: (query) => {
              const queryKey = query.queryKey;
              if (!Array.isArray(queryKey) || queryKey.length === 0) {
                return false;
              }
              const isCustomKey = queryKey[0] === "communitiesPosts";
              const isGeneratedKey =
                queryKey[0] === "communities" &&
                queryKey[1] === "getCommunitiesPosts";

              return isCustomKey || isGeneratedKey;
            },
          });

          resolve({ postId, communityId });
        },
        onError: (err) => {
          reject(err);
        },
      });
    });
  };

  /**
   * 제출 핸들러
   * - 제목/내용 유효성 검사 후 첨부 파일 업로드 → 글 등록까지 수행
   * - 실패 시 업로드된 파일들 롤백 삭제
   */
  const onSubmit = async (values: WriteFormValues) => {
    const trimmedTitle = values.title.trim();
    const currentContent = getValues("content");
    let uploadedImagePaths: string[] = [];
    let uploadedFilePaths: string[] = [];

    openUploading();

    try {
      // 1. 이미지 업로드 및 검증
      const { imagePaths, imageUrlMap } = await handleImageUpload();
      uploadedImagePaths = imagePaths;

      // 2. 이미지 URL 교체 및 검증
      const contentWithUrls = handleImageUrlReplacement(
        currentContent,
        imageUrlMap
      );

      // 3. 파일 업로드 및 URL 교체
      const fileUploadResult = await handleFileUpload(contentWithUrls);
      if (!fileUploadResult) {
        // 파일 업로드 실패 시 이미 업로드된 이미지 롤백
        if (uploadedImagePaths.length > 0) {
          await rollbackUploadedFiles(uploadedImagePaths, []);
          uploadedImagePaths = [];
        }
        // 파일 업로드 실패 시 로딩 오버레이 닫기
        closeUploading();
        return;
      }
      const { filePaths, content: finalContent } = fileUploadResult;
      uploadedFilePaths = filePaths;

      // 4. 게시글 등록
      // "참여자에게만 공개" 체크 시 isPublic: false (공개 범위 제한)
      // 체크 해제 시 isPublic: true (전체 공개)
      const postResponse = await createPost(
        trimmedTitle,
        finalContent,
        values.category,
        [...uploadedImagePaths, ...uploadedFilePaths],
        !values.isPublic,
        isReview
      );

      // 5. 성공 후 처리
      closeUploading();
      setImageQueue([]);
      setFileQueue([]);
      reset({
        title: "",
        content: "",
        category: "한끗루틴",
        isPublic: false,
      });

      // 성공 모달 표시
      setSuccessPostData({
        postId: postResponse.postId,
        communityId: postResponse.communityId,
      });
      openSuccessModal();
    } catch (error) {
      closeUploading();
      // 에러 발생 시 업로드된 파일들 롤백
      if (uploadedImagePaths.length > 0 || uploadedFilePaths.length > 0) {
        await rollbackUploadedFiles(uploadedImagePaths, uploadedFilePaths);
      }

      // 에러가 이미 처리된 경우 (alert 등)는 다시 처리하지 않음
      if (isHandledError(error)) {
        return;
      }

      setErrorMessage(WRITE_MESSAGES.POST_CREATE_FAILED);
      openErrorModal();
    }
  };
  const hasTitle = watch("title").trim();
  const hasContent = extractTextFromHtml(watch("content") || "").length > 0;

  // 인증 조건 검사 (인증글일 때만)
  const content = watch("content") || "";
  const isTextLongEnough = checkPostTextLength(content, MIN_POST_TEXT_LENGTH);
  const hasImage = hasImageInContent(content);

  const isSubmitDisabled =
    isPending ||
    !hasTitle ||
    !hasContent ||
    (!isReview && (!isTextLongEnough || !hasImage));

  /**
   * 화면 렌더 시 topbar 타이틀 및 완료 버튼 설정
   */
  useEffect(() => {
    // 탑바 타이틀 설정 (인증글/후기글 구분)
    setTitle(isReview ? "프로그램 후기 작성" : "프로그램 인증");

    // 탑바 완료 버튼 설정
    setRightSlot(
      <SubmitButton
        disabled={isSubmitDisabled}
        onClick={handleSubmit(onSubmit)}
      />
    );

    return () => {
      resetTopBar();
    };
  }, [
    setTitle,
    setRightSlot,
    isSubmitDisabled,
    handleSubmit,
    onSubmit,
    isReview,
  ]);

  // 뒤로가기(popstate) 인터셉트: 언제나 컨펌 모달 노출
  useEffect(() => {
    const pushBlockState = () => {
      try {
        history.pushState(null, "", window.location.href);
      } catch {}
    };

    const handlePopState = () => {
      if (allowLeaveCountRef.current > 0) {
        // 허용해야 하는 pop이 남아있으면 소모하고 그대로 진행
        allowLeaveCountRef.current -= 1;
        return;
      }
      setIsLeaveConfirmOpen(true);
      // 네비게이션 취소를 위해 현재 히스토리로 다시 푸시
      pushBlockState();
    };

    // 최초 진입 시 한 단계 쌓아 두어 back을 가로챔
    pushBlockState();
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Auth 초기화 대기 중이거나 미인증 사용자는 렌더링하지 않음
  // (useRequireAuth가 자동으로 리다이렉트 처리)
  if (!isReady || !user) {
    return null;
  }

  return (
    <form className="flex flex-col pt-12" onSubmit={handleSubmit(onSubmit)}>
      {/* 선택된 프로그램 정보 표시 */}
      <div className="flex flex-col gap-4 bg-gray-100 p-5 py-3">
        {selectedCommunityName && (
          <div className="flex border-collapse flex-col gap-1 rounded-lg border border-gray-200 bg-white">
            {/* 글 카테고리 정보 */}
            <div className="flex w-full flex-col gap-1 px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="bg-main-50 rounded-lg p-1">
                  <Typography
                    font="noto"
                    variant="body2M"
                    className="text-main-500"
                  >
                    {selectedCategory}
                  </Typography>
                </span>
                <Typography
                  font="noto"
                  variant="body2M"
                  className="text-gray-950"
                >
                  {selectedCommunityName}
                </Typography>
              </div>
            </div>
            {/* 공개 범위 */}
            <div className="flex w-full items-center justify-between border-t border-t-gray-300 p-4">
              <Typography
                font="noto"
                variant="label1M"
                className="text-gray-600"
              >
                공개 범위
              </Typography>
              <label className="flex cursor-pointer items-center gap-1">
                <input
                  type="checkbox"
                  className="border border-gray-950"
                  checked={watch("isPublic")}
                  onChange={(e) =>
                    setValue("isPublic", e.target.checked, {
                      shouldDirty: true,
                    })
                  }
                />
                <Typography
                  font="noto"
                  variant="label1M"
                  className="text-gray-600"
                >
                  참여자에게만 공개
                </Typography>
              </label>
            </div>
          </div>
        )}
        {/* 인증방법 - 인증글일 때만 표시 */}
        {!isReview && (
          <div className="border-main-300 bg-main-50 flex flex-col rounded-lg border px-5 py-4">
            <div className="flex items-center justify-between">
              <Typography
                font="noto"
                variant="label1M"
                className="text-gray-800"
              >
                인증 방법
              </Typography>

              <ButtonBase
                className="size-8"
                onClick={() => setIsAuthGuideOpen((prev) => !prev)}
                aria-expanded={isAuthGuideOpen}
                aria-controls="auth-guide-content"
              >
                {isAuthGuideOpen ? (
                  <ChevronUp size={16} className="text-gray-800" />
                ) : (
                  <ChevronDown size={16} className="text-gray-800" />
                )}
              </ButtonBase>
            </div>
            {isAuthGuideOpen && (
              // TODO: 인증 가이드 데이터 노션에서 받아와 활용하도록 수정 @grapefruit
              <p
                id="auth-guide-content"
                className="font-noto font-regular text-[13px] leading-[1.5] text-gray-950"
              >
                1. 인증 글 제목 예시 : 9/17 [아침] 정은 인증 <br />
                &nbsp;날짜 / [아침,점심,저녁] / 닉네임 <br />
                2. 9월 한끗루틴은 아침, 점심, 저녁 총 세 번의 루틴을 인증하기
                때문에&nbsp;
                <Typography font="noto" variant="body3B">
                  태그
                </Typography>
                를 꼭 걸어주세요!
                <br />
                3. 모든 루틴 인증글에는 타임스탬프(날짜, 시간 포함) 사진이
                필수입니다. <br />
                4. 루틴 인증 소감, 이야기도 꼭 남겨주세요!
              </p>
            )}
          </div>
        )}
        {/* 현재 완료된 인증 - 인증글일 때만 표시 */}
        {!isReview && (
          <>
            <Typography font="noto" variant="label2R" className="text-gray-400">
              *작성 완료 시 나다움 포인트 지급 및 해당 인증글은 피드에
              올라갑니다.
            </Typography>
            <div className="flex flex-col gap-2">
              <Typography
                font="noto"
                variant="label1M"
                className="text-gray-950"
              >
                현재 완료된 인증
              </Typography>
              <div className="flex gap-2">
                <MissionCertificationStatusCard
                  label={`${MIN_POST_TEXT_LENGTH}자 이상 작성`}
                  isActive={isTextLongEnough}
                  icon="pencil"
                />
                <MissionCertificationStatusCard
                  label="사진 업로드"
                  isActive={hasImage}
                  icon="photo"
                />
              </div>
            </div>
          </>
        )}
      </div>
      <TextEditor
        onImageUpload={registerImage}
        onFileUpload={addAttachFile}
        onTitleChange={(title) =>
          setValue("title", title, { shouldDirty: true, shouldValidate: true })
        }
        onContentChange={(content) =>
          setValue("content", content, {
            shouldDirty: true,
            shouldValidate: false,
          })
        }
      />

      {/* Content 실시간 확인 데모 컴포넌트 */}
      {/* <div className="fixed right-4 bottom-20 z-50 max-h-[400px] w-[400px] overflow-auto rounded-lg border-2 border-blue-500 bg-white p-4 shadow-lg">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">
            Request Body Content (임시)
          </h3>
          <button
            onClick={() => {
              const content = getValues("content");
              navigator.clipboard.writeText(content);
              alert("Content가 클립보드에 복사되었습니다!");
            }}
            className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
          >
            복사
          </button>
        </div>
        <div className="mb-2 text-xs text-gray-500">
          길이: {watch("content")?.length || 0}자
        </div>
        <div className="rounded border border-gray-200 bg-gray-50 p-2">
          <pre className="text-xs break-words whitespace-pre-wrap">
            {watch("content") || "(비어있음)"}
          </pre>
        </div>
      </div> */}

      {/* 뒤로가기 컨펌 모달 */}
      <Modal
        isOpen={isLeaveConfirmOpen}
        title="그만둘까요?"
        description="작성 중인 내용이 사라져요."
        cancelText="계속하기"
        confirmText="그만두기"
        onClose={() => setIsLeaveConfirmOpen(false)}
        onConfirm={() => {
          setIsLeaveConfirmOpen(false);
          // popstate 인터셉트를 통하지 않고 즉시 이전 화면(커뮤니티 목록)으로 이동
          router.replace(LINK_URL.COMMUNITY);
        }}
        variant="primary"
      />

      {/* 로딩 오버레이 */}
      <LoadingOverlay isLoading={isUploading} message="업로드 중입니다" />

      {/* 성공 모달 */}
      <Modal
        isOpen={isSuccessModalOpen}
        title="게시물이 등록되었습니다"
        description="작성하신 게시물이 성공적으로 등록되었어요."
        confirmText="확인"
        onClose={closeSuccessModal}
        onConfirm={() => {
          closeSuccessModal();
          if (successPostData) {
            router.replace(
              `${LINK_URL.COMMUNITY_POST}/${successPostData.postId}?communityId=${successPostData.communityId}`
            );
          }
        }}
        variant="primary"
      />

      {/* 에러 모달 */}
      <Modal
        isOpen={isErrorModalOpen}
        title="오류가 발생했어요"
        description={errorMessage}
        confirmText="확인"
        onClose={closeErrorModal}
        onConfirm={closeErrorModal}
        variant="primary"
      />

      {/* 이미지 개수 초과 모달 */}
      <Modal
        isOpen={isImageLimitModalOpen}
        title="이미지 개수 초과"
        description={`이미지는 최대 ${MAX_FILES}장까지 첨부할 수 있어요.`}
        confirmText="확인"
        onConfirm={closeImageLimitModal}
        onClose={closeImageLimitModal}
        variant="primary"
      />

      {/* 파일 개수 초과 모달 */}
      <Modal
        isOpen={isFileLimitModalOpen}
        title="파일 개수 초과"
        description={`파일은 최대 ${MAX_FILES}개까지 첨부할 수 있어요.`}
        confirmText="확인"
        onConfirm={closeFileLimitModal}
        onClose={closeFileLimitModal}
        variant="primary"
      />

      {/* 이미지 업로드 부분 실패 모달 */}
      <Modal
        isOpen={isImageUploadPartialModalOpen}
        title="이미지 업로드 실패"
        description={imageUploadPartialMessage}
        confirmText="확인"
        onConfirm={closeImageUploadPartialModal}
        onClose={closeImageUploadPartialModal}
        variant="primary"
      />

      {/* 이미지 업로드 실패 모달 */}
      <Modal
        isOpen={isImageUploadFailedModalOpen}
        title="이미지 업로드 실패"
        description={WRITE_MESSAGES.IMAGE_UPLOAD_FAILED}
        confirmText="확인"
        onConfirm={closeImageUploadFailedModal}
        onClose={closeImageUploadFailedModal}
        variant="primary"
      />

      {/* 이미지 URL 교체 실패 모달 */}
      <Modal
        isOpen={isImageUrlReplaceFailedModalOpen}
        title="이미지 처리 실패"
        description={WRITE_MESSAGES.IMAGE_URL_REPLACE_FAILED}
        confirmText="확인"
        onConfirm={closeImageUrlReplaceFailedModal}
        onClose={closeImageUrlReplaceFailedModal}
        variant="primary"
      />

      {/* 파일 업로드 실패 모달 */}
      <Modal
        isOpen={isFileUploadFailedModalOpen}
        title="파일 업로드 실패"
        description={WRITE_MESSAGES.FILE_UPLOAD_FAILED}
        confirmText="확인"
        onConfirm={closeFileUploadFailedModal}
        onClose={closeFileUploadFailedModal}
        variant="primary"
      />
    </form>
  );
};

/**
 * @description 커뮤니티 글 작성 페이지
 * 페이지 레벨에서 동기적으로 인증 체크하여 스켈레톤이 보이지 않도록 합니다.
 */
const Page = () => {
  const hasRedirectedRef = useRef(false);

  const initialHasCookie =
    typeof document !== "undefined" ? hasAuthCookie() : false;
  const initialCurrentUser =
    typeof window !== "undefined" ? getCurrentUser() : null;

  const shouldRedirect = !initialHasCookie && !initialCurrentUser;

  useLayoutEffect(() => {
    if (
      shouldRedirect &&
      typeof window !== "undefined" &&
      !hasRedirectedRef.current
    ) {
      hasRedirectedRef.current = true;
      removeAuthCookie();
      window.location.replace(LINK_URL.LOGIN);
    }
  }, [shouldRedirect]);

  if (shouldRedirect) {
    return null;
  }

  return (
    <Suspense>
      <WritePageContent />
    </Suspense>
  );
};

export default Page;
