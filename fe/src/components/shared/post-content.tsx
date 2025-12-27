import { cn } from "@/utils/shared/cn";

interface PostContentProps {
  /**
   * @description 게시글 HTML 콘텐츠
   */
  content?: string;
  /**
   * @description 추가 클래스명
   */
  className?: string;
}

/**
 * @description 게시글 콘텐츠 렌더링 컴포넌트
 * - HTML 콘텐츠를 안전하게 렌더링
 * - Prose 스타일 적용
 * - 이미지, 링크, 첨부파일, 제목 스타일링
 */
export const PostContent = ({ content, className }: PostContentProps) => {
  if (!content) return null;

  return (
    <div
      className={cn(
        "post-content prose prose-sm prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2",
        "prose-a:text-blue-500 prose-a:underline prose-a:cursor-pointer prose-a:break-all",
        "wrap-break-words w-full max-w-none overflow-x-hidden whitespace-pre-wrap",
        "[&_span[data-attachment='file']]:inline-flex [&_span[data-attachment='file']]:items-center [&_span[data-attachment='file']]:gap-1 [&_span[data-attachment='file']]:select-none",
        "[&_span[data-heading='1']]:text-[22px] [&_span[data-heading='1']]:leading-snug [&_span[data-heading='1']]:font-bold",
        "[&_span[data-heading='2']]:text-[16px] [&_span[data-heading='2']]:leading-snug [&_span[data-heading='2']]:font-bold",
        "[&_span[data-heading='3']]:text-[16px] [&_span[data-heading='3']]:leading-snug [&_span[data-heading='3']]:font-medium",
        "[&_span[data-heading='4']]:text-[14px] [&_span[data-heading='4']]:leading-snug [&_span[data-heading='4']]:font-medium",
        "[&_img]:mx-auto [&_img]:block [&_img]:h-auto [&_img]:w-full [&_img]:rounded-lg",
        className
      )}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};
