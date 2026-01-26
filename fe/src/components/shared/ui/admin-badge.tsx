import { cn } from "@/utils/shared/cn";

interface AdminBadgeProps {
  /**
   * @description 사용자 역할 (admin일 때만 뱃지 표시)
   */
  role?: "member" | "admin";
  /**
   * @description 추가 클래스명
   */
  className?: string;
}

/**
 * @description 관리자(끗장) 뱃지 컴포넌트
 * - role이 "admin"일 때만 표시
 */
const AdminBadge = ({ role, className }: AdminBadgeProps) => {
  if (role !== "admin") {
    return null;
  }

  return (
    <span
      className={cn(
        "rounded-xs bg-blue-50 px-1 py-0.5 text-[10px] font-medium text-blue-600",
        className
      )}
    >
      끗장
    </span>
  );
};

export default AdminBadge;
