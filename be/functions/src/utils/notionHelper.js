const getNotionToken = () => process.env.NOTION_API_KEY;
const getNotionVersion = () => process.env.NOTION_VERSION;

const buildNotionHeaders = (token) => ({
  "Authorization": `Bearer ${token}`,
  "Notion-Version": getNotionVersion(),
  "Content-Type": "application/json",
});

const buildNotionHeadersFromEnv = () => buildNotionHeaders(getNotionToken());

const toKstIso = (iso) => {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().replace("Z", "+09:00");
};

const nowKstIso = () => {
  const now = new Date();
  return toKstIso(now.toISOString());
};

// Notion 속성 값 추출 유틸 함수들
const getTextContent = (property) => {
  if (!property || !property.rich_text) return '';
  return property.rich_text.map(text => text.plain_text).join('');
};

const getRichTextValue = (property) => {
  if (!property || !property.rich_text) return [];
  return property.rich_text;
};

const getTitleValue = (property) => {
  if (!property || !property.title) return '';
  return property.title.map(text => text.plain_text).join('');
};

const getSelectValue = (property, includeDetails = false) => {
  if (!property || !property.select) return null;
  if (includeDetails) {
    return {
      id: property.select.id,
      name: property.select.name,
      color: property.select.color
    };
  }
  return property.select.name;
};

const getMultiSelectNames = (property) => {
  if (!property || !property.multi_select) return [];
  return property.multi_select.map(option => option.name);
};

const getMultiSelectOptions = (property) => {
  if (!property || property.type !== 'multi_select' || !property.multi_select) {
    return [];
  }
  
  return property.multi_select.map(option => ({
    id: option.id,
    name: option.name,
    color: option.color
  }));
};

const getNumberValue = (property) => {
  if (!property || property.number === null || property.number === undefined) return null;
  return property.number;
};

const getDateValue = (property, includeEnd = false) => {
  if (!property || !property.date) return null;
  if (includeEnd && (property.date.end || property.date.time_zone)) {
    return {
      start: property.date.start,
      end: property.date.end || null,
      time_zone: property.date.time_zone || null
    };
  }
  return property.date.start;
};

const getCheckboxValue = (property) => {
  if (!property) return false;
  return property.checkbox;
};

const getUrlValue = (property) => {
  if (!property || !property.url) return null;
  return property.url;
};

const getStatusValue = (property, includeDetails = false) => {
  if (!property || !property.status) return null;
  if (includeDetails) {
    return {
      id: property.status.id,
      name: property.status.name,
      color: property.status.color
    };
  }
  return property.status.name;
};

const getPeopleValue = (property) => {
  if (!property || !property.people) return [];
  return property.people.map(person => ({
    object: person.object,
    id: person.id,
    name: person.name,
    avatar_url: person.avatar_url,
    type: person.type,
    // person 타입의 경우 추가 정보
    ...(person.person && { person: person.person }),
    // bot 타입의 경우 추가 정보
    ...(person.bot && { bot: person.bot })
  }));
};

// Email 속성 처리
const getEmailValue = (property) => {
  if (!property || !property.email) return null;
  return property.email;
};

// Phone number 속성 처리
const getPhoneNumberValue = (property) => {
  if (!property || !property.phone_number) return null;
  return property.phone_number;
};

// Created by 속성 처리
const getCreatedByValue = (property) => {
  if (!property || !property.created_by) return null;
  return {
    object: property.created_by.object,
    id: property.created_by.id,
    name: property.created_by.name,
    avatar_url: property.created_by.avatar_url,
    type: property.created_by.type,
    // person 타입의 경우
    ...(property.created_by.person && { person: property.created_by.person }),
    // bot 타입의 경우
    ...(property.created_by.bot && { bot: property.created_by.bot })
  };
};

// Last edited by 속성 처리
const getLastEditedByValue = (property) => {
  if (!property || !property.last_edited_by) return null;
  return {
    object: property.last_edited_by.object,
    id: property.last_edited_by.id,
    name: property.last_edited_by.name,
    avatar_url: property.last_edited_by.avatar_url,
    type: property.last_edited_by.type,
    // person 타입의 경우
    ...(property.last_edited_by.person && { person: property.last_edited_by.person }),
    // bot 타입의 경우
    ...(property.last_edited_by.bot && { bot: property.last_edited_by.bot })
  };
};

// Created time 속성 처리
const getCreatedTimeValue = (property) => {
  if (!property || !property.created_time) return null;
  return property.created_time;
};

// Last edited time 속성 처리
const getLastEditedTimeValue = (property) => {
  if (!property || !property.last_edited_time) return null;
  return property.last_edited_time;
};

// Formula 속성 처리
const getFormulaValue = (property) => {
  if (!property || !property.formula) return null;
  return {
    type: property.formula.type,
    value: property.formula[property.formula.type] || null
  };
};

// Unique ID 속성 처리
const getUniqueIdValue = (property) => {
  if (!property || !property.unique_id) return null;
  return {
    number: property.unique_id.number,
    prefix: property.unique_id.prefix
  };
};

// Verification 속성 처리
const getVerificationValue = (property) => {
  if (!property || !property.verification) return null;
  return {
    state: property.verification.state,
    verified_by: property.verification.verified_by,
    date: property.verification.date
  };
};

const getFileUrls = (property) => {
  if (!property || !property.files) return [];
  return property.files.map(file => ({
    name: file.name,
    url: file.type === 'external' ? file.external.url : file.file.url,
    type: file.type,
    // external 파일의 경우
    ...(file.type === 'external' && {
      external: file.external
    }),
    // file_upload의 경우
    ...(file.type === 'file' && {
      file: file.file
    })
  }));
};

const getRelationValues = (property) => {
  if (!property || property.type !== 'relation' || !property.relation) {
    return [];
  }
  
  return {
    relations: property.relation.map(relation => ({
      id: relation.id
    })),
    has_more: property.has_more || false
  };
};

// Rollup 값 추출 함수 (우선순위 기반)
const getRollupValues = (property) => {
  if (!property || property.type !== 'rollup' || !property.rollup) {
    return {
      type: null,
      function: null,
      value: []
    };
  }
  
  const result = {
    type: property.rollup.type,
    function: property.rollup.function,
    value: null
  };
  
  // rollup이 array인 경우 (show_original, unique 등)
  if (property.rollup.type === 'array') {
    result.value = property.rollup.array.map(item => {
      // 1. rich_text 타입 (가장 일반적) - 우선 처리
      if (item.type === 'rich_text' && item.rich_text) {
        return {
          id: null,
          name: item.rich_text.map(text => text.plain_text).join('')
        };
      }
      // 2. number 타입 - rollup된 숫자값
      else if (item.type === 'number' && item.number !== null && item.number !== undefined) {
        return {
          id: null,
          name: String(item.number)
        };
      }
      // 3. relation 타입 - ID만 있는 경우
      else if (item.type === 'relation' && item.relation) {
        return {
          id: item.relation[0]?.id || null,
          name: null
        };
      }
      // 4. 단순 값 (string, number) - 직접 값
      else if (typeof item === 'string' || typeof item === 'number') {
        return {
          id: null,
          name: String(item)
        };
      }
      // 5. files 타입 - rollup된 파일 (name만 추출)
      else if (item.type === 'files' && item.files && item.files.length > 0) {
        return {
          id: null,
          name: item.files[0].name || ''
        };
      }
      // 7. 기타 객체 - 속성 우선순위 기반 처리
      else if (item && typeof item === 'object') {
        let name = '';
        let id = null;
        
        // name 속성이 있으면 우선 사용
        if (item.name) {
          name = item.name;
          id = item.id || null;
        }
        // title 속성이 있으면 사용
        else if (item.title) {
          name = item.title;
          id = item.id || null;
        }
        // plain_text가 있으면 사용
        else if (item.plain_text) {
          name = item.plain_text;
          id = item.id || null;
        }
        
        return { id, name };
      }
      
      return { name: '', id: null };
    }).filter(item => item.name || item.id); // 빈 값 제거
  }
  
  // rollup이 단일 값인 경우 (count, sum, average 등)
  else {
    result.value = property.rollup.number?.toString() || 
                   property.rollup.string || 
                   property.rollup.boolean?.toString() || 
                   property.rollup.date || 
                   null;
  }
  
  return result;
};

// 빈 블록 필터링 함수
const filterEmptyBlocks = (blocks) => {
  return blocks.filter(block => {
    // unsupported 블록 제거
    if (block.type === 'unsupported') return false;
    
    // 빈 paragraph 블록 제거
    if (block.type === 'paragraph' && (!block.text || !block.text.trim())) return false;
    
    // 빈 callout 블록 제거 (하위 블록이 없는 경우)
    if (block.type === 'callout' && (!block.text || !block.text.trim()) && !block.hasChildren) return false;
    
    return true;
  });
};

// Notion 블록 포맷팅 공통 함수
const formatNotionBlocks = (blocks, options = {}) => {
  const { includeRichText = false, includeMetadata = false } = options;
  
  return blocks.map(block => {
    const formattedBlock = {
      type: block.type,
      id: block.id,
      ...(includeMetadata && { hasChildren: block.has_children })
    };

    // 공통 블록 타입 처리
    const blockTypes = ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item'];
    
    if (blockTypes.includes(block.type)) {
      const blockData = block[block.type];
      formattedBlock.text = extractPlainText(blockData?.rich_text) || '';
      // 텍스트에 포함된 링크 추출
      formattedBlock.links = extractLinksFromRichText(blockData?.rich_text);
      if (includeRichText) {
        formattedBlock.richText = blockData?.rich_text || [];
      }
    }
    
    // 특수 블록 타입 처리
    switch (block.type) {
      case 'to_do':
        formattedBlock.text = extractPlainText(block.to_do?.rich_text) || '';
        formattedBlock.checked = block.to_do?.checked || false;
        formattedBlock.links = extractLinksFromRichText(block.to_do?.rich_text);
        if (includeRichText) {
          formattedBlock.richText = block.to_do?.rich_text || [];
        }
        break;
      case 'toggle':
        formattedBlock.text = extractPlainText(block.toggle?.rich_text) || '';
        formattedBlock.links = extractLinksFromRichText(block.toggle?.rich_text);
        if (includeRichText) {
          formattedBlock.richText = block.toggle?.rich_text || [];
        }
        break;
      case 'quote':
        formattedBlock.text = extractPlainText(block.quote?.rich_text) || '';
        formattedBlock.links = extractLinksFromRichText(block.quote?.rich_text);
        if (includeRichText) {
          formattedBlock.richText = block.quote?.rich_text || [];
        }
        break;
      case 'callout':
        formattedBlock.text = extractPlainText(block.callout?.rich_text) || '';
        formattedBlock.icon = block.callout?.icon;
        formattedBlock.links = extractLinksFromRichText(block.callout?.rich_text);
        if (includeRichText) {
          formattedBlock.richText = block.callout?.rich_text || [];
        }
        break;
      case 'image':
        formattedBlock.caption = extractPlainText(block.image?.caption) || '';
        formattedBlock.url = block.image?.type === 'external' 
          ? block.image.external.url 
          : block.image?.file?.url;
        // caption에 포함된 링크 추출
        formattedBlock.links = extractLinksFromRichText(block.image?.caption);
        if (includeRichText) {
          formattedBlock.captionRichText = block.image?.caption || [];
        }
        break;
      case 'video':
        formattedBlock.caption = extractPlainText(block.video?.caption) || '';
        formattedBlock.url = block.video?.type === 'external' 
          ? block.video.external.url 
          : block.video?.file?.url;
        // caption에 포함된 링크 추출
        formattedBlock.links = extractLinksFromRichText(block.video?.caption);
        if (includeRichText) {
          formattedBlock.captionRichText = block.video?.caption || [];
        }
        break;
      case 'file':
        formattedBlock.caption = extractPlainText(block.file?.caption) || '';
        formattedBlock.url = block.file?.type === 'external' 
          ? block.file.external.url 
          : block.file?.file?.url;
        // caption에 포함된 링크 추출
        formattedBlock.links = extractLinksFromRichText(block.file?.caption);
        if (includeRichText) {
          formattedBlock.captionRichText = block.file?.caption || [];
        }
        break;
      case 'divider':
        // 구분선은 별도 텍스트 없음
        break;
      default:
        formattedBlock.text = '';
        if (includeRichText) {
          formattedBlock.richText = [];
        }
    }
    
    return formattedBlock;
  });
};

// Rich Text에서 plain text 추출 헬퍼 함수
const extractPlainText = (richText) => {
  if (!richText || !Array.isArray(richText)) return '';
  return richText.map(text => text.plain_text).join('');
};

// Rich Text에서 링크 추출 헬퍼 함수
const extractLinksFromRichText = (richText) => {
  if (!richText || !Array.isArray(richText)) return [];
  return richText
    .filter(text => text.href)
    .map(text => ({
      text: text.plain_text,
      url: text.href
    }));
};

/**
 * Notion 페이지의 커버 이미지 URL 추출
 * @param {Object} page - Notion 페이지 객체
 * @returns {string|null} 커버 이미지 URL 또는 null
 */
const getCoverImageUrl = (page) => {
  if (!page?.cover) return null;
  
  // external 타입 (외부 URL)
  if (page.cover.type === 'external' && page.cover.external?.url) {
    return page.cover.external.url;
  }
  
  // file 타입 (Notion 업로드)
  if (page.cover.type === 'file' && page.cover.file?.url) {
    return page.cover.file.url;
  }
  
  return null;
};

module.exports = {
  buildNotionHeaders,
  buildNotionHeadersFromEnv,
  getNotionToken,
  getNotionVersion,
  toKstIso,
  nowKstIso,
  // Notion 속성 값 추출 함수들
  getTextContent,
  getRichTextValue,
  getTitleValue,
  getSelectValue,
  getMultiSelectNames,
  getMultiSelectOptions,
  getNumberValue,
  getDateValue,
  getCheckboxValue,
  getUrlValue,
  getStatusValue,
  getPeopleValue,
  getFileUrls,
  getRelationValues,
  getRollupValues,
  // 추가된 속성 타입들
  getEmailValue,
  getPhoneNumberValue,
  getCreatedByValue,
  getLastEditedByValue,
  getCreatedTimeValue,
  getLastEditedTimeValue,
  getFormulaValue,
  getUniqueIdValue,
  getVerificationValue,
  filterEmptyBlocks,
  // Notion 블록 포맷팅 함수들
  formatNotionBlocks,
  extractPlainText,
  extractLinksFromRichText,
  // Notion 페이지 메타데이터 추출
  getCoverImageUrl,
};


