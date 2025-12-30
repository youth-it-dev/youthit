import { ComponentProps } from "react";
import { cn } from "@/utils/shared/cn";

/**
 * @description 디자인 시스템 input
 */
const Input = ({ className, readOnly, ...props }: ComponentProps<"input">) => {
  return (
    <input
      className={cn(
        "font-noto focus:ring-main-400 focus:outline-main-500/50 focus:border-main-500 w-full rounded-md border border-gray-200 bg-white px-3 py-2 pr-10 text-base leading-1.5 font-normal shadow-xs focus:outline-3",
        className
      )}
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : undefined}
      onMouseDown={
        readOnly
          ? (e) => {
              // readOnly일 경우 마우스 클릭으로 포커스가 잡히지 않도록 방지
              e.preventDefault();
            }
          : undefined
      }
      {...props}
    />
  );
};

export default Input;
