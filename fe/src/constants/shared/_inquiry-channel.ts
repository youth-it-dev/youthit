/**
 * @description 문의 채널 관련 상수
 * - 카카오톡 채널 및 인스타그램 DM 연결 정보
 */

export const INQUIRY_CHANNELS = {
  kakao: {
    id: "kakao",
    name: "카카오톡 문의하기",
    description: "카카오톡 채널로 연결됩니다",
    url: "https://pf.kakao.com/_kTGuxj",
  },
  instagram: {
    id: "instagram",
    name: "인스타그램 DM",
    description: "인스타그램 DM으로 연결됩니다",
    url: "https://www.instagram.com/youthvoice_my/",
  },
} as const;

export type InquiryChannelType = keyof typeof INQUIRY_CHANNELS;
