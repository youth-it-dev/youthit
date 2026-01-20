/**
 * @description 나다움 내역 관련 상수 정의
 */

import type { HistoryType } from "@/types/reward-history";
import type {
  ActionKey,
  ChangeType,
} from "@/types/store/_nadaum-history-types";

/**
 * @description API 필터 값 상수
 */
export const API_FILTER = {
  ALL: "all",
  EARNED: "earned",
  USED: "used",
  EXPIRED: "expired",
} as const;

/**
 * @description 페이지 필터 값 상수
 */
export const PAGE_FILTER = {
  ALL: "all",
  EARN: "earn",
  USE: "use",
  EXPIRE: "expire",
} as const satisfies Record<string, "all" | HistoryType>;

/**
 * @description 변경 타입 값 상수
 */
export const CHANGE_TYPE = {
  ADD: "add",
  DEDUCT: "deduct",
} as const satisfies Record<string, ChangeType>;

/**
 * @description 액션 키 값 상수
 */
export const ACTION_KEY = {
  EXPIRATION: "expiration",
  COMMENT_DELETION: "comment",
  POST_DELETION: "post",
} as const satisfies Record<string, ActionKey>;

/**
 * @description 삭제로 표시할 액션 키 목록 (게시글/댓글 삭제 포함)
 */
export const DELETION_ACTION_KEYS: readonly string[] = [
  ACTION_KEY.COMMENT_DELETION,
  ACTION_KEY.POST_DELETION,
  "routine_post",
  "routine_review",
  "gathering_review_media",
  "tmi_review",
] as const;

/**
 * @description 히스토리 타입별 라벨 매핑
 */
export const HISTORY_TYPE_LABEL: Record<HistoryType, string> = {
  earn: "적립",
  use: "사용",
  expire: "소멸",
} as const;

/**
 * @description 소멸 예정 description 템플릿
 */
export const EXPIRATION_DESCRIPTION_TEMPLATE = (expirationDate: string) =>
  `적립 | ${expirationDate} 소멸예정` as const;

/**
 * @description 나다움 가이드 내용 (개행문자로 구분, 번호 포함)
 */
export const NADAUM_GUIDE_TEXT =
  `1. '나다움'은 유스잇에서 커뮤니티 활동을 통해 지급 받을 수 있는 포인트입니다.
2. 나다움은 유스잇에서 원하는 선물로 교환 가능하며 사용한 만큼 차감됩니다.
3. 나다움의 유효기간은 원칙적으로 적립 후 120일(4개월)이며, 유효기간 동안 사용하지 않을 경우 순차적으로 소멸됩니다. 다만, 마케팅 기타 프로모션 등을 통하여 지급되거나 사전 특약(사전 안내 포함)이 있는 나다움의 유효기간은 각각 별도로 설정될 수 있습니다.
4. 나다움은 제 3자에게 양도할 수 없으며 유상으로 거래하거나 현금으로 전환할 수 없습니다.
5. 유스잇은 회원이 유스잇에서 승인하지 않은 방법으로 나다움을 획득하거나 부정한 목적이나 용도로 나다움을 사용하는 경우 나다움의 사용을 제한하거나 회원 자격을 정지할 수 있습니다.
6. 유스잇 회원 탈퇴 시 나다움은 즉시 소멸되며, 탈퇴 후 재가입 하더라도 소멸된 나다움은 복구되지 않습니다.` as const;
