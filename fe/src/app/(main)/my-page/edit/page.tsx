"use client";

import { useState, useEffect, useRef, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "firebase/auth";
import { Camera, X } from "lucide-react";
import { useForm } from "react-hook-form";
import * as FilesApi from "@/api/generated/files-api";
import { deleteFilesById } from "@/api/generated/files-api";
import * as UsersApi from "@/api/generated/users-api";
import ProfileImageBottomSheet from "@/components/my-page/ProfileImageBottomSheet";
import Input from "@/components/shared/input";
import Textarea from "@/components/shared/textarea";
import { Typography } from "@/components/shared/typography";
import Modal from "@/components/shared/ui/modal";
import ProfileImage from "@/components/shared/ui/profile-image";
import { ACCEPT_IMAGE_EXTENSIONS } from "@/constants/community/_write-constants";
import { usersKeys } from "@/constants/generated/query-keys";
import {
  MAX_PROFILE_IMAGE_SIZE_BYTES,
  MAX_BIO_LENGTH,
  PROFILE_EDIT_MESSAGES,
  PROFILE_EDIT_ERRORS,
  PROFILE_EDIT_PLACEHOLDERS,
  PROFILE_EDIT_HELPERS,
  PROFILE_EDIT_LABELS,
} from "@/constants/my-page/_profile-edit-constants";
import { LINK_URL } from "@/constants/shared/_link-url";
import {
  MAX_NICKNAME_LENGTH,
  NICKNAME_ALLOWED_PATTERN,
} from "@/constants/shared/_nickname-constants";
import { useDeleteAuthDeleteAccount } from "@/hooks/generated/auth-hooks";
import {
  useGetUsersMe,
  usePatchUsersMeOnboarding,
  usePostUsersMeSyncKakaoProfile,
} from "@/hooks/generated/users-hooks";
import useToggle from "@/hooks/shared/useToggle";
import { auth } from "@/lib/firebase";
import type { FileUploadResponse } from "@/types/generated/api-schema";
import type { ProfileEditFormValues } from "@/types/my-page/_profile-edit-types";
import {
  getKakaoAccessToken,
  removeKakaoAccessToken,
} from "@/utils/auth/kakao-access-token";
import { debug } from "@/utils/shared/debugger";

/**
 * @description 프로필 편집 페이지(온보딩)
 */
const ProfileEditPage = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);

  const { data: userData } = useGetUsersMe({
    request: {},
    select: (data) => {
      return data?.user;
    },
  });
  const { mutateAsync: patchOnboardingAsync } = usePatchUsersMeOnboarding();
  const { mutateAsync: syncKakaoProfileAsync } =
    usePostUsersMeSyncKakaoProfile();
  const { mutateAsync: deleteAccountAsync, isPending: isDeletingAccount } =
    useDeleteAuthDeleteAccount();

  const actualUserData = userData;
  // userData가 로드된 이후에만 온보딩 여부를 true로 판단
  const isOnboarding =
    !!actualUserData && actualUserData.nickname?.trim().length === 0;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<ProfileEditFormValues>({
    defaultValues: {
      profileImageUrl: actualUserData?.profileImageUrl ?? "",
      nickname: actualUserData?.nickname ?? "",
      bio: actualUserData?.bio ?? "",
    },
    mode: "onChange",
  });

  const profileImageUrl = watch("profileImageUrl");
  const nickname = watch("nickname");

  const {
    isOpen: isBottomSheetOpen,
    close: closeBottomSheet,
    open: openBottomSheet,
  } = useToggle();
  const {
    isOpen: isUnsavedModalOpen,
    open: openUnsavedModal,
    close: closeUnsavedModal,
  } = useToggle();
  const {
    isOpen: isErrorModalOpen,
    open: openErrorModal,
    close: closeErrorModal,
  } = useToggle();
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  // 이미지 파일 타입 오류 모달
  const {
    isOpen: isInvalidImageFileModalOpen,
    open: openInvalidImageFileModal,
    close: closeInvalidImageFileModal,
  } = useToggle();

  // 이미지 크기 초과 모달
  const {
    isOpen: isImageSizeExceededModalOpen,
    open: openImageSizeExceededModal,
    close: closeImageSizeExceededModal,
  } = useToggle();

  // 카카오 프로필 동기화 실패 모달
  const {
    isOpen: isKakaoSyncFailedModalOpen,
    open: openKakaoSyncFailedModal,
    close: closeKakaoSyncFailedModal,
  } = useToggle();

  // 닉네임 중복 확인 오류 모달
  const {
    isOpen: isNicknameCheckErrorModalOpen,
    open: openNicknameCheckErrorModal,
    close: closeNicknameCheckErrorModal,
  } = useToggle();

  // 프로필 이미지 업로드 실패 모달
  const {
    isOpen: isImageUploadFailedModalOpen,
    open: openImageUploadFailedModal,
    close: closeImageUploadFailedModal,
  } = useToggle();

  // 프로필 업데이트 실패 모달
  const {
    isOpen: isProfileUpdateFailedModalOpen,
    open: openProfileUpdateFailedModal,
    close: closeProfileUpdateFailedModal,
  } = useToggle();

  const isNicknameValid = nickname.trim().length > 0;
  const isCompleteEnabled = isDirty && isNicknameValid && !nicknameError;
  const isDataLoaded = !!actualUserData;

  /**
   * 파일 검증 (타입 및 크기 체크)
   */
  const validateImageFile = (file: File): boolean => {
    if (!file.type.startsWith("image/")) {
      openInvalidImageFileModal();
      return false;
    }

    if (file.size > MAX_PROFILE_IMAGE_SIZE_BYTES) {
      openImageSizeExceededModal();
      return false;
    }

    return true;
  };

  /**
   * 이미지 파일 업로드
   * @returns { fileUrl, filePath } - 업로드된 이미지의 URL과 경로
   */
  const uploadImageFile = async (
    file: File
  ): Promise<{
    fileUrl: string;
    filePath: string;
  }> => {
    const formData = new FormData();
    formData.append("file", file);

    const uploadResponse = await FilesApi.postFilesUploadMultiple(formData);
    // axios interceptor가 response.data.data를 response.data로 변환하므로
    // uploadResponse.data가 바로 FileUploadResponse["data"] 형태입니다
    // 따라서 uploadResponse.data.files로 접근해야 합니다
    // community/write 페이지와 동일한 패턴 사용
    const items =
      (uploadResponse.data as unknown as FileUploadResponse["data"])?.files ??
      [];

    debug.log("이미지 업로드 응답:", {
      uploadResponse: uploadResponse.data,
      itemsLength: items.length,
      firstFile: items[0],
    });

    const firstFile = items[0];
    if (!firstFile?.success || !firstFile?.data?.fileUrl) {
      debug.error("이미지 업로드 응답 파싱 실패:", {
        items,
        firstFile,
        fullResponse: uploadResponse,
        responseData: uploadResponse.data,
      });
      throw new Error(PROFILE_EDIT_MESSAGES.IMAGE_URL_FETCH_FAILED);
    }

    // fileUrl과 path 모두 반환 (삭제 시 path 필요)
    const fileUrl = firstFile.data.fileUrl;
    const filePath = firstFile.data.path ?? firstFile.data.fileName ?? fileUrl;

    return { fileUrl, filePath };
  };

  /**
   * 사용자 데이터 로드 시 초기 상태 설정
   * 레이스 컨디션 방지: 데이터가 로드되기 전에는 입력을 막고,
   * 데이터 로드 후 초기값 설정
   */
  useEffect(() => {
    if (!actualUserData) return;

    reset({
      profileImageUrl: actualUserData.profileImageUrl ?? "",
      nickname: actualUserData.nickname ?? "",
      bio: actualUserData.bio ?? "",
    });
  }, [actualUserData, reset]);

  /**
   * 브라우저 뒤로가기 시 변경사항 확인 모달 표시
   * 온보딩 중이거나 변경사항이 있으면 모달 표시
   */
  useEffect(() => {
    const handlePopState = () => {
      // 온보딩 중이거나 변경사항이 있으면 모달 표시
      if (isOnboarding || isDirty) {
        window.history.pushState(null, "", window.location.href);
        openUnsavedModal();
      }
    };

    if (!window.history.state?.profileEdit) {
      window.history.pushState({ profileEdit: true }, "", window.location.href);
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isDirty, isOnboarding, openUnsavedModal]);

  /**
   * 뒤로가기 버튼 클릭 핸들러
   * 온보딩 중이거나 변경사항이 있으면 확인 모달을 표시하고, 없으면 마이페이지로 이동
   */
  const handleBack = () => {
    // 온보딩 중이거나 변경사항이 있으면 모달 표시
    if (isOnboarding || isDirty) {
      openUnsavedModal();
      return;
    }

    // 일반 편집이고 변경사항이 없으면 마이페이지로 이동
    router.push(LINK_URL.MY_PAGE);
  };

  /**
   * 닉네임 중복 체크
   * @returns 사용 가능 여부 (true: 사용 가능, false: 중복 또는 유효하지 않음)
   */
  const checkNicknameAvailability = async (
    nickname: string
  ): Promise<boolean> => {
    try {
      const response = await UsersApi.getUsersNicknameAvailability({
        nickname,
      });
      const isAvailable = response.data?.available ?? false;

      if (isAvailable) {
        // 사용 가능한 경우 에러 메시지 초기화
        setNicknameError(null);
        return true;
      } else {
        // 200 응답이지만 available이 false인 경우 (중복)
        setNicknameError(PROFILE_EDIT_ERRORS.NICKNAME_DUPLICATED);
        return false;
      }
    } catch (error: unknown) {
      // 400 에러인 경우 (닉네임 형식 오류)
      if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "status" in error.response &&
        error.response.status === 400
      ) {
        setNicknameError(PROFILE_EDIT_ERRORS.NICKNAME_INVALID_CHARACTERS);
        return false;
      }

      // 기타 에러는 그대로 throw
      throw error;
    }
  };

  /**
   * 새로 선택한 이미지 업로드 처리
   */
  const handleImageUploadIfNeeded = async (
    currentImageUrl: string
  ): Promise<{ fileUrl: string; filePath: string | null }> => {
    const initialImageUrl = actualUserData?.profileImageUrl ?? "";
    const isImageChanged = currentImageUrl !== initialImageUrl;
    const isNewlySelectedImage = currentImageUrl.startsWith("data:");

    if (!isImageChanged || !isNewlySelectedImage || !selectedFileRef.current) {
      return { fileUrl: currentImageUrl, filePath: null };
    }

    try {
      const uploadResult = await uploadImageFile(selectedFileRef.current);
      return {
        fileUrl: uploadResult.fileUrl,
        filePath: uploadResult.filePath,
      };
    } catch (error) {
      debug.error("이미지 업로드 실패:", error);
      // 사용자 알림 없이 메시지를 포함한 오류만 던지기
      throw new Error(PROFILE_EDIT_MESSAGES.IMAGE_UPLOAD_FAILED);
    }
  };

  /**
   * 업로드한 이미지 롤백 삭제
   */
  const rollbackUploadedImage = async (filePath: string | null) => {
    if (!filePath) return;

    try {
      await deleteFilesById({ filePath });
      debug.log("업로드한 이미지 삭제 완료:", filePath);
    } catch (deleteError) {
      debug.error("업로드한 이미지 삭제 실패:", deleteError);
    }
  };

  /**
   * 사용자 관련 쿼리 캐시 무효화
   */
  const invalidateUserQueries = () => {
    queryClient.invalidateQueries({
      queryKey: usersKeys.getUsersMe({}),
    });
    queryClient.invalidateQueries({
      queryKey: usersKeys.getUsersMeMyPage,
    });
    queryClient.invalidateQueries({
      predicate: (query) => {
        return (
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "users" &&
          (query.queryKey[1] === "getUsersMePosts" ||
            query.queryKey[1] === "getUsersMeLikedPosts" ||
            query.queryKey[1] === "getUsersMeCommentedPosts")
        );
      },
    });
  };

  /**
   * 프로필 편집 완료 핸들러
   * 온보딩 플로우:
   * 1. sessionStorage에서 카카오 액세스 토큰 확인
   * 2. 토큰이 있으면 syncKakaoProfile API 먼저 호출 (카카오 정보 동기화)
   * 3. 성공하면 닉네임 중복 체크 → 이미지 업로드 → updateOnboarding API 호출 (닉네임 등 저장)
   */
  const onSubmit = async (data: ProfileEditFormValues) => {
    const trimmedNickname = data.nickname.trim();
    const initialNickname = actualUserData?.nickname ?? "";
    let uploadedImagePath: string | null = null;
    const kakaoAccessToken = getKakaoAccessToken();

    try {
      // 1. 카카오 액세스 토큰이 있으면 syncKakaoProfile 먼저 호출
      if (kakaoAccessToken) {
        try {
          await syncKakaoProfileAsync({
            data: {
              accessToken: kakaoAccessToken,
            },
          });
          debug.log("카카오 프로필 동기화 성공");

          // 토큰 사용 후 sessionStorage에서 제거
          removeKakaoAccessToken();
        } catch (error) {
          debug.error("카카오 프로필 동기화 실패:", error);
          // 에러 발생 시 토큰 정리
          removeKakaoAccessToken();
          openKakaoSyncFailedModal();
          return;
        }
      }

      // 2. 닉네임 중복 체크
      try {
        const isNicknameChanged = trimmedNickname !== initialNickname;
        if (isNicknameChanged) {
          const isAvailable = await checkNicknameAvailability(trimmedNickname);
          if (!isAvailable) {
            // 에러 메시지는 checkNicknameAvailability에서 이미 설정됨
            return;
          }
        }
      } catch (error) {
        debug.error("닉네임 중복 체크 실패:", error);
        openNicknameCheckErrorModal();
        return;
      }

      // 3. 이미지 업로드 처리
      try {
        const { fileUrl: finalImageUrl, filePath } =
          await handleImageUploadIfNeeded(data.profileImageUrl);
        uploadedImagePath = filePath;

        // 4. 프로필 업데이트 (updateOnboarding API 호출)
        await patchOnboardingAsync(
          {
            data: {
              nickname: trimmedNickname,
              profileImageUrl: finalImageUrl || undefined,
              bio: data.bio.trim() || undefined,
            },
          },
          {
            onSuccess: () => {
              invalidateUserQueries();
              // 온보딩 완료 시 홈으로, 일반 편집 시 마이페이지로 이동
              router.push(isOnboarding ? LINK_URL.HOME : LINK_URL.MY_PAGE);
            },
          }
        );
      } catch (error) {
        debug.error("이미지 업로드 또는 프로필 업데이트 실패:", error);

        // 에러 메시지에서 이미지 업로드 실패인지 확인
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (errorMessage.includes(PROFILE_EDIT_MESSAGES.IMAGE_UPLOAD_FAILED)) {
          openImageUploadFailedModal();
        } else {
          openProfileUpdateFailedModal();
        }

        // 에러 발생 시 토큰 정리 (아직 사용하지 않은 경우)
        if (kakaoAccessToken) {
          removeKakaoAccessToken();
        }
        await rollbackUploadedImage(uploadedImagePath);
      }
    } catch (error) {
      debug.error("프로필 업데이트 전체 프로세스 실패:", error);
      // 예상치 못한 에러 발생 시
      setErrorMessage(
        "프로필 업데이트 중 오류가 발생했습니다. 다시 시도해주세요."
      );
      openErrorModal();
      // 에러 발생 시 토큰 정리 (아직 사용하지 않은 경우)
      if (kakaoAccessToken) {
        removeKakaoAccessToken();
      }
      await rollbackUploadedImage(uploadedImagePath);
    }
  };

  /**
   * 닉네임 입력 핸들러
   * 한글, 영어, 숫자만 허용하며 8자까지 입력 가능
   * 특수문자 입력 시 에러 메시지 표시
   */
  const handleNicknameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;

    // 1. 특수문자 제거하여 필터링된 값 계산
    const filteredNickname = inputValue.replace(NICKNAME_ALLOWED_PATTERN, "");

    // 2. 필터링된 값에 대해 길이 제한 적용
    const trimmedNickname =
      filteredNickname.length > MAX_NICKNAME_LENGTH
        ? filteredNickname.slice(0, MAX_NICKNAME_LENGTH)
        : filteredNickname;

    // 3. 에러 메시지 설정
    const hasInvalidCharacters = inputValue !== filteredNickname;
    const isLengthExceeded = filteredNickname.length > MAX_NICKNAME_LENGTH;

    const errorMessage = (() => {
      if (hasInvalidCharacters && isLengthExceeded) {
        return PROFILE_EDIT_ERRORS.NICKNAME_INVALID_CHARACTERS;
      }
      if (hasInvalidCharacters) {
        return PROFILE_EDIT_ERRORS.NICKNAME_INVALID_CHARACTERS;
      }
      if (isLengthExceeded) {
        return PROFILE_EDIT_ERRORS.NICKNAME_MAX_LENGTH;
      }
      return null;
    })();

    setNicknameError(errorMessage);

    // 4. 필터링 및 길이 제한된 값으로 업데이트
    setValue("nickname", trimmedNickname, {
      shouldDirty: true,
      shouldValidate: false,
    });
  };

  /**
   * 파일 선택 핸들러
   * 이미지 파일 검증 및 크기 체크 후 미리보기 생성
   */
  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!validateImageFile(file)) return;

    selectedFileRef.current = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      setValue("profileImageUrl", imageUrl, { shouldDirty: true });
    };
    reader.readAsDataURL(file);
  };

  /**
   * 카메라 선택 핸들러
   * 바텀시트 닫고 카메라 입력 트리거
   */
  const handleCameraSelect = () => {
    closeBottomSheet();
    cameraInputRef.current?.click();
  };

  /**
   * 갤러리 선택 핸들러
   * 바텀시트 닫고 갤러리 입력 트리거
   */
  const handleGallerySelect = () => {
    closeBottomSheet();
    galleryInputRef.current?.click();
  };

  /**
   * 기본 이미지 적용 핸들러
   * 프로필 이미지를 null로 설정 (저장하기 전까지는 서버에 요청하지 않음)
   */
  const handleDefaultImageSelect = () => {
    selectedFileRef.current = null;
    setValue("profileImageUrl", "", { shouldDirty: true });
  };

  /**
   * 변경사항 저장 확인 모달의 확인 버튼 핸들러
   * 온보딩 중이면 회원탈퇴 API 호출 후 로그인 페이지로 이동
   * 일반 편집 중이면 마이페이지로 이동
   */
  const handleUnsavedConfirm = async () => {
    if (isOnboarding) {
      // 온보딩 중이면 회원탈퇴 API 호출
      try {
        const kakaoAccessToken = getKakaoAccessToken();
        await deleteAccountAsync({
          data: kakaoAccessToken ? { kakaoAccessToken } : {},
        });

        // 토큰 정리
        if (kakaoAccessToken) {
          removeKakaoAccessToken();
        }

        // Firebase Auth 로그아웃 (백엔드에서 이미 사용자 삭제 처리됨)
        try {
          await signOut(auth);
        } catch (signOutError) {
          // signOut 실패해도 계속 진행 (백엔드에서 이미 사용자 삭제 처리됨)
          debug.warn("Firebase 로그아웃 실패 (무시됨):", signOutError);
        }

        // 모달 닫기
        closeUnsavedModal();

        // 로그인 페이지로 이동
        router.push(LINK_URL.LOGIN);
      } catch (error) {
        debug.error("회원탈퇴 실패:", error);
        // 에러 모달을 열기 전에 기존 모달 닫기
        closeUnsavedModal();
        openErrorModal();
      }
    } else {
      // 일반 편집 중이면 마이페이지로 이동
      closeUnsavedModal();
      router.push(LINK_URL.MY_PAGE);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-white">
      <div className="fixed top-0 z-50 mx-auto flex h-12 w-full max-w-[470px] items-center justify-between border-b border-b-gray-200 bg-white px-5 py-3">
        <button
          onClick={handleBack}
          className="hover:cursor-pointer"
          aria-label={PROFILE_EDIT_LABELS.BACK_BUTTON}
        >
          <svg
            className="h-5 w-5 text-gray-900"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <Typography font="noto" variant="body1M" className="text-gray-900">
          {PROFILE_EDIT_LABELS.PAGE_TITLE}
        </Typography>

        <button
          onClick={handleSubmit(onSubmit)}
          disabled={!isCompleteEnabled || isSubmitting}
          className="disabled:cursor-not-allowed"
          aria-label={PROFILE_EDIT_LABELS.COMPLETE_BUTTON}
        >
          <Typography
            font="noto"
            variant="label1M"
            className={
              isCompleteEnabled && !isSubmitting
                ? "text-main-500"
                : "text-main-500/30"
            }
          >
            {PROFILE_EDIT_LABELS.COMPLETE_BUTTON}
          </Typography>
        </button>
      </div>

      {/* 메인 컨텐츠 */}
      <main className="mt-12 flex flex-col px-4 py-6">
        {/* 프로필 이미지 */}
        <div className="mb-6 flex justify-center">
          <button
            onClick={openBottomSheet}
            disabled={!isDataLoaded}
            className="relative disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={PROFILE_EDIT_LABELS.PROFILE_IMAGE_CHANGE}
          >
            <div className="relative h-19 w-19">
              <ProfileImage src={profileImageUrl} size="h-full w-full" />
            </div>
            <div className="absolute right-[-2px] bottom-[-2px] flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 bg-white">
              <Camera className="h-5 w-5 text-gray-500" />
            </div>
          </button>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-1">
            <Typography
              font="noto"
              variant="body2B"
              className="mb-2 text-gray-900"
            >
              {PROFILE_EDIT_LABELS.NICKNAME}
            </Typography>
          </div>
          <div className="relative">
            <Input
              {...register("nickname", {
                maxLength: MAX_NICKNAME_LENGTH,
              })}
              type="text"
              placeholder={PROFILE_EDIT_PLACEHOLDERS.NICKNAME}
              disabled={!isDataLoaded}
              onChange={handleNicknameChange}
            />
            {nickname && nickname.trim().length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setValue("nickname", "", { shouldDirty: true });
                }}
                className="absolute top-1/2 right-[14px] flex h-[14px] w-[14px] -translate-y-1/2 items-center justify-center rounded-full bg-[#DFDFDF] transition-opacity hover:opacity-80"
                aria-label="입력 내용 지우기"
              >
                <X className="h-[11px] w-[11px] text-white" />
              </button>
            )}
            {nicknameError && (
              <div className="mt-1 flex w-full items-center gap-1">
                <X className="h-4 w-4 text-red-500" />
                <Typography
                  font="noto"
                  variant="label1R"
                  className="text-red-500"
                >
                  {nicknameError}
                </Typography>
              </div>
            )}
          </div>
        </div>
      </main>

      <ProfileImageBottomSheet
        isOpen={isBottomSheetOpen}
        onClose={closeBottomSheet}
        onSelectCamera={handleCameraSelect}
        onSelectGallery={handleGallerySelect}
        onSelectDefault={handleDefaultImageSelect}
      />

      <Modal
        isOpen={isUnsavedModalOpen}
        onClose={() => {
          if (!isDeletingAccount) {
            closeUnsavedModal();
          }
        }}
        onConfirm={handleUnsavedConfirm}
        title={isOnboarding ? "회원가입을 그만두시겠어요?" : "그만둘까요?"}
        description={
          isOnboarding
            ? "입력하신 정보가 저장되지 않아요. 정말 나가시겠어요?"
            : "작성 중인 내용이 사라져요."
        }
        cancelText="계속하기"
        confirmText={isDeletingAccount ? "처리 중..." : "그만두기"}
        confirmDisabled={isDeletingAccount}
      />

      <Modal
        isOpen={isErrorModalOpen}
        onClose={closeErrorModal}
        onConfirm={closeErrorModal}
        title="오류가 발생했습니다"
        description={
          errorMessage || "회원탈퇴 중 오류가 발생했습니다. 다시 시도해주세요."
        }
        confirmText="확인"
        variant="danger"
      />

      {/* 이미지 파일 타입 오류 모달 */}
      <Modal
        isOpen={isInvalidImageFileModalOpen}
        title="이미지 파일이 아니에요"
        description={PROFILE_EDIT_MESSAGES.INVALID_IMAGE_FILE}
        confirmText="확인"
        onConfirm={closeInvalidImageFileModal}
        onClose={closeInvalidImageFileModal}
        variant="primary"
      />

      {/* 이미지 크기 초과 모달 */}
      <Modal
        isOpen={isImageSizeExceededModalOpen}
        title="이미지 크기 초과"
        description={PROFILE_EDIT_MESSAGES.IMAGE_SIZE_EXCEEDED}
        confirmText="확인"
        onConfirm={closeImageSizeExceededModal}
        onClose={closeImageSizeExceededModal}
        variant="primary"
      />

      {/* 카카오 프로필 동기화 실패 모달 */}
      <Modal
        isOpen={isKakaoSyncFailedModalOpen}
        title="동기화 실패"
        description="카카오 프로필 동기화에 실패했습니다. 다시 시도해주세요."
        confirmText="확인"
        onConfirm={closeKakaoSyncFailedModal}
        onClose={closeKakaoSyncFailedModal}
        variant="primary"
      />

      {/* 닉네임 중복 확인 오류 모달 */}
      <Modal
        isOpen={isNicknameCheckErrorModalOpen}
        title="오류가 발생했어요"
        description="닉네임 중복 확인 중 오류가 발생했습니다. 다시 시도해주세요."
        confirmText="확인"
        onConfirm={closeNicknameCheckErrorModal}
        onClose={closeNicknameCheckErrorModal}
        variant="primary"
      />

      {/* 프로필 이미지 업로드 실패 모달 */}
      <Modal
        isOpen={isImageUploadFailedModalOpen}
        title="업로드 실패"
        description="프로필 이미지 업로드에 실패했습니다. 다시 시도해주세요."
        confirmText="확인"
        onConfirm={closeImageUploadFailedModal}
        onClose={closeImageUploadFailedModal}
        variant="primary"
      />

      {/* 프로필 업데이트 실패 모달 */}
      <Modal
        isOpen={isProfileUpdateFailedModalOpen}
        title="업데이트 실패"
        description="프로필 업데이트에 실패했습니다. 다시 시도해주세요."
        confirmText="확인"
        onConfirm={closeProfileUpdateFailedModal}
        onClose={closeProfileUpdateFailedModal}
        variant="primary"
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept={ACCEPT_IMAGE_EXTENSIONS}
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="카메라로 사진 촬영"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept={ACCEPT_IMAGE_EXTENSIONS}
        onChange={handleFileSelect}
        className="hidden"
        aria-label="갤러리에서 사진 선택"
      />
    </div>
  );
};

export default ProfileEditPage;
