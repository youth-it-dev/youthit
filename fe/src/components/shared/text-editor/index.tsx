"use client";

import { useState, useRef, useEffect } from "react";
import type { ChangeEvent, FocusEvent, KeyboardEvent } from "react";
import {
  Bold,
  Italic,
  Underline,
  Image as ImageIcon,
  Paperclip,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link,
} from "lucide-react";
import { createPortal } from "react-dom";
import { IMAGE_URL } from "@/constants/shared/_image-url";
import { TEXT_EDITOR, getTodayPrefix } from "@/constants/shared/_text-editor";
import { useGlobalClickOutside } from "@/hooks/shared/useGlobalClickOutside";
import type {
  TextEditorProps,
  FormatCommand,
  AlignCommand,
  EditorType,
  ActiveFormats,
  ColorPickerPosition,
} from "@/types/shared/text-editor";
import { cn } from "@/utils/shared/cn";
import { debug } from "@/utils/shared/debugger";
import {
  rgbToHex,
  isElementEmpty,
  setCursorPosition,
  normalizeUrl,
  elementToHtml,
  normalizeBrTags,
} from "@/utils/shared/text-editor";
import { Typography } from "../typography";
import { Button } from "../ui/button";
import Icon from "../ui/icon";
import { ToolbarButton } from "./toolbar-button";

/**
 * @description 텍스트 에디터 컴포넌트
 */
const TextEditor = ({
  className,
  minHeight = TEXT_EDITOR.DEFAULT_MIN_HEIGHT,
  initialTitleHtml,
  initialContentHtml,
  onImageUpload,
  onFileUpload,
  onTitleChange,
  onContentChange,
}: TextEditorProps) => {
  // 참조 객체들
  const titleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const headingMenuRef = useRef<HTMLDivElement>(null);
  // 사용자가 방금 선택한 색상으로 툴바 스와치를 즉시 고정하기 위한 오버라이드 플래그
  const pendingSelectedColorRef = useRef<string | null>(null);

  // 상태 관리
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [isHeadingActive, setIsHeadingActive] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>(
    TEXT_EDITOR.DEFAULT_COLOR
  );
  const [currentAlign, setCurrentAlign] = useState<AlignCommand>(
    TEXT_EDITOR.DEFAULT_ALIGN
  );
  const [activeEditor, setActiveEditor] = useState<EditorType>(null);
  const [colorPickerPosition, setColorPickerPosition] =
    useState<ColorPickerPosition>({
      top: 0,
      left: 0,
    });
  const [headingMenuPosition, setHeadingMenuPosition] =
    useState<ColorPickerPosition>({
      top: 0,
      left: 0,
    });
  // 모바일에 적절한 제목 크기(실제 태그는 span)
  const HEADING_CLASS_MAP = TEXT_EDITOR.HEADING_CLASS_MAP;
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>({
    bold: false,
    italic: false,
    underline: false,
  });
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [linkPopoverPosition, setLinkPopoverPosition] =
    useState<ColorPickerPosition>({ top: 0, left: 0 });
  const [linkUrlInput, setLinkUrlInput] = useState("");
  const [linkTextInput, setLinkTextInput] = useState("");
  const [linkError, setLinkError] = useState<string>("");
  const linkPopoverRef = useRef<HTMLDivElement>(null);
  const [showDatePrefix, setShowDatePrefix] = useState(false);

  // 팝오버 뷰포트 경계 제한 상수
  const POPOVER_WIDTH = 280;
  const VIEWPORT_MARGIN = 8;

  /**
   * 팝오버 위치를 뷰포트 경계 내로 클램핑
   * @param position - 원본 위치 (top, left) - scrollX/scrollY가 포함된 절대 좌표
   * @param popoverWidth - 팝오버 너비 (기본값: POPOVER_WIDTH)
   * @returns 클램핑된 위치
   */
  const clampPopoverPosition = (
    position: ColorPickerPosition,
    popoverWidth: number = POPOVER_WIDTH
  ): ColorPickerPosition => {
    // 스크롤 오프셋을 고려한 viewport 경계 계산
    // (position 값이 이미 scrollX/scrollY를 포함하므로 경계도 동일하게 포함해야 함)
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    const minLeft = scrollX + VIEWPORT_MARGIN;
    const maxLeft =
      scrollX + window.innerWidth - popoverWidth - VIEWPORT_MARGIN;

    const minTop = scrollY + VIEWPORT_MARGIN;
    // 팝오버 높이는 대략 150px로 가정 (링크 팝오버 기준)
    const estimatedPopoverHeight = 150;
    const maxTop =
      scrollY + window.innerHeight - estimatedPopoverHeight - VIEWPORT_MARGIN;

    return {
      top: Math.max(minTop, Math.min(position.top, maxTop)),
      left: Math.max(minLeft, Math.min(position.left, maxLeft)),
    };
  };

  /**
   * 툴바 요소를 가져오거나 폴백 위치 반환
   * @returns 툴바 rect 또는 null (폴백 필요 시)
   */
  const getToolbarRect = (): DOMRect | null => {
    // 1순위: toolbarRef 사용
    if (toolbarRef.current) {
      return toolbarRef.current.getBoundingClientRect();
    }

    // 2순위: data-toolbar 속성으로 찾기 (폴백)
    const toolbarByAttr = containerRef.current?.querySelector(
      '[data-toolbar="editor"]'
    );
    if (toolbarByAttr) {
      return toolbarByAttr.getBoundingClientRect();
    }

    // 툴바를 찾지 못함 - 경고 로그
    debug.warn(
      "TextEditor: 툴바 요소를 찾을 수 없습니다. toolbarRef 또는 data-toolbar 속성을 확인하세요."
    );
    return null;
  };

  /**
   * 툴바 기반 폴백 위치 계산 (툴바를 찾지 못했을 때)
   * 에디터 컨테이너 상단 중앙에 위치
   * @returns scrollX/scrollY가 포함된 절대 좌표
   */
  const getFallbackPopoverPosition = (): ColorPickerPosition => {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      return {
        top: containerRect.top + scrollY + 50,
        left: Math.max(
          scrollX + VIEWPORT_MARGIN,
          containerRect.left +
            containerRect.width / 2 -
            POPOVER_WIDTH / 2 +
            scrollX
        ),
      };
    }
    // 최후의 폴백: 화면 중앙
    return {
      top: 100 + scrollY,
      left: Math.max(
        scrollX + VIEWPORT_MARGIN,
        scrollX + window.innerWidth / 2 - POPOVER_WIDTH / 2
      ),
    };
  };

  /**
   * 현재 선택 영역을 저장
   * 툴바 버튼 클릭 시 포커스가 이동해도 선택 영역을 유지하기 위함
   */
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedSelectionRef.current = selection.getRangeAt(0);
    }
  };

  /**
   * 저장된 선택 영역을 복원
   * 툴바 버튼 클릭 후 원래 선택 영역으로 돌아가기 위함
   */
  const restoreSelection = () => {
    const selection = window.getSelection();
    if (savedSelectionRef.current && selection) {
      selection.removeAllRanges();
      selection.addRange(savedSelectionRef.current);
    }
  };

  /**
   * 플레이스홀더 표시 여부를 확인하고 상태 업데이트
   * @param element - 확인할 HTML 요소
   * @param type - "title" 또는 "content"
   */
  const checkPlaceholder = (element: HTMLElement | null) => {
    if (!element) return;

    const isEmpty = isElementEmpty(element);
    if (isEmpty && element.innerHTML !== "") {
      element.innerHTML = "";
    }
  };

  /**
   * 현재 활성화된 에디터의 ref 반환
   * @returns titleRef 또는 contentRef
   */
  const getActiveEditorRef = () => {
    return activeEditor === "title" ? titleRef : contentRef;
  };

  // 색상 감지
  const updateColorFromSelection = () => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    let element =
      container.nodeType === Node.TEXT_NODE
        ? container.parentElement
        : (container as Element);

    while (element && element !== document.body) {
      const color = window.getComputedStyle(element).color;
      if (color && color !== "rgb(0, 0, 0)" && color !== "rgba(0, 0, 0, 0)") {
        setSelectedColor(rgbToHex(color, TEXT_EDITOR.DEFAULT_COLOR));
        return;
      }
      element = element.parentElement;
    }

    setSelectedColor(TEXT_EDITOR.DEFAULT_COLOR);
  };

  // 서식 감지
  const updateFormatFromSelection = () => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    let element =
      container.nodeType === Node.TEXT_NODE
        ? container.parentElement
        : (container as Element);

    const formats: ActiveFormats = {
      bold: false,
      italic: false,
      underline: false,
    };

    while (element && element !== document.body) {
      const el = element as HTMLElement;
      const computedStyle = window.getComputedStyle(el);
      const tagName = el.tagName;

      const isHeadingSpan =
        typeof el.dataset?.heading !== "undefined" ||
        ["text-[22px]", "text-[18px]", "text-[16px]"].some((t) =>
          el.classList.contains(t)
        );

      if (isHeadingSpan) {
        // H1, H2에서는 B 비활성 처리 강제, H3는 허용
        const level = el.dataset?.heading ? parseInt(el.dataset.heading) : null;
        if (level === 1 || level === 2) {
          formats.bold = false;
          break;
        }
        // H3는 계속 진행하여 Bold 상태 감지 허용
      }

      if (
        computedStyle.fontWeight === "bold" ||
        computedStyle.fontWeight === "700" ||
        tagName === "B" ||
        tagName === "STRONG"
      ) {
        formats.bold = true;
      }

      if (
        computedStyle.fontStyle === "italic" ||
        tagName === "I" ||
        tagName === "EM"
      ) {
        formats.italic = true;
      }

      if (
        (computedStyle.textDecoration.includes("underline") ||
          tagName === "U") &&
        tagName !== "A" // 링크 요소의 밑줄은 무시
      ) {
        formats.underline = true;
      }

      element = element.parentElement;
    }

    setActiveFormats(formats);
  };

  // 헤딩 상태 감지 (H1, H2만 활성화, H3는 비활성화)
  const updateHeadingFromSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setIsHeadingActive(false);
      return;
    }

    const node: Node | null = selection.anchorNode;
    let el: HTMLElement | null = null;
    if (!node) {
      setIsHeadingActive(false);
      return;
    }
    el = (
      node.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : (node.parentElement as HTMLElement | null)
    ) as HTMLElement | null;

    const isHeadingSpan = (target: HTMLElement | null): boolean => {
      if (!target) return false;
      if (target.dataset && typeof target.dataset.heading !== "undefined") {
        // H3는 헤딩 비활성화 (본문으로 취급)
        const level = parseInt(target.dataset.heading);
        return level === 1 || level === 2;
      }
      // 클래스 토큰 기반 체크 (H1/H2만 활성화)
      const activeTokens = ["text-[22px]", "text-[18px]"];
      return activeTokens.some((t) => target.classList.contains(t));
    };

    const container = contentRef.current || undefined;
    while (el && el !== container && el !== document.body) {
      if (isHeadingSpan(el)) {
        setIsHeadingActive(true);
        return;
      }
      el = el.parentElement;
    }
    setIsHeadingActive(false);
  };

  /**
   * 제목 입력 처리
   * 제목 내용 변경 시 호출되며 플레이스홀더 상태도 업데이트
   * 최종 제출 시에는 날짜 프리픽스를 붙여서 전송
   */
  const handleTitleInput = () => {
    if (titleRef.current && onTitleChange) {
      // 빈 링크 제거
      const anchors = titleRef.current.querySelectorAll("a");
      anchors.forEach((link) => {
        const text = (link.textContent || "").trim();
        const hasChildren = link.children.length > 0;
        if (!text && !hasChildren) {
          link.remove();
        }
      });

      const currentText = titleRef.current.textContent || "";
      const currentHtml = titleRef.current.innerHTML;

      // 입력값이 있으면 날짜 표시
      setShowDatePrefix(currentText.trim().length > 0);

      // 날짜 프리픽스를 붙여서 전송
      const datePrefix = getTodayPrefix();
      const finalHtml = currentHtml ? datePrefix + currentHtml : "";

      onTitleChange(finalHtml);
    }
    checkPlaceholder(titleRef.current);
  };

  // 디바운싱을 위한 타이머 ref
  const contentInputTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 콘텐츠를 정규화된 HTML 문자열로 변환
   * - 빈 링크 제거
   * - elementToHtml로 속성 보존
   * - normalizeBrTags로 정규화
   * @returns 정규화된 HTML 문자열 또는 null (에러 시)
   */
  const processContentToHtml = (): string | null => {
    if (!contentRef.current) return null;

    try {
      // 빈 링크 제거
      const anchors = contentRef.current.querySelectorAll("a");
      anchors.forEach((link) => {
        const text = (link.textContent || "").trim();
        const hasChildren = link.children.length > 0;
        if (!text && !hasChildren) {
          link.remove();
        }
      });

      // elementToHtml로 속성 보존하며 HTML 생성
      let html = "";
      try {
        contentRef.current.childNodes.forEach((child) => {
          html += elementToHtml(child);
        });
      } catch (error) {
        // elementToHtml 실패 시 innerHTML 사용 (폴백)
        debug.warn("elementToHtml failed, using innerHTML as fallback:", error);
        html = contentRef.current.innerHTML;
      }

      // normalizeBrTags로 정규화
      try {
        html = normalizeBrTags(html);
      } catch (error) {
        // normalizeBrTags 실패 시 원본 HTML 사용 (폴백)
        debug.warn("normalizeBrTags failed, using original HTML:", error);
      }

      return html;
    } catch (error) {
      debug.error("processContentToHtml error:", error);
      return null;
    }
  };

  /**
   * 내용 입력 처리
   * 내용 변경 시 호출되며 플레이스홀더 상태도 업데이트
   * 디바운싱을 적용하여 빠른 입력 시 성능 문제 방지
   */
  const handleContentInput = () => {
    // 플레이스홀더는 즉시 업데이트
    checkPlaceholder(contentRef.current);

    // 기존 타이머가 있으면 취소
    if (contentInputTimerRef.current) {
      clearTimeout(contentInputTimerRef.current);
    }

    // 디바운싱: 150ms 후에 실제 처리 수행
    contentInputTimerRef.current = setTimeout(() => {
      if (!onContentChange) return;

      const html = processContentToHtml();
      if (html !== null) {
        onContentChange(html);
      }
    }, 150);
  };

  /**
   * 명령 실행 후 상태 업데이트를 통합 처리
   */
  const updateEditorState = () => {
    updateFormatFromSelection();
    // 직전 사이클에 사용자 지정 색상 오버라이드가 있으면 그것을 우선 적용
    if (pendingSelectedColorRef.current) {
      setSelectedColor(pendingSelectedColorRef.current);
      pendingSelectedColorRef.current = null;
    } else {
      updateColorFromSelection();
    }
    updateHeadingFromSelection();
  };

  /**
   * 에디터 입력 이벤트 통합 처리
   */
  const handleEditorInput = () => {
    if (activeEditor === "title") {
      handleTitleInput();
    } else if (activeEditor === "content") {
      handleContentInput();
    }
  };

  /**
   * 문서 명령 실행
   * @param command - 실행할 명령 (bold, italic, foreColor 등)
   * @param value - 명령에 필요한 값 (색상 코드 등)
   */
  const executeCommand = (command: string, value?: string) => {
    // 제목 행에서는 모든 툴바 기능 비활성화
    if (activeEditor === "title") {
      return;
    }
    const editorRef = getActiveEditorRef();
    editorRef.current?.focus();
    restoreSelection();

    const success = document.execCommand(command, false, value);
    if (!success) {
      // 명령 실행 실패 - 브라우저 호환성 문제
    }

    // 명령 실행 후 UI 상태 업데이트
    setTimeout(updateEditorState, 0);

    // 입력 이벤트 트리거
    handleEditorInput();
  };

  /**
   * 현재 선택 또는 커서가 포함된 앵커 요소 탐색
   */
  const findAnchorFromSelection = (): HTMLAnchorElement | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer as Node;
    let el: HTMLElement | null =
      container.nodeType === Node.TEXT_NODE
        ? (container.parentElement as HTMLElement | null)
        : (container as HTMLElement | null);
    const root = contentRef.current || undefined;
    while (el && el !== document.body && el !== root) {
      if (el.tagName === "A") return el as HTMLAnchorElement;
      el = el.parentElement;
    }
    return null;
  };

  /**
   * 툴바 기준 팝오버 좌표 계산 (모바일에서 잘리지 않도록 상단 고정)
   * - toolbarRef를 우선 사용하고, 없으면 data-toolbar 속성으로 폴백
   * - 뷰포트 경계 내로 위치 클램핑
   */
  const updateLinkPopoverPosition = () => {
    const rect = getToolbarRect();
    if (rect) {
      const rawPosition = {
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX + 10,
      };
      setLinkPopoverPosition(clampPopoverPosition(rawPosition, POPOVER_WIDTH));
    } else {
      // 폴백 위치 사용
      setLinkPopoverPosition(
        clampPopoverPosition(getFallbackPopoverPosition(), POPOVER_WIDTH)
      );
    }
  };

  /**
   * 링크 팝오버 열기 (선택 기준)
   */
  const openLinkPopover = () => {
    if (activeEditor === "title") return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    // 선택이 없고 앵커 위라면 편집 모드 허용
    const anchor = findAnchorFromSelection();
    if (!sel.isCollapsed || anchor) {
      const selectedText = sel.toString();
      setLinkTextInput(selectedText || anchor?.textContent || "");
      setLinkUrlInput(anchor?.getAttribute("href") || "");
      setLinkError("");
      updateLinkPopoverPosition();
      setShowLinkPopover(true);
    }
  };

  /**
   * 링크 제거 (선택된 앵커 언랩)
   */
  const removeLinkAtSelection = () => {
    // 편집기 포커스 복원 및 선택 복원
    const editorRef = getActiveEditorRef();
    editorRef.current?.focus();
    restoreSelection();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    // 1차: 브라우저 unlink 명령 시도
    const unlinked = document.execCommand("unlink");
    if (!unlinked) {
      // 2차: 수동 언랩 폴백
      if (!range.collapsed) {
        const extracted = range.extractContents();
        const container = document.createElement("div");
        container.appendChild(extracted);
        const anchors = Array.from(container.querySelectorAll("a"));
        anchors.forEach((a) => {
          const parent = a.parentNode;
          if (!parent) return;
          while (a.firstChild) parent.insertBefore(a.firstChild, a);
          parent.removeChild(a);
        });
        const newFrag = document.createDocumentFragment();
        while (container.firstChild) newFrag.appendChild(container.firstChild);
        range.insertNode(newFrag);

        const after = document.createRange();
        after.setStart(range.endContainer, range.endOffset);
        after.collapse(true);
        sel.removeAllRanges();
        sel.addRange(after);
      } else {
        const anchor = findAnchorFromSelection();
        if (anchor) {
          const parent = anchor.parentNode;
          if (parent) {
            while (anchor.firstChild)
              parent.insertBefore(anchor.firstChild, anchor);
            parent.removeChild(anchor);
          }
        }
      }
    }

    setShowLinkPopover(false);
    handleContentInput();
  };

  /**
   * 링크 삽입/수정 (Selection API + DOM 조작)
   */
  const applyLinkAtSelection = () => {
    const normalized = normalizeUrl(linkUrlInput);
    if (!normalized) {
      setLinkError("유효한 URL을 입력하세요 (http/https)");
      return;
    }

    const editorRef = getActiveEditorRef();
    editorRef.current?.focus();
    restoreSelection();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    // 기존 앵커 편집
    const existingAnchor = findAnchorFromSelection();
    if (existingAnchor) {
      existingAnchor.setAttribute("href", normalized);
      existingAnchor.setAttribute("target", "_blank");
      existingAnchor.setAttribute("rel", "noopener noreferrer");
      // 텍스트 변경 옵션
      if (linkTextInput && linkTextInput !== existingAnchor.textContent) {
        existingAnchor.textContent = linkTextInput;
      }
      setShowLinkPopover(false);
      handleContentInput();
      return;
    }

    // 선택 영역이 접혀있으면 아무 것도 하지 않음 (명시적으로 텍스트 선택 필요)
    if (range.collapsed) {
      setLinkError("링크로 만들 텍스트를 먼저 선택하세요");
      return;
    }

    // 선택된 내용 추출 후 <a>로 래핑하여 삽입
    const fragment = range.extractContents();
    const anchor = document.createElement("a");
    anchor.href = normalized;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    if (linkTextInput) {
      anchor.textContent = linkTextInput;
    } else {
      anchor.appendChild(fragment);
    }
    range.insertNode(anchor);

    // 커서를 앵커 뒤로 이동
    const after = document.createRange();
    after.setStartAfter(anchor);
    after.setEndAfter(anchor);
    selection.removeAllRanges();
    selection.addRange(after);

    setShowLinkPopover(false);
    handleContentInput();
  };

  /**
   * 텍스트 서식 적용
   * @param format - 적용할 서식 (bold, italic, underline)
   */
  const handleFormat = (command: FormatCommand) => {
    executeCommand(command);
  };

  /**
   * 텍스트 정렬 적용
   * @param align - 적용할 정렬 (justifyLeft, justifyCenter, justifyRight)
   */
  const handleAlign = (command: AlignCommand) => {
    executeCommand(command);
    setCurrentAlign(command);
  };

  /**
   * 색상이 적용된 span 요소 생성
   * @param color - 적용할 색상 코드 (HEX 형식)
   * @param content - span 내부에 넣을 내용 (선택사항)
   * @returns 색상이 적용된 span 요소
   */
  const createColoredSpan = (color: string, content?: DocumentFragment) => {
    const span = document.createElement("span");
    span.style.color = color;
    if (content) {
      span.appendChild(content);
    } else {
      span.textContent = "\u200B"; // zero-width space
    }
    return span;
  };

  /**
   * 커서를 특정 요소 뒤로 이동
   * @param element - 커서를 이동할 기준 요소
   */
  const moveCursorAfter = (element: HTMLElement) => {
    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.setStartAfter(element);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  /**
   * 커서를 특정 요소 내부로 이동
   * @param element - 커서를 이동할 요소
   */
  const moveCursorInside = (element: HTMLElement) => {
    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  /**
   * 텍스트 색상 변경
   * @param color - 적용할 색상 코드 (HEX 형식)
   */
  const handleColorChange = (color: string) => {
    if (activeEditor === "title") return;

    setSelectedColor(color);
    pendingSelectedColorRef.current = color;
    setShowColorPicker(false);

    const editorRef = getActiveEditorRef();
    editorRef.current?.focus();
    restoreSelection();

    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    const span = range.collapsed
      ? createColoredSpan(color)
      : createColoredSpan(color, range.extractContents());

    range.insertNode(span);
    (range.collapsed ? moveCursorInside : moveCursorAfter)(span);

    handleEditorInput();
    setTimeout(updateEditorState, 0);
  };

  /**
   * 컬러 피커 토글
   * 컬러 피커 표시/숨김을 제어하고 위치를 계산
   * - toolbarRef를 우선 사용하고, 없으면 data-toolbar 속성으로 폴백
   * - 뷰포트 경계 내로 위치 클램핑
   */
  const handleColorPickerToggle = () => {
    if (!showColorPicker) {
      const COLOR_PICKER_WIDTH = 200; // 컬러 피커 예상 너비
      const rect = getToolbarRect();
      if (rect) {
        const rawPosition = {
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX + 80,
        };
        setColorPickerPosition(
          clampPopoverPosition(rawPosition, COLOR_PICKER_WIDTH)
        );
      } else {
        // 폴백 위치 사용
        setColorPickerPosition(
          clampPopoverPosition(getFallbackPopoverPosition(), COLOR_PICKER_WIDTH)
        );
      }
    }
    setShowColorPicker(!showColorPicker);
  };

  /**
   * Heading 메뉴 토글
   * - toolbarRef를 우선 사용하고, 없으면 data-toolbar 속성으로 폴백
   * - 뷰포트 경계 내로 위치 클램핑
   */
  const handleHeadingMenuToggle = () => {
    if (!showHeadingMenu) {
      const HEADING_MENU_WIDTH = 144; // w-36 = 9rem = 144px
      const rect = getToolbarRect();
      if (rect) {
        const rawPosition = {
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX + 10,
        };
        setHeadingMenuPosition(
          clampPopoverPosition(rawPosition, HEADING_MENU_WIDTH)
        );
      } else {
        // 폴백 위치 사용
        setHeadingMenuPosition(
          clampPopoverPosition(getFallbackPopoverPosition(), HEADING_MENU_WIDTH)
        );
      }
    }
    setShowHeadingMenu(!showHeadingMenu);
  };

  /**
   * 헤딩 스타일이 적용된 span 요소 생성
   * @param level - 헤딩 레벨 (1, 2, 3, 4)
   * @param content - span 내부에 넣을 내용 (선택사항)
   * @returns 헤딩 스타일이 적용된 span 요소
   */
  const createHeadingSpan = (
    level: 1 | 2 | 3 | 4,
    content?: DocumentFragment
  ) => {
    const span = document.createElement("span");
    const className = HEADING_CLASS_MAP[level];

    // className과 data-heading 속성을 직접 설정 (두 가지 방법 모두 사용)
    span.className = className;
    span.setAttribute("class", className); // 명시적으로 setAttribute도 사용
    span.dataset.heading = String(level);
    span.setAttribute("data-heading", String(level)); // 명시적으로 setAttribute도 사용

    if (content) {
      span.appendChild(content);
    } else {
      span.textContent = "\u200B"; // zero-width space
    }

    return span;
  };

  const handleHeadingChange = (level: 1 | 2 | 3 | 4) => {
    if (activeEditor === "title") {
      setShowHeadingMenu(false);
      return;
    }

    const editorRef = getActiveEditorRef();
    editorRef.current?.focus();
    restoreSelection();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setShowHeadingMenu(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const span = range.collapsed
      ? createHeadingSpan(level)
      : createHeadingSpan(level, range.extractContents());

    range.insertNode(span);

    // 커서 이동
    if (range.collapsed) {
      moveCursorInside(span);
    } else {
      moveCursorAfter(span);
    }

    setIsHeadingActive(true);

    if (activeEditor === "content") {
      handleContentInput();
    } else if (activeEditor === "title") {
      handleTitleInput();
    }

    setShowHeadingMenu(false);
  };

  /**
   * 이미지 업로드 버튼 클릭 처리
   */
  const handleImageClick = () => {
    // 현재 커서 위치를 저장 (이미 선택 영역이 있으면 그대로 유지)
    contentRef.current?.focus();
    if (contentRef.current) {
      const selection = window.getSelection();
      // 현재 선택 영역이 없거나 에디터 외부에 있으면 시작 위치로 이동
      if (
        !selection ||
        selection.rangeCount === 0 ||
        !contentRef.current.contains(selection.anchorNode)
      ) {
        setCursorPosition(contentRef.current, false);
      }
      saveSelection();
    }
    imageInputRef.current?.click();
  };

  /**
   * 파일 업로드 버튼 클릭 처리
   */
  const handleFileClick = () => {
    // 현재 커서 위치를 저장 (이미 선택 영역이 있으면 그대로 유지)
    contentRef.current?.focus();
    if (contentRef.current) {
      const selection = window.getSelection();
      // 현재 선택 영역이 없거나 에디터 외부에 있으면 시작 위치로 이동
      if (
        !selection ||
        selection.rangeCount === 0 ||
        !contentRef.current.contains(selection.anchorNode)
      ) {
        setCursorPosition(contentRef.current, false);
      }
      saveSelection();
    }
    fileInputRef.current?.click();
  };

  /**
   * 에디터에 이미지 삽입
   * @param imageUrl - 삽입할 이미지 URL
   */
  const insertImageToEditor = (imageUrl: string, clientId?: string) => {
    contentRef.current?.focus();

    // 저장된 선택 영역 복원 시도
    restoreSelection();

    // 복원된 선택 영역이 유효한지 확인
    const selection = window.getSelection();
    if (
      !selection ||
      selection.rangeCount === 0 ||
      (contentRef.current &&
        (!contentRef.current.contains(selection.anchorNode) ||
          !contentRef.current.contains(selection.focusNode)))
    ) {
      // 선택 영역이 없거나 에디터 외부에 있으면 에디터 끝으로 이동
      if (contentRef.current) {
        setCursorPosition(contentRef.current, true);
      }
    }

    const clientAttr = clientId ? ` data-client-id="${clientId}"` : "";
    const img = `<img src="${imageUrl}" alt="업로드된 이미지" class="max-w-full h-auto w-auto block mx-auto"${clientAttr} />`;
    const ok = document.execCommand("insertHTML", false, img);
    if (!ok && contentRef.current) {
      // execCommand 실패 시 직접 삽입 (빈 편집기 첫 삽입 등 브라우저 이슈 대비)
      contentRef.current.insertAdjacentHTML("beforeend", img);
    }
    handleContentInput();
  };

  /**
   * 에디터에 파일 링크 삽입
   * @param fileName - 파일명
   * @param fileUrl - 파일 URL
   */
  const insertFileToEditor = (
    fileName: string,
    fileUrl: string,
    clientId?: string
  ) => {
    contentRef.current?.focus();

    // 저장된 선택 영역 복원 시도
    restoreSelection();

    // 복원된 선택 영역이 유효한지 확인
    const selection = window.getSelection();
    if (
      !selection ||
      selection.rangeCount === 0 ||
      (contentRef.current &&
        (!contentRef.current.contains(selection.anchorNode) ||
          !contentRef.current.contains(selection.focusNode)))
    ) {
      // 선택 영역이 없거나 에디터 외부에 있으면 에디터 끝으로 이동
      if (contentRef.current) {
        setCursorPosition(contentRef.current, true);
      }
    }

    // 파일 첨부 블록을 원자적으로 다루기 위해 컨테이너로 래핑하고 편집 불가 처리
    const fileAttr = clientId ? ` data-file-id="${clientId}"` : "";
    const attachment = `<span data-attachment="file" class="inline-flex items-center gap-1 select-none" contenteditable="false">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#99A1AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"/></svg>
        <a href="${fileUrl}" download="${fileName}"${fileAttr}><span class="text-blue-500 underline">${fileName}</span></a>
      </span>`;
    const ok = document.execCommand("insertHTML", false, attachment + "&nbsp;");
    if (!ok && contentRef.current) {
      contentRef.current.insertAdjacentHTML("beforeend", attachment + "&nbsp;");
    }
    handleContentInput();
  };

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // 즉시 업로드는 하지 않고, clientId만 발급 받아 data-client-id로 심어 둠
      const clientId = onImageUpload
        ? await Promise.resolve(onImageUpload(file))
        : undefined;

      // clientId가 빈 문자열이면 이미지 추가 실패 (예: 최대 개수 초과)
      if (clientId === "") return;

      const previewUrl = URL.createObjectURL(file);
      insertImageToEditor(previewUrl, clientId);
    } finally {
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const clientId = onFileUpload
      ? await Promise.resolve(onFileUpload(file))
      : undefined;

    // clientId가 빈 문자열이면 파일 추가 실패 (예: 최대 개수 초과)
    if (clientId === "") return;

    const fileUrl = URL.createObjectURL(file);
    insertFileToEditor(file.name, fileUrl, clientId);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /**
   * 제목 영역 포커스 처리
   * 활성 에디터를 제목으로 설정하고 현재 서식 상태 업데이트
   */
  const handleTitleFocus = () => {
    setActiveEditor("title");
    setTimeout(() => {
      updateColorFromSelection();
      updateFormatFromSelection();
      checkPlaceholder(titleRef.current);
    }, 0);
  };

  /**
   * 내용 영역 포커스 처리
   * 활성 에디터를 내용으로 설정하고 현재 서식 상태 업데이트
   */
  const handleContentFocus = () => {
    setActiveEditor("content");
    setTimeout(() => {
      updateColorFromSelection();
      updateFormatFromSelection();
      checkPlaceholder(contentRef.current);
    }, 0);
  };

  /**
   * 포커스를 내용 영역으로 이동
   * 내용 영역이 비어있으면 시작 위치에 커서 설정
   */
  const moveFocusToContent = () => {
    setTimeout(() => {
      contentRef.current?.focus();
      if (contentRef.current && contentRef.current.innerHTML === "") {
        setCursorPosition(contentRef.current, false);
      }
    }, 0);
  };

  /**
   * 포커스를 제목 영역으로 이동
   * 제목 영역의 끝 위치에 커서 설정
   */
  const moveFocusToTitle = () => {
    setTimeout(() => {
      titleRef.current?.focus();
      setCursorPosition(titleRef.current!, true);
    }, 0);
  };

  /**
   * 내용을 모두 지우고 내용 영역으로 포커스 이동
   * Ctrl+A + Delete 시 사용
   */
  const clearContentAndFocus = () => {
    if (contentRef.current) {
      contentRef.current.innerHTML = "";
    }
    moveFocusToContent();
  };

  // 키보드 핸들러들
  /**
   * 제목 영역 키보드 이벤트 처리
   * Enter, Tab, ArrowDown: 내용 영역으로 이동
   * Ctrl+A + Delete: 내용 지우고 내용 영역으로 이동
   */
  const handleTitleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+A + Delete: 내용 지우고 내용 영역으로 포커스 이동
    if (
      (e.key === "Backspace" || e.key === "Delete") &&
      e.ctrlKey &&
      titleRef.current
    ) {
      const selection = window.getSelection();
      const hasSelection =
        selection && selection.rangeCount > 0 && !selection.isCollapsed;

      if (hasSelection) {
        e.preventDefault();
        clearContentAndFocus();
        return;
      }
    }

    // Enter: 내용 영역으로 이동
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      moveFocusToContent();
    }

    // ArrowDown: 내용 영역으로 이동
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      moveFocusToContent();
    }

    // Tab: 내용 영역으로 이동
    if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      contentRef.current?.focus();
    }
  };

  /**
   * 내용 영역 키보드 이벤트 처리
   * Delete/Backspace: 선택된 텍스트 삭제 또는 제목으로 이동
   * ArrowUp: 첫 번째 줄에서 제목으로 이동
   */
  const handleContentKeyDown = (e: KeyboardEvent) => {
    // Delete/Backspace 처리
    if ((e.key === "Backspace" || e.key === "Delete") && contentRef.current) {
      const selection = window.getSelection();
      const hasSelection =
        selection && selection.rangeCount > 0 && !selection.isCollapsed;
      const textContent = contentRef.current.textContent?.trim() || "";

      if (hasSelection) {
        // 삭제 후 내용이 비어질지 확인
        const willBeEmpty = (() => {
          const selectedText = selection.toString();
          const remainingText = textContent.replace(selectedText, "").trim();
          return remainingText === "";
        })();

        if (willBeEmpty) {
          // 전체 선택 삭제: 수동으로 삭제하고 포커스 이동
          e.preventDefault();

          // 내용 수동으로 지우기
          if (contentRef.current) {
            contentRef.current.innerHTML = "";
          }

          // 지운 후 제목으로 포커스 이동
          setTimeout(() => {
            moveFocusToTitle();
          }, 0);
          return;
        }
        // 삭제 후 비어있지 않으면 일반 동작 허용
      } else if (textContent === "") {
        // 빈 내용: 제목으로 이동
        e.preventDefault();
        moveFocusToTitle();
        return;
      }
    }

    // 첫 번째 줄 시작에서 Backspace: 제목으로 이동
    if (e.key === "Backspace" && contentRef.current) {
      // 위의 선택 로직에서 이미 처리했으면 건너뛰기
      const selection = window.getSelection();
      const hasSelection =
        selection && selection.rangeCount > 0 && !selection.isCollapsed;
      if (hasSelection) {
        return; // 이미 위에서 처리됨
      }

      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);

        // 더 정확한 체크: 커서가 내용 영역의 맨 처음에 있는지 확인
        const isAtStartOfContent = (() => {
          try {
            // contentRef 시작부터 현재 위치까지의 Range 생성
            const testRange = document.createRange();
            testRange.setStart(contentRef.current!, 0);
            testRange.setEnd(range.startContainer, range.startOffset);

            // Range가 접혀있고 위치가 0이면 시작점에 있음
            return testRange.collapsed && testRange.startOffset === 0;
          } catch {
            return false;
          }
        })();

        if (isAtStartOfContent) {
          e.preventDefault();
          moveFocusToTitle();
        }
      }
    }

    // 첫 번째 줄에서 ArrowUp: 제목으로 이동
    if (e.key === "ArrowUp" && contentRef.current) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const isAtFirstLine = (() => {
          try {
            const testRange = range.cloneRange();
            testRange.setStart(contentRef.current!, 0);
            testRange.collapse(true);
            return (
              range.compareBoundaryPoints(Range.START_TO_START, testRange) === 0
            );
          } catch {
            return false;
          }
        })();

        if (isAtFirstLine) {
          e.preventDefault();
          moveFocusToTitle();
        }
      }
    }
  };

  // 블러 처리
  /**
   * 에디터 블러 이벤트 처리
   * 툴바나 컬러 피커 클릭 시에는 블러 방지
   * 포커스를 잃을 때 대기 중인 입력 처리를 즉시 실행
   */
  const handleBlur = (e: FocusEvent) => {
    saveSelection();

    // 툴바나 컬러 피커 클릭 시 블러 방지
    if (
      containerRef.current?.contains(e.relatedTarget as Node) ||
      colorPickerRef.current?.contains(e.relatedTarget as Node)
    ) {
      return;
    }

    // 포커스를 잃을 때도 placeholder 상태를 강제 동기화하여 항상 보이도록 유지
    checkPlaceholder(titleRef.current);
    checkPlaceholder(contentRef.current);

    // 대기 중인 입력 처리가 있으면 즉시 실행 (마지막 입력이 반영되도록)
    if (contentInputTimerRef.current) {
      clearTimeout(contentInputTimerRef.current);
      contentInputTimerRef.current = null;

      if (onContentChange) {
        const html = processContentToHtml();
        if (html !== null) {
          onContentChange(html);
        }
      }
    }
  };

  const alignIconMap = {
    justifyLeft: AlignLeft,
    justifyCenter: AlignCenter,
    justifyRight: AlignRight,
  } as const;

  /**
   * 정렬 순환 처리
   * 정렬 버튼 클릭 시 다음 정렬로 순환
   */
  const cycleAlign = () => {
    const alignments: AlignCommand[] = [
      "justifyLeft",
      "justifyCenter",
      "justifyRight",
    ];
    const currentIndex = alignments.indexOf(currentAlign);
    const nextAlign = alignments[(currentIndex + 1) % alignments.length];
    handleAlign(nextAlign);
  };

  useEffect(() => {
    checkPlaceholder(titleRef.current);
    checkPlaceholder(contentRef.current);
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (contentInputTimerRef.current) {
        clearTimeout(contentInputTimerRef.current);
      }
    };
  }, []);

  /**
   * 외부에서 전달된 초기 콘텐츠를 ref에 반영
   * - 최초 마운트 이후 값이 바뀌어도 반영되도록 의존성 포함
   * - 날짜 프리픽스를 제거하고 실제 내용만 표시
   */
  useEffect(() => {
    if (typeof initialTitleHtml === "string" && titleRef.current) {
      const datePrefix = getTodayPrefix();
      // 날짜 프리픽스가 있으면 제거
      const htmlWithoutPrefix = initialTitleHtml.startsWith(datePrefix)
        ? initialTitleHtml.substring(datePrefix.length)
        : initialTitleHtml;

      titleRef.current.innerHTML = htmlWithoutPrefix || "";

      // 입력값이 있으면 날짜 표시
      const textContent = titleRef.current.textContent || "";
      setShowDatePrefix(textContent.trim().length > 0);

      // 외부 값 반영 후 폼 동기화
      if (onTitleChange) onTitleChange(initialTitleHtml);
      checkPlaceholder(titleRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTitleHtml]);

  useEffect(() => {
    if (typeof initialContentHtml === "string" && contentRef.current) {
      contentRef.current.innerHTML = initialContentHtml || "";
      // 외부 값 반영 후 폼 동기화
      if (onContentChange) {
        let html = "";
        contentRef.current.childNodes.forEach((child) => {
          html += elementToHtml(child);
        });
        onContentChange(html);
      }
      checkPlaceholder(contentRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContentHtml]);

  useGlobalClickOutside(
    showColorPicker || showHeadingMenu || showLinkPopover,
    [
      { ref: colorPickerRef, onOutside: () => setShowColorPicker(false) },
      { ref: headingMenuRef, onOutside: () => setShowHeadingMenu(false) },
      { ref: linkPopoverRef, onOutside: () => setShowLinkPopover(false) },
    ],
    "mousedown"
  );

  const AlignIcon = alignIconMap[currentAlign] || AlignLeft;

  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-background border-gray-30 relative flex max-w-full flex-col bg-white",
        className
      )}
    >
      {/* Sticky Toolbar */}
      <div
        ref={toolbarRef}
        data-toolbar="editor"
        className="sticky top-0 z-40 flex w-full touch-manipulation items-center gap-2 overflow-x-auto border-b border-gray-300 bg-white px-5 pt-2 pb-2"
      >
        {/* Heading (H1~H3) - Toolbar 가장 왼쪽 */}
        <div className="relative flex items-center justify-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onMouseDown={(e) => {
              if (activeEditor !== "title") {
                saveSelection();
              }
              e.preventDefault();
            }}
            onClick={handleHeadingMenuToggle}
            aria-label="글자 크기"
            tabIndex={-1}
            disabled={activeEditor === "title"}
          >
            {/* '가' 아이콘 형태 */}
            <Icon
              src={IMAGE_URL.ICON.heading.url}
              width={16}
              height={16}
              className={cn(
                activeEditor === "title"
                  ? "text-gray-300"
                  : isHeadingActive
                    ? "text-black"
                    : "text-gray-400"
              )}
            />
          </Button>

          {showHeadingMenu &&
            createPortal(
              <div
                ref={headingMenuRef}
                className="fixed z-[9999] w-36 overflow-hidden rounded border border-gray-300 bg-white shadow-sm"
                style={{
                  top: `${headingMenuPosition.top}px`,
                  left: `${headingMenuPosition.left}px`,
                }}
              >
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-[22px] leading-snug font-bold hover:bg-gray-50"
                  onClick={() => handleHeadingChange(1)}
                >
                  제목1
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-[16px] leading-snug font-bold hover:bg-gray-50"
                  onClick={() => handleHeadingChange(2)}
                >
                  제목2
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-[16px] leading-snug font-medium hover:bg-gray-50"
                  onClick={() => handleHeadingChange(3)}
                >
                  본문1
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-[14px] leading-snug font-medium hover:bg-gray-50"
                  onClick={() => handleHeadingChange(4)}
                >
                  본문2
                </button>
              </div>,
              document.body
            )}
        </div>

        {/* Format buttons */}
        <ToolbarButton
          onClick={() => handleFormat("bold")}
          ariaLabel="굵게"
          disabled={activeEditor === "title"}
          onMouseDown={(e) => {
            if (activeEditor !== "title") {
              saveSelection();
            }
            e.preventDefault();
          }}
        >
          <Bold
            className={cn(
              "size-5",
              activeEditor === "title"
                ? "text-gray-300"
                : activeFormats.bold
                  ? "text-black"
                  : "text-gray-400"
            )}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => handleFormat("underline")}
          ariaLabel="밑줄"
          disabled={activeEditor === "title"}
          onMouseDown={(e) => {
            if (activeEditor !== "title") {
              saveSelection();
            }
            e.preventDefault();
          }}
        >
          <Underline
            className={cn(
              "size-5",
              activeEditor === "title"
                ? "text-gray-300"
                : activeFormats.underline
                  ? "text-black"
                  : "text-gray-400"
            )}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => handleFormat("italic")}
          ariaLabel="기울임"
          disabled={activeEditor === "title"}
          onMouseDown={(e) => {
            if (activeEditor !== "title") {
              saveSelection();
            }
            e.preventDefault();
          }}
        >
          <Italic
            className={cn(
              "size-5",
              activeEditor === "title"
                ? "text-gray-300"
                : activeFormats.italic
                  ? "text-black"
                  : "text-gray-400"
            )}
          />
        </ToolbarButton>

        {/* Color picker */}
        <div className="relative flex items-center justify-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-[14px] rounded-[2px]"
            style={{ backgroundColor: selectedColor }}
            onMouseDown={(e) => {
              if (activeEditor !== "title") {
                saveSelection();
              }
              e.preventDefault();
            }}
            onClick={handleColorPickerToggle}
            aria-label="글자 색상"
            tabIndex={-1}
            disabled={activeEditor === "title"}
          />

          {/* Color palette modal */}
          {showColorPicker &&
            createPortal(
              <div
                ref={colorPickerRef}
                className="fixed z-[9999] flex items-center gap-2 rounded border border-gray-300 bg-white p-2 shadow-sm"
                style={{
                  top: `${colorPickerPosition.top}px`,
                  left: `${colorPickerPosition.left}px`,
                }}
              >
                {TEXT_EDITOR.COLOR_PALETTE.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className="size-5 rounded-[2px] transition-transform"
                    style={{ backgroundColor: color.value }}
                    onClick={() => handleColorChange(color.value)}
                    aria-label={color.name}
                    title={color.name}
                  />
                ))}
              </div>,
              document.body
            )}
        </div>

        {/* Alignment button */}
        <ToolbarButton
          onClick={cycleAlign}
          ariaLabel="정렬"
          disabled={activeEditor === "title"}
          onMouseDown={(e) => {
            if (activeEditor !== "title") {
              saveSelection();
            }
            e.preventDefault();
          }}
        >
          <AlignIcon
            className={cn(
              "size-5",
              activeEditor === "title" ? "text-gray-300" : "text-gray-400"
            )}
          />
        </ToolbarButton>

        {/* Link button */}
        <div className="relative flex items-center justify-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "size-8",
              activeEditor === "title" && "cursor-not-allowed"
            )}
            onMouseDown={(e) => {
              if (activeEditor !== "title") saveSelection();
              e.preventDefault();
            }}
            onClick={() => {
              if (activeEditor === "title") return;
              openLinkPopover();
            }}
            aria-label="링크"
            tabIndex={-1}
            disabled={activeEditor === "title"}
          >
            <Link
              className={cn(
                "size-5",
                activeEditor === "title" ? "text-gray-300" : "text-gray-400"
              )}
            />
          </Button>

          {showLinkPopover &&
            createPortal(
              <div
                ref={linkPopoverRef}
                className="fixed z-[9999] w-[280px] max-w-[90vw] rounded border border-gray-300 bg-white p-3 shadow-sm"
                style={{
                  top: `${linkPopoverPosition.top}px`,
                  left: `${linkPopoverPosition.left}px`,
                }}
              >
                <div className="mb-2">
                  <input
                    type="url"
                    inputMode="url"
                    placeholder="https://example.com"
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none"
                    value={linkUrlInput}
                    onChange={(e) => {
                      setLinkUrlInput(e.target.value);
                      if (linkError) setLinkError("");
                    }}
                    aria-label="링크 URL"
                    autoFocus
                  />
                </div>
                <div className="mb-2">
                  <input
                    type="text"
                    placeholder="표시할 텍스트 (선택)"
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none"
                    value={linkTextInput}
                    onChange={(e) => setLinkTextInput(e.target.value)}
                    aria-label="링크 텍스트"
                  />
                </div>
                {linkError && (
                  <div className="mb-2 text-xs text-red-500">{linkError}</div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="bg-main-600 min-w-[84px] rounded px-3 py-2.5 text-sm text-white active:opacity-90"
                    onClick={() => {
                      if (
                        window.confirm("선택한 텍스트의 링크를 제거할까요?")
                      ) {
                        removeLinkAtSelection();
                      }
                    }}
                    aria-label="링크 제거"
                  >
                    링크 제거
                  </button>
                  <button
                    type="button"
                    className="min-w-[72px] rounded border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 active:bg-gray-100"
                    onClick={() => setShowLinkPopover(false)}
                    aria-label="취소"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="min-w-[72px] rounded bg-black px-3 py-2.5 text-sm text-white"
                    onClick={applyLinkAtSelection}
                    aria-label="적용"
                  >
                    적용
                  </button>
                </div>
              </div>,
              document.body
            )}
        </div>

        {/* Image upload button */}
        <ToolbarButton
          onClick={handleImageClick}
          ariaLabel="이미지"
          disabled={activeEditor === "title"}
          onMouseDown={(e) => {
            if (activeEditor !== "title") {
              saveSelection();
            }
            e.preventDefault();
          }}
        >
          <ImageIcon
            className={cn(
              "size-5",
              activeEditor === "title" ? "text-gray-300" : "text-gray-400"
            )}
          />
        </ToolbarButton>

        {/* File upload button */}
        <ToolbarButton
          onClick={handleFileClick}
          ariaLabel="첨부파일"
          disabled={activeEditor === "title"}
          onMouseDown={(e) => {
            if (activeEditor !== "title") {
              saveSelection();
            }
            e.preventDefault();
          }}
        >
          <Paperclip
            className={cn(
              "size-5",
              activeEditor === "title" ? "text-gray-300" : "text-gray-400"
            )}
          />
        </ToolbarButton>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageChange}
        aria-label="이미지 업로드"
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        aria-label="파일 업로드"
      />

      {/* Editor Content Container */}
      <div className="relative flex-1 overflow-hidden">
        {/* Title area */}
        <div className="relative flex items-start p-4 pb-0">
          {/* 날짜 프리픽스 (시각적으로만 표시) */}
          {showDatePrefix && (
            <Typography
              variant="title4"
              className="pointer-events-none mr-1 flex-shrink-0"
            >
              {getTodayPrefix()}
            </Typography>
          )}

          {/* 제목 입력 필드 */}
          <div
            ref={titleRef}
            contentEditable
            suppressContentEditableWarning
            className={cn(
              "word-break-break-word overflow-wrap-break-word flex-1 text-[22px] font-bold break-words outline-none",
              "[&:empty]:before:text-base [&:empty]:before:leading-[150%] [&:empty]:before:font-bold [&:empty]:before:text-gray-400 [&:empty]:before:content-[attr(data-placeholder)]",
              "touch-manipulation",
              "[&_a]:cursor-pointer [&_a]:text-blue-500 [&_a]:underline"
            )}
            onInput={handleTitleInput}
            onFocus={handleTitleFocus}
            onBlur={handleBlur}
            onKeyDown={handleTitleKeyDown}
            onMouseUp={() => {
              saveSelection();
              updateColorFromSelection();
              updateFormatFromSelection();
              updateHeadingFromSelection();
            }}
            onKeyUp={() => {
              saveSelection();
              updateColorFromSelection();
              updateFormatFromSelection();
              updateHeadingFromSelection();
            }}
            onSelect={() => {
              saveSelection();
              updateColorFromSelection();
              updateFormatFromSelection();
              updateHeadingFromSelection();
            }}
            onClick={() => {
              updateColorFromSelection();
              updateFormatFromSelection();
              updateHeadingFromSelection();
            }}
            data-placeholder={TEXT_EDITOR.getTitlePlaceholder()}
            role="textbox"
            aria-label="제목"
            tabIndex={0}
          />
        </div>

        {/* Content area */}
        <div
          ref={contentRef}
          contentEditable
          suppressContentEditableWarning
          className={cn(
            "prose prose-sm prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-img:max-w-full prose-img:h-auto prose-img:rounded-lg prose-img:block prose-img:mx-auto prose-a:text-blue-500 prose-a:underline prose-a:cursor-pointer prose-a:break-all prose-a:overflow-wrap-break-word w-full max-w-none overflow-x-hidden overflow-y-auto p-4 outline-none",
            "[&:empty]:before:text-sm [&:empty]:before:leading-[150%] [&:empty]:before:font-normal [&:empty]:before:text-gray-400 [&:empty]:before:content-[attr(data-placeholder)]",
            "word-break-break-word overflow-wrap-break-word break-words whitespace-pre-wrap",
            "touch-manipulation",
            "overscroll-contain",
            "[&_*]:max-w-full [&_*]:overflow-hidden [&_*]:break-words",
            "[&_a]:cursor-pointer [&_a]:text-blue-500 [&_a]:underline"
          )}
          style={{
            minHeight: `${minHeight}px`,
            maxHeight: `${minHeight}px`,
          }}
          onInput={handleContentInput}
          onFocus={handleContentFocus}
          onBlur={handleBlur}
          onKeyDown={handleContentKeyDown}
          onMouseUp={() => {
            saveSelection();
            updateColorFromSelection();
            updateFormatFromSelection();
            updateHeadingFromSelection();
          }}
          onKeyUp={() => {
            saveSelection();
            updateColorFromSelection();
            updateFormatFromSelection();
            updateHeadingFromSelection();
          }}
          onSelect={() => {
            saveSelection();
            updateColorFromSelection();
            updateFormatFromSelection();
            updateHeadingFromSelection();
          }}
          onClick={() => {
            updateColorFromSelection();
            updateFormatFromSelection();
            updateHeadingFromSelection();
          }}
          data-placeholder={TEXT_EDITOR.PLACEHOLDER.CONTENT}
          role="textbox"
          aria-label="내용"
          aria-multiline="true"
          tabIndex={0}
        />
      </div>
    </div>
  );
};

export default TextEditor;
