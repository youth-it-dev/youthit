import { ComponentPropsWithoutRef, ElementType, forwardRef } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/shared/cn";

const VARIANT_MAP = {
  display1: { size: "40", weight: "bold" },
  display2: { size: "32", weight: "bold" },
  title1: { size: "34", weight: "bold" },
  title2: { size: "30", weight: "bold" },
  title3: { size: "26", weight: "bold" },
  title4: { size: "22", weight: "bold" },
  title5: { size: "20", weight: "bold" },
  heading1B: { size: "22", weight: "bold" },
  heading1M: { size: "22", weight: "medium" },
  heading2B: { size: "18", weight: "bold" },
  heading2M: { size: "18", weight: "medium" },
  heading3B: { size: "16", weight: "bold" },
  heading3M: { size: "16", weight: "medium" },
  body1B: { size: "16", weight: "bold" },
  body1M: { size: "16", weight: "medium" },
  body1R: { size: "16", weight: "regular" },
  body2B: { size: "14", weight: "bold" },
  body2M: { size: "14", weight: "medium" },
  body2R: { size: "14", weight: "regular" },
  caption1B: { size: "12", weight: "bold" },
  caption1M: { size: "12", weight: "medium" },
  caption1R: { size: "12", weight: "regular" },
  caption2B: { size: "11", weight: "bold" },
  caption2M: { size: "11", weight: "medium" },
  caption2R: { size: "11", weight: "regular" },
  body3B: { size: "13", weight: "bold" },
  body3M: { size: "13", weight: "medium" },
  body3R: { size: "13", weight: "regular" },
  label1B: { size: "12", weight: "bold" },
  label1M: { size: "12", weight: "medium" },
  label1R: { size: "12", weight: "regular" },
  label2B: { size: "11", weight: "bold" },
  label2M: { size: "11", weight: "medium" },
  label2R: { size: "11", weight: "regular" },
} as const;

const typographyVariants = cva("whitespace-pre-line text-wrap leading-[1.5]", {
  variants: {
    font: {
      noto: "font-noto",
      gill: "font-gill",
    },
    size: {
      "11": "text-[11px]",
      "12": "text-[12px]",
      "13": "text-[13px]",
      "14": "text-[14px]",
      "16": "text-[16px]",
      "18": "text-[18px]",
      "20": "text-[20px]",
      "22": "text-[22px]",
      "26": "text-[26px]",
      "30": "text-[30px]",
      "32": "text-[32px]",
      "34": "text-[34px]",
      "40": "text-[40px]",
    },
    weight: {
      regular: "font-normal",
      medium: "font-medium",
      bold: "font-bold",
    },
    color: {
      black: "text-black-100",
      white: "text-white-100",
    },
  },
  defaultVariants: {
    font: "noto",
    color: "black",
    weight: "regular",
  },
});

export type TypographyVariant = keyof typeof VARIANT_MAP;

export type TypographyProps = {
  variant?: TypographyVariant;
  font?: "noto" | "gill";
  size?:
    | "11"
    | "12"
    | "13"
    | "14"
    | "16"
    | "18"
    | "20"
    | "22"
    | "26"
    | "30"
    | "32"
    | "34"
    | "40";
  weight?: "regular" | "medium" | "bold";
  color?: "black" | "white";
  as?: ElementType;
} & ComponentPropsWithoutRef<ElementType>;

const Typography = forwardRef<HTMLElement, TypographyProps>(
  (
    {
      as: Component = "span",
      className,
      variant,
      font,
      size,
      weight,
      color,
      ...props
    },
    ref
  ) => {
    // variant가 있으면 해당 스타일을 사용, 없으면 개별 props 사용
    const variantStyle = variant
      ? VARIANT_MAP[variant as keyof typeof VARIANT_MAP]
      : { size: undefined, weight: undefined };

    const finalFont = font ?? "noto";
    const finalSize = size ?? variantStyle?.size ?? "16";
    const finalWeight = weight ?? variantStyle?.weight ?? "regular";
    const finalColor = color ?? "black";

    return (
      <Component
        ref={ref}
        className={cn(
          typographyVariants({
            font: finalFont,
            size: finalSize,
            weight: finalWeight,
            color: finalColor,
          }),
          className
        )}
        {...props}
      />
    );
  }
);

Typography.displayName = "Typography";

export { Typography };

/**
 * Typography 컴포넌트 사용 예시:
 *
 * // Font와 Variant 조합 사용 (권장)
 * <Typography font="noto" variant="display1">큰 제목</Typography>
 * <Typography font="noto" variant="body2M">본문</Typography>
 * <Typography font="gill" variant="title1">Gill 폰트 제목</Typography>
 *
 * // 개별 props 사용
 * <Typography font="noto" size="16" weight="medium">텍스트</Typography>
 *
 * // HTML 태그 지정
 * <Typography as="h1" font="noto" variant="title1">시맨틱 제목</Typography>
 *
 * // Variant와 개별 props 조합 (variant 우선)
 * <Typography font="noto" variant="body1M" color="white">흰색 본문</Typography>
 *
 * // 커스텀 스타일과 조합
 * <Typography font="noto" variant="body2B" className="text-blue-500">
 *   커스텀 스타일
 * </Typography>
 */
