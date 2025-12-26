export const rgbToHex = (rgb: string, fallback: string): string => {
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return fallback;

  return (
    "#" +
    match
      .map((x) => {
        const hex = parseInt(x).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
};

export const isElementEmpty = (element: HTMLElement | null): boolean => {
  if (!element) return true;

  // 이미지/비디오/SVG/첨부 블록 등 비-텍스트 콘텐츠가 있으면 비어있지 않음으로 간주
  const atomic = element.querySelector("img,video,svg,[data-attachment]");
  if (atomic) return false;

  // 텍스트 기반 검사: 공백, NBSP, zero-width space 제거 후 체크
  const text = (element.textContent || "")
    .replace(/\u200B/g, "") // zero-width space
    .replace(/\u00A0/g, " ") // NBSP를 일반 공백으로
    .trim();
  return text === "";
};

export const createRangeAtEnd = (element: HTMLElement): Range => {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  return range;
};

export const createRangeAtStart = (element: HTMLElement): Range => {
  const range = document.createRange();
  range.setStart(element, 0);
  range.collapse(true);
  return range;
};

export const setCursorPosition = (
  element: HTMLElement,
  atEnd = false
): void => {
  const selection = window.getSelection();
  if (!selection) return;

  const range = atEnd ? createRangeAtEnd(element) : createRangeAtStart(element);
  selection.removeAllRanges();
  selection.addRange(range);
};

/**
 * URL 정규화: 프로토콜이 없으면 https://를 붙임
 * @param raw - 정규화할 URL 문자열
 * @returns 정규화된 URL 문자열 (유효하지 않으면 빈 문자열)
 */
export const normalizeUrl = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    // 이미 유효한 절대 URL이면 그대로
    // new URL은 절대 URL만 허용
    // http/https 외는 차단
    const u = new URL(trimmed);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    return "";
  } catch {
    // 프로토콜이 없으면 https 붙여 재시도
    try {
      const u2 = new URL(`https://${trimmed}`);
      if (u2.protocol === "http:" || u2.protocol === "https:")
        return u2.toString();
      return "";
    } catch {
      return "";
    }
  }
};

/**
 * HTML 문자열에서 텍스트만 추출
 * @param html - HTML 문자열
 * @returns 태그와 HTML 엔티티가 제거된 순수 텍스트
 */
export const extractTextFromHtml = (html: string): string => {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "") // 태그 제거
    .replace(/&nbsp;/g, " ") // nbsp 치환
    .trim();
};

/**
 * 게시글 텍스트 길이가 최소 길이 이상인지 확인
 * @param content - HTML 콘텐츠
 * @param minLength - 최소 텍스트 길이
 * @returns 최소 길이 이상 여부
 */
export const checkPostTextLength = (
  content: string,
  minLength: number
): boolean => {
  const contentText = extractTextFromHtml(content);
  return contentText.length >= minLength;
};

/**
 * HTML 콘텐츠에 이미지가 포함되어 있는지 확인
 * @param content - HTML 콘텐츠
 * @returns 이미지 포함 여부
 */
export const hasImageInContent = (content: string): boolean => {
  if (!content) return false;
  const tempContainer = document.createElement("div");
  tempContainer.innerHTML = content;
  const images = tempContainer.querySelectorAll("img");
  return images.length > 0;
};

/**
 * 텍스트를 HTML 엔티티로 이스케이프하여 XSS 공격 방지
 * @param text - 이스케이프할 텍스트
 * @returns HTML 엔티티로 변환된 안전한 텍스트
 */
export const escapeHtml = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;") // &를 먼저 처리해야 다른 엔티티가 깨지지 않음
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

/**
 * 블록 요소 태그 목록
 */
const BLOCK_ELEMENTS = [
  "div",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
] as const;

/**
 * 요소가 블록 요소인지 확인
 * @param element - 확인할 요소
 * @returns 블록 요소 여부
 */
const isBlockElement = (element: HTMLElement): boolean => {
  const tagName = element.tagName.toLowerCase();
  return (
    BLOCK_ELEMENTS.includes(tagName as (typeof BLOCK_ELEMENTS)[number]) ||
    tagName === "img" ||
    element.querySelector("img") !== null
  );
};

/**
 * 요소가 빈 블록 요소인지 확인
 * @param element - 확인할 요소
 * @param blockElements - 블록 요소 태그 목록
 * @returns 빈 블록 요소 여부
 */
const isEmptyBlockElement = (
  element: HTMLElement,
  blockElements: readonly string[]
): boolean => {
  const hasText = (element.textContent || "").trim().length > 0;
  const hasImages = element.querySelector("img") !== null;
  const hasAttachments = element.querySelector("[data-attachment]") !== null;
  const hasBlockChildren = Array.from(element.children).some((child) =>
    blockElements.includes(child.tagName.toLowerCase())
  );
  const hasOnlyBr = Array.from(element.childNodes).every(
    (node) =>
      (node.nodeType === Node.TEXT_NODE &&
        (node.textContent || "").trim() === "") ||
      (node.nodeType === Node.ELEMENT_NODE &&
        (node as HTMLElement).tagName.toLowerCase() === "br")
  );

  return (
    !hasText &&
    !hasImages &&
    !hasAttachments &&
    !hasBlockChildren &&
    (hasOnlyBr || element.children.length === 0)
  );
};

/**
 * 빈 블록 요소 제거
 * @param container - HTML 컨테이너 요소
 */
const removeEmptyBlockElements = (container: HTMLElement): void => {
  const blockElements = Array.from(BLOCK_ELEMENTS);
  let hasChanges = true;

  // 빈 블록 요소가 없을 때까지 반복 제거
  while (hasChanges) {
    hasChanges = false;
    blockElements.forEach((tagName) => {
      const elements = Array.from(
        container.querySelectorAll(tagName)
      ) as HTMLElement[];
      elements.reverse().forEach((el) => {
        if (isEmptyBlockElement(el, blockElements)) {
          const parent = el.parentElement;

          // 최상위 레벨의 빈 블록 요소는 그냥 제거
          if (parent === container) {
            el.remove();
            hasChanges = true;
          } else if (parent) {
            // 중첩된 빈 블록 요소는 자식 요소들을 부모로 이동 (unwrap)
            while (el.firstChild) {
              parent.insertBefore(el.firstChild, el);
            }
            el.remove();
            hasChanges = true;
          }
        }
      });
    });
  }
};

/**
 * 불필요한 <br> 태그인지 확인
 * @param br - 확인할 <br> 요소
 * @returns 불필요한 <br> 태그 여부
 */
const isUnnecessaryBr = (br: HTMLBRElement): boolean => {
  const parent = br.parentElement;
  if (!parent) return false;

  const prevSibling = br.previousSibling;
  const nextSibling = br.nextSibling;

  // 이전 형제가 <br>이면 제거 (연속된 <br> 통합)
  if (prevSibling && prevSibling.nodeType === Node.ELEMENT_NODE) {
    const prevEl = prevSibling as HTMLElement;
    if (prevEl.tagName.toLowerCase() === "br") {
      return true;
    }
  }

  // 다음 형제가 <br>이면 제거 (연속된 <br> 통합)
  if (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE) {
    const nextEl = nextSibling as HTMLElement;
    if (nextEl.tagName.toLowerCase() === "br") {
      return true;
    }
  }

  // 블록 요소 앞의 <br> 제거
  if (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE) {
    const nextEl = nextSibling as HTMLElement;
    if (isBlockElement(nextEl)) {
      return true;
    }
  }

  // 블록 요소 뒤의 <br> 제거
  if (prevSibling && prevSibling.nodeType === Node.ELEMENT_NODE) {
    const prevEl = prevSibling as HTMLElement;
    if (isBlockElement(prevEl)) {
      return true;
    }
  }

  // 부모가 블록 요소이고 <br>이 유일한 자식이거나 텍스트 노드만 있는 경우 제거
  const parentTagName = parent.tagName.toLowerCase();
  const isParentBlock = BLOCK_ELEMENTS.includes(
    parentTagName as (typeof BLOCK_ELEMENTS)[number]
  );
  if (isParentBlock) {
    const hasOnlyBrAndText = Array.from(parent.childNodes).every(
      (node) =>
        (node.nodeType === Node.TEXT_NODE &&
          (node.textContent || "").trim() === "") ||
        (node.nodeType === Node.ELEMENT_NODE &&
          (node as HTMLElement).tagName.toLowerCase() === "br")
    );
    if (hasOnlyBrAndText) {
      return true;
    }
  }

  return false;
};

/**
 * 불필요한 <br> 태그 제거
 * @param container - HTML 컨테이너 요소
 */
const removeUnnecessaryBrTags = (container: HTMLElement): void => {
  const brElements = Array.from(container.querySelectorAll("br"));

  // 불필요한 <br> 태그 제거 (역순으로 제거하여 DOM 변경 시 인덱스 문제 방지)
  brElements.reverse().forEach((br) => {
    if (isUnnecessaryBr(br)) {
      br.remove();
    }
  });
};

/**
 * HTML에서 불필요한 <br> 태그 및 빈 블록 요소 제거
 * - contentEditable에서 브라우저가 자동으로 추가한 <br> 태그 제거
 * - 연속된 <br> 태그를 하나로 통합
 * - 블록 요소 앞뒤의 불필요한 <br> 제거
 * - 빈 블록 요소 (<div></div>, <p></p> 등) 제거
 * @param html - 정규화할 HTML 문자열
 * @returns 정규화된 HTML 문자열
 */
export const normalizeBrTags = (html: string): string => {
  if (!html) return html;

  // 임시 컨테이너에 HTML 파싱
  const container = document.createElement("div");
  container.innerHTML = html;

  // 1. 빈 블록 요소 제거 (먼저 처리)
  removeEmptyBlockElements(container);

  // 2. 불필요한 <br> 태그 제거
  removeUnnecessaryBrTags(container);

  // 정규화된 HTML 반환
  let resultHtml = "";
  container.childNodes.forEach((child) => {
    resultHtml += elementToHtml(child);
  });
  return resultHtml;
};

/**
 * DOM 요소를 HTML 문자열로 변환 (속성 보존)
 * container.innerHTML로 파싱한 후에도 속성을 보존하기 위해
 * outerHTML을 사용하여 브라우저가 파싱한 HTML을 그대로 가져옴
 * @param element - 변환할 DOM 요소
 * @param depth - 재귀 깊이 (내부 사용, 최대 50단계 제한)
 * @returns HTML 문자열
 */
export const elementToHtml = (element: Node, depth = 0): string => {
  // 재귀 깊이 제한 (무한 루프 방지)
  const MAX_DEPTH = 50;
  if (depth > MAX_DEPTH) {
    console.warn("elementToHtml: Maximum recursion depth exceeded");
    return "";
  }

  try {
    if (element.nodeType === Node.TEXT_NODE) {
      // 텍스트 노드는 HTML 이스케이프 필수 (XSS 방지)
      return escapeHtml(element.textContent || "");
    }

    if (element.nodeType === Node.ELEMENT_NODE) {
      const el = element as HTMLElement;
      const tagName = el.tagName.toLowerCase();

      // outerHTML을 사용하면 브라우저가 파싱한 속성을 그대로 가져올 수 있음
      // container.innerHTML로 파싱한 후에도 outerHTML은 속성을 포함함
      const outerHtml = el.outerHTML;

      // outerHTML이 있으면 사용 (속성이 포함되어 있음)
      if (outerHtml) {
        // 자식 노드들을 재귀적으로 처리하기 위해
        // 시작 태그와 끝 태그를 분리하고 자식만 재귀 처리
        // ReDoS 방지를 위해 indexOf 사용 (정규표현식 대신)
        const tagStart = outerHtml.indexOf(`<${tagName}`);
        const endTag = `</${tagName}>`;

        if (tagStart !== -1) {
          // 시작 태그의 끝 위치 찾기 (> 문자)
          const tagEnd = outerHtml.indexOf(">", tagStart);
          if (tagEnd !== -1) {
            const startTag = outerHtml.substring(tagStart, tagEnd + 1);

            // 자식 노드들을 재귀적으로 처리
            let childrenHtml = "";
            try {
              el.childNodes.forEach((child) => {
                childrenHtml += elementToHtml(child, depth + 1);
              });
            } catch (error) {
              console.warn(
                "elementToHtml: Error processing child nodes:",
                error
              );
              // 에러 발생 시 outerHTML 사용 (폴백)
              return outerHtml;
            }

            return `${startTag}${childrenHtml}${endTag}`;
          }
        }
      }

      // outerHTML이 없는 경우 (드물지만) 명시적으로 속성 추가
      let html = `<${tagName}`;

      // 모든 속성을 추가
      if (el.attributes && el.attributes.length > 0) {
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          html += ` ${attr.name}="${attr.value.replace(/"/g, "&quot;")}"`;
        }
      }

      // className 확인 및 추가
      const className = el.className;
      if (className && typeof className === "string" && className.trim()) {
        const hasClassAttr = el.hasAttribute("class");
        if (!hasClassAttr) {
          html += ` class="${String(className).replace(/"/g, "&quot;")}"`;
        }
      }

      // dataset 속성 확인 및 추가
      if (el.dataset) {
        Object.keys(el.dataset).forEach((key) => {
          const dataAttr = `data-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
          const hasDataAttr = el.hasAttribute(dataAttr);
          if (!hasDataAttr && el.dataset[key]) {
            html += ` ${dataAttr}="${String(el.dataset[key]).replace(/"/g, "&quot;")}"`;
          }
        });
      }

      html += ">";

      // 자식 노드들을 재귀적으로 처리
      if (el.childNodes.length > 0) {
        try {
          el.childNodes.forEach((child) => {
            html += elementToHtml(child, depth + 1);
          });
        } catch (error) {
          console.warn("elementToHtml: Error processing child nodes:", error);
          // 에러 발생 시 outerHTML 사용 (폴백)
          if (outerHtml) {
            return outerHtml;
          }
        }
      }

      html += `</${tagName}>`;
      return html;
    }

    return "";
  } catch (error) {
    // 전체 처리 실패 시 에러 로깅 및 폴백
    console.error("elementToHtml: Unexpected error:", error);
    // 텍스트 노드인 경우 텍스트만 반환
    if (element.nodeType === Node.TEXT_NODE) {
      return escapeHtml(element.textContent || "");
    }
    // 요소 노드인 경우 outerHTML 사용 (폴백)
    if (element.nodeType === Node.ELEMENT_NODE) {
      const el = element as HTMLElement;
      return el.outerHTML || "";
    }
    return "";
  }
};

/**
 * @description 노드가 이미지 요소인지 확인
 */
const isImageNode = (node: Node | null): node is HTMLImageElement => {
  return (
    node !== null &&
    node.nodeType === Node.ELEMENT_NODE &&
    (node as Element).tagName === "IMG"
  );
};

/**
 * @description 텍스트 노드에서 커서 위치 근처의 이미지 찾기
 */
const findImageNearTextNode = (
  textNode: Text,
  cursorOffset: number,
  key: string
): HTMLImageElement | null => {
  const isAtStart = cursorOffset === 0;
  const isAtEnd = cursorOffset === textNode.length;
  const isBackspaceAtStart = isAtStart && key === "Backspace";
  const isDeleteAtEnd = isAtEnd && key === "Delete";

  if (!isBackspaceAtStart && !isDeleteAtEnd) {
    return null;
  }

  const parentElement = textNode.parentElement;
  if (!parentElement) return null;

  const childNodes = Array.from(parentElement.childNodes);
  const currentIndex = childNodes.indexOf(textNode);

  if (isBackspaceAtStart && currentIndex > 0) {
    const prevNode = childNodes[currentIndex - 1];
    if (isImageNode(prevNode)) {
      return prevNode;
    }
  } else if (isDeleteAtEnd && currentIndex < childNodes.length - 1) {
    const nextNode = childNodes[currentIndex + 1];
    if (isImageNode(nextNode)) {
      return nextNode;
    }
  }

  return null;
};

/**
 * @description 요소 노드에서 커서 위치 근처의 이미지 찾기
 */
const findImageNearElementNode = (
  elementNode: Element,
  cursorOffset: number,
  key: string
): HTMLImageElement | null => {
  const isBackspace = key === "Backspace" && cursorOffset > 0;
  const isDelete =
    key === "Delete" && cursorOffset < elementNode.childNodes.length;

  if (!isBackspace && !isDelete) {
    return null;
  }

  const childNodes = Array.from(elementNode.childNodes);

  if (isBackspace && cursorOffset <= childNodes.length) {
    const prevNode = childNodes[cursorOffset - 1];
    if (isImageNode(prevNode)) {
      return prevNode;
    }
  } else if (isDelete) {
    const nextNode = childNodes[cursorOffset];
    if (isImageNode(nextNode)) {
      return nextNode;
    }
  }

  return null;
};

/**
 * @description 커서 위치 근처의 이미지 요소 찾기
 * @param range - 현재 선택 영역의 Range
 * @param key - 누른 키 ("Backspace" 또는 "Delete")
 * @returns 찾은 이미지 요소 또는 null
 */
export const findImageNearCursor = (
  range: Range,
  key: string
): HTMLImageElement | null => {
  const cursorNode = range.startContainer;
  const cursorOffset = range.startOffset;

  if (cursorNode.nodeType === Node.TEXT_NODE) {
    return findImageNearTextNode(cursorNode as Text, cursorOffset, key);
  }

  if (cursorNode.nodeType === Node.ELEMENT_NODE) {
    return findImageNearElementNode(cursorNode as Element, cursorOffset, key);
  }

  return null;
};
