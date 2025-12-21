"use client";

import Modal from "@/components/shared/ui/modal";

interface NotificationPermissionModalProps {
  /** 모달 열림/닫힘 상태 */
  isOpen: boolean;
  /** 알림 허용 버튼 클릭 핸들러 (사용자 제스처 컨텍스트 내에서 권한 요청) */
  onAllow: () => void;
  /** 나중에 버튼 클릭 핸들러 */
  onLater: () => void;
}

/**
 * @description 알림 권한 요청 모달
 *
 * 사용자 제스처 기반 권한 요청을 위해 모달을 사용합니다.
 * 모달의 "알림 허용" 버튼 클릭 시 권한 요청이 수행되므로,
 * 브라우저가 사용자 제스처로 인식하여 권한 팝업이 정상적으로 표시됩니다.
 */
const NotificationPermissionModal = ({
  isOpen,
  onAllow,
  onLater,
}: NotificationPermissionModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      title="알림을 받아보세요"
      description="새로운 소식과 중요한 업데이트를 놓치지 마세요. 알림을 허용하면 실시간으로 알림을 받을 수 있습니다."
      confirmText="알림 허용"
      cancelText="나중에"
      onConfirm={onAllow}
      onClose={onLater}
      variant="primary"
      closeOnOverlayClick={true}
      closeOnEscape={true}
    />
  );
};

export default NotificationPermissionModal;
