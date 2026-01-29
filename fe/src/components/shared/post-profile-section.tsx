import { useState, useEffect } from "react";
import { User } from "lucide-react";
import { Typography } from "@/components/shared/typography";
import AdminBadge from "@/components/shared/ui/admin-badge";
import { getTimeAgo } from "@/utils/shared/date";

interface PostProfileSectionProps {
  /**
   * @description 프로필 이미지 URL
   */
  profileImageUrl?: string;
  /**
   * @description 작성자 이름
   */
  author?: string;
  /**
   * @description 작성 시간 (ISO 문자열)
   */
  createdAt?: string;
  /**
   * @description 조회수
   */
  viewCount?: number;
  /**
   * @description 작성자 역할 (member | admin)
   */
  role?: "member" | "admin";
  /**
   * @description 추가 클래스명
   */
  className?: string;
}

/**
 * @description 게시글 프로필 섹션 컴포넌트
 * - 프로필 이미지, 작성자, 작성 시간, 조회수 표시
 * - 프로필 이미지 로드 실패 시 기본 아이콘 표시
 */
export const PostProfileSection = ({
  profileImageUrl,
  author,
  createdAt,
  viewCount,
  role,
  className,
}: PostProfileSectionProps) => {
  const [imageLoadError, setImageLoadError] = useState(false);

  // profileImageUrl 변경 시 이미지 에러 상태 리셋
  useEffect(() => {
    setImageLoadError(false);
  }, [profileImageUrl]);

  return (
    <div
      className={`mb-8 flex items-center border-b border-gray-200 pb-5 ${className || ""}`}
    >
      {profileImageUrl && !imageLoadError ? (
        <img
          src={profileImageUrl}
          alt={author || "프로필 이미지"}
          className="mr-3 h-8 w-8 rounded-full object-cover"
          onError={() => setImageLoadError(true)}
        />
      ) : (
        <User
          className="text-main-500 mr-3 h-8 w-8 rounded-full"
          strokeWidth={1.5}
        />
      )}
      <div>
        <div className="flex items-center gap-1">
          <Typography font="noto" variant="body2R" className="text-gray-950">
            {author || "익명"}
          </Typography>
          <AdminBadge role={role} />
        </div>
        <div className="flex items-center gap-1">
          {createdAt && (
            <Typography font="noto" variant="body2R" className="text-gray-500">
              {getTimeAgo(createdAt)}
            </Typography>
          )}
          {viewCount !== undefined && (
            <Typography font="noto" variant="body2R" className="text-gray-500">
              조회 {viewCount}
            </Typography>
          )}
        </div>
      </div>
    </div>
  );
};
