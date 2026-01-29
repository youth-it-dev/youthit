"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  REWARD_HISTORY_DATA,
  REWARD_HISTORY_TABS,
} from "@/constants/reward-history";
import { useTopBarStore } from "@/stores/shared/topbar-store";

const RewardsHistoryPage = () => {
  const [activeTab, setActiveTab] =
    useState<(typeof REWARD_HISTORY_TABS)[number]["key"]>("all");
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const setTitle = useTopBarStore((state) => state.setTitle);
  const setRightSlot = useTopBarStore((state) => state.setRightSlot);
  const resetTopBar = useTopBarStore((state) => state.reset);

  const availableRewards = 1500;
  const expiringRewards = 120;

  const filteredHistory = useMemo(() => {
    if (activeTab === "all") return REWARD_HISTORY_DATA;

    return REWARD_HISTORY_DATA.map((section) => ({
      date: section.date,
      items: section.items.filter((item) => item.type === activeTab),
    })).filter((section) => section.items.length > 0);
  }, [activeTab]);

  const handleGuideOpen = useCallback(() => {
    setIsGuideOpen(true);
  }, []);

  const handleGuideClose = useCallback(() => {
    setIsGuideOpen(false);
  }, []);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const infoButton = (
      <button
        type="button"
        aria-label="리워드 안내"
        onClick={handleGuideOpen}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-sm font-semibold text-gray-600"
      >
        i
      </button>
    );
    setTitle("나다움 내역");
    setRightSlot(infoButton);

    return () => {
      resetTopBar();
    };
  }, [handleGuideOpen, setTitle, setRightSlot, resetTopBar]);

  useEffect(() => {
    if (!isGuideOpen) return;

    previouslyFocusedElement.current =
      document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const focusableSelectors =
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";
    const focusableElements =
      modalRef.current?.querySelectorAll<HTMLElement>(focusableSelectors);
    const firstFocusable = focusableElements?.[0];
    const lastFocusable =
      focusableElements && focusableElements[focusableElements.length - 1];

    if (firstFocusable) {
      firstFocusable.focus();
    } else {
      modalRef.current?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleGuideClose();
      }

      if (
        event.key === "Tab" &&
        focusableElements &&
        focusableElements.length > 0
      ) {
        if (event.shiftKey) {
          if (document.activeElement === firstFocusable) {
            event.preventDefault();
            lastFocusable?.focus();
          }
        } else if (document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedElement.current?.focus();
    };
  }, [isGuideOpen, handleGuideClose]);

  return (
    <>
      <div className="min-h-screen bg-white pb-16">
        <section className="px-5 pt-16">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">사용 가능한 나다움</span>
              <span className="text-main-500 text-2xl font-semibold">
                {availableRewards}
                <span className="ml-1 text-2xl font-semibold">N</span>
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-400">소멸 예정인 나다움</span>
              <span className="text-2xl font-semibold text-gray-700">
                {expiringRewards}
                <span className="ml-1 text-2xl font-semibold">N</span>
              </span>
            </div>
          </div>
        </section>

        <nav className="mt-6 flex flex-wrap gap-2 px-5">
          {REWARD_HISTORY_TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-500 shadow-sm"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-6 space-y-6 px-5 pb-10">
          {filteredHistory.length === 0 && (
            <div className="rounded-3xl border border-gray-100 bg-white py-16 text-center text-sm text-gray-400 shadow-sm">
              해당 내역이 아직 없어요.
            </div>
          )}

          {filteredHistory.map((section) => (
            <section key={section.date}>
              <p className="text-xs font-medium text-gray-400">
                {section.date}
              </p>
              <div className="mt-3 divide-y divide-gray-100 border-t border-b border-gray-100">
                {section.items.map((item) => {
                  const amount =
                    item.amount > 0 ? `+${item.amount}N` : `${item.amount}N`;
                  const amountColor =
                    item.type === "earn" ? "text-rose-500" : "text-gray-500";
                  const detailText =
                    item.description ?? (item.amount > 0 ? "적립" : "사용");

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-4"
                    >
                      <div className="max-w-[65%]">
                        <p className="text-sm font-medium text-gray-900">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {detailText}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-semibold ${amountColor}`}>
                          {amount}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {isGuideOpen && (
        <div className="fixed inset-0 bg-black/70" style={{ zIndex: 999 }}>
          <button
            type="button"
            aria-label="나다움 가이드 닫기"
            onClick={handleGuideClose}
            className="absolute inset-0 h-full w-full"
          />
          <div
            ref={modalRef}
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-6 pt-4 pb-10 focus:outline-none"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rewards-guide-title"
            style={{ zIndex: 1000 }}
          >
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-gray-200" />
            <button
              type="button"
              onClick={handleGuideClose}
              className="absolute top-4 right-6 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-lg font-semibold text-gray-500"
              aria-label="나다움 가이드 닫기"
            >
              ×
            </button>
            <h2
              id="rewards-guide-title"
              className="text-lg font-semibold text-gray-900"
            >
              나다움 가이드
            </h2>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-gray-600">
              <li>
                1. ‘나다움’은 유스잇에서 커뮤니티 활동을 통해 지급 받을 수 있는
                포인트입니다.
              </li>
              <li>
                2. 나다움은 유스잇에서 원하는 선물로 교환 가능하며 사용한 만큼
                차감됩니다.
              </li>
              <li>
                3. 나다움의 유효기간은 원칙적으로 적립 후 120일(4개월)이며,
                유효기간 동안 사용하지 않을 경우 순차적으로 소멸됩니다. 다만,
                마케팅 기타 프로모션 등을 통하여 지급되거나 사전 특약(사전 안내
                포함)이 있는 나다움의 유효기간은 각각 별도로 설정될 수 있습니다.
              </li>
              <li>
                4. 나다움은 제 3자에게 양도할 수 없으며 유상으로 거래하거나
                현금으로 전환할 수 없습니다.
              </li>
              <li>
                5. 유스잇은 회원이 유스잇에서 승인하지 않은 방법으로 나다움을
                획득하거나 부정한 목적이나 용도로 나다움을 사용하는 경우
                나다움의 사용을 제한하거나 회원 자격을 정지할 수 있습니다.
              </li>
              <li>
                6. 유스잇 회원 탈퇴 시 나다움은 즉시 소멸되며, 탈퇴 후 재가입
                하더라도 소멸된 나다움은 복구되지 않습니다.
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
};

export default RewardsHistoryPage;
