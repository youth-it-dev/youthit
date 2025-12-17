/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * @description Swagger JSON을 기반으로 API 코드를 자동 생성하는 스크립트
 * - TypeScript 타입 정의
 * - API 함수들
 * - Query Keys
 * - React Query Hooks
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
// import { debug as debugUtil } from "@/utils/shared/debugger";

// 간단한 로그 함수
const debug = {
  log: (msg: string, ...args: any[]) => console.log(msg, ...args),
  error: (msg: string, ...args: any[]) => console.error(msg, ...args),
};

// 파일 경로 설정
const SWAGGER_FILE = path.join(__dirname, "../swagger.json");
const OUTPUT_DIR = path.join(__dirname, "../src");
const TYPES_DIR = path.join(OUTPUT_DIR, "types/generated");
const API_DIR = path.join(OUTPUT_DIR, "api/generated");
const HOOKS_DIR = path.join(OUTPUT_DIR, "hooks/generated");
const CONSTANTS_DIR = path.join(OUTPUT_DIR, "constants/generated");

// 디렉토리 생성
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 생성된 파일을 Prettier로 포맷팅하여 일관된 코드 스타일 유지
function formatGeneratedFile(filePath: string) {
  try {
    execSync(`pnpm prettier --write "${filePath}"`, {
      stdio: "ignore",
      cwd: path.join(__dirname, "../"),
    });
  } catch (error) {
    // Prettier 실패해도 계속 진행 (경고만 표시)
    debug.log(`⚠️  ${path.basename(filePath)} Prettier 포맷팅 실패 (무시)`);
  }
}

// 사용 가능한 스키마 이름 추적 (Swagger components.schemas의 키)
const availableSchemaNames = new Set<string>();

// Swagger 스펙 파싱
interface SwaggerSpec {
  paths: Record<string, Record<string, any>>;
  components: {
    schemas: Record<string, any>;
  };
  tags: Array<{ name: string; description: string }>;
}

// API 엔드포인트 정보
interface ApiEndpoint {
  path: string;
  method: string;
  operationId: string;
  summary: string;
  tags: string[];
  parameters: any[];
  requestBody?: any;
  responses: Record<string, any>;
}

// 타입 생성
function generateTypes(spec: SwaggerSpec): string {
  const schemas = spec.components?.schemas || {};
  let types = `
/* eslint-disable @typescript-eslint/no-explicit-any */
import type * as Schema from "./api-schema";

/**
 * @description Swagger에서 자동 생성된 타입 정의
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */
`;

  // 기본 타입들
  types += `// 기본 응답 타입
export interface ApiResponse<T = any> {
  data: T;
  status: number;
}

// 페이지네이션 타입
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
`;

  // 스키마 타입들 생성
  Object.entries(schemas).forEach(([name, schema]) => {
    // 일반 object 스키마 처리
    if (schema && schema.type === "object" && schema.properties) {
      types += `export interface ${name} {\n`;
      Object.entries(schema.properties).forEach(
        ([propName, propSchema]: [string, any]) => {
          const type = getTypeScriptType(propSchema);
          const optional = schema.required?.includes(propName) ? "" : "?";
          types += `  ${propName}${optional}: ${type};\n`;
        }
      );
      types += `}\n\n`;
    }
    // allOf 스키마 처리 (상속/확장)
    else if (schema && schema.allOf) {
      // extends할 타입들 찾기
      const extendsTypes: string[] = [];
      const additionalProps: Array<[string, any, boolean]> = [];

      schema.allOf.forEach((subSchema: any) => {
        if (subSchema.$ref) {
          // $ref를 통한 상속
          const refName = subSchema.$ref.split("/").pop();
          if (refName && availableSchemaNames.has(refName)) {
            extendsTypes.push(`Schema.${refName}`);
          }
        } else if (subSchema.properties) {
          // 추가 프로퍼티 수집
          Object.entries(subSchema.properties).forEach(
            ([propName, propSchema]: [string, any]) => {
              const type = getTypeScriptType(propSchema);
              const optional = subSchema.required?.includes(propName)
                ? false
                : true;
              additionalProps.push([propName, type, optional]);
            }
          );
        }
      });

      // interface 생성
      if (extendsTypes.length > 0) {
        types += `export interface ${name} extends ${extendsTypes.join(", ")} {\n`;
      } else {
        types += `export interface ${name} {\n`;
      }

      // 추가 프로퍼티 작성
      additionalProps.forEach(([propName, type, optional]) => {
        types += `  ${propName}${optional ? "?" : ""}: ${type};\n`;
      });

      types += `}\n\n`;
    }
    // anyOf, oneOf 스키마 처리 (유니온 타입)
    else if (schema && (schema.anyOf || schema.oneOf)) {
      const unionTypes = schema.anyOf || schema.oneOf;
      const unionTypeStrings = unionTypes.map((subSchema: any) => {
        if (subSchema.$ref) {
          const refName = subSchema.$ref.split("/").pop();
          return refName && availableSchemaNames.has(refName)
            ? `Schema.${refName}`
            : "any";
        }
        return getTypeScriptType(subSchema);
      });
      types += `export type ${name} = ${unionTypeStrings.join(" | ")};\n\n`;
    }
  });

  return types;
}

// TypeScript 타입 변환
function getTypeScriptType(schema: any): string {
  if (!schema) return "any";

  // allOf 처리 (상속/확장)
  if (schema.allOf) {
    const extendsTypes: string[] = [];
    const additionalProps: Array<[string, string, boolean]> = [];

    schema.allOf.forEach((subSchema: any) => {
      if (subSchema.$ref) {
        // $ref를 통한 상속
        const refName = subSchema.$ref.split("/").pop();
        if (refName) {
          // availableSchemaNames 체크를 하지 않고 항상 Schema.${refName}으로 참조
          // (실제 타입이 없으면 TypeScript 컴파일 시 에러가 발생하므로 안전)
          extendsTypes.push(`Schema.${refName}`);
        }
      } else if (subSchema.properties) {
        // 추가 프로퍼티 수집
        Object.entries(subSchema.properties).forEach(
          ([propName, propSchema]: [string, any]) => {
            const type = getTypeScriptType(propSchema);
            const optional = subSchema.required?.includes(propName)
              ? false
              : true;
            additionalProps.push([propName, type, optional]);
          }
        );
      }
    });

    // 타입 생성
    if (extendsTypes.length > 0 && additionalProps.length === 0) {
      // extends만 있는 경우
      return extendsTypes.join(" & ");
    } else if (extendsTypes.length > 0 && additionalProps.length > 0) {
      // extends + 추가 프로퍼티
      let typeStr = `(${extendsTypes.join(" & ")}) & {\n`;
      additionalProps.forEach(([propName, type, optional]) => {
        typeStr += `    ${propName}${optional ? "?" : ""}: ${type};\n`;
      });
      typeStr += "  }";
      return typeStr;
    } else if (additionalProps.length > 0) {
      // 추가 프로퍼티만 있는 경우
      let typeStr = "{\n";
      additionalProps.forEach(([propName, type, optional]) => {
        typeStr += `    ${propName}${optional ? "?" : ""}: ${type};\n`;
      });
      typeStr += "  }";
      return typeStr;
    }
    return "any";
  }

  // oneOf, anyOf 처리
  if (schema.oneOf || schema.anyOf) {
    const unionTypes = schema.oneOf || schema.anyOf;

    // 모든 객체가 공통 필드를 가지고 있는지 확인
    const allAreObjects = unionTypes.every(
      (subSchema: any) =>
        subSchema.type === "object" && subSchema.properties && !subSchema.$ref
    );

    if (allAreObjects && unionTypes.length > 0) {
      // 공통 필드 추출
      const firstSchema = unionTypes[0];
      const allPropertyNames = new Set<string>();

      // 모든 스키마의 프로퍼티 이름 수집
      unionTypes.forEach((subSchema: any) => {
        if (subSchema.properties) {
          Object.keys(subSchema.properties).forEach((key) =>
            allPropertyNames.add(key)
          );
        }
      });

      // 공통 필드와 선택적 필드 구분
      const commonProperties: Record<string, any> = {};
      const optionalProperties: Record<string, any> = {};

      allPropertyNames.forEach((propName) => {
        const allHaveProp = unionTypes.every(
          (subSchema: any) => subSchema.properties?.[propName]
        );
        const allRequired = unionTypes.every((subSchema: any) =>
          subSchema.required?.includes(propName)
        );

        if (allHaveProp) {
          // 모든 스키마에 있는 필드는 공통 필드
          const firstPropSchema = unionTypes.find(
            (s: any) => s.properties?.[propName]
          )?.properties[propName];

          if (allRequired) {
            // 모든 스키마에서 필수인 경우
            commonProperties[propName] = firstPropSchema;
          } else {
            // 일부에서만 필수인 경우 선택적
            optionalProperties[propName] = firstPropSchema;
          }
        } else {
          // 일부 스키마에만 있는 필드는 선택적
          const firstPropSchema = unionTypes.find(
            (s: any) => s.properties?.[propName]
          )?.properties[propName];
          if (firstPropSchema) {
            optionalProperties[propName] = firstPropSchema;
          }
        }
      });

      // enum 필드 병합 (예: targetType: "post" | "comment")
      Object.keys(commonProperties).forEach((propName) => {
        const propSchemas = unionTypes
          .map((s: any) => s.properties?.[propName])
          .filter(Boolean);

        if (propSchemas.length > 0) {
          const allHaveEnum = propSchemas.every((p: any) => p.enum);
          if (allHaveEnum) {
            // 모든 enum 값 병합
            const allEnumValues = new Set<string>();
            propSchemas.forEach((p: any) => {
              if (p.enum) {
                p.enum.forEach((v: string) => allEnumValues.add(v));
              }
            });
            commonProperties[propName] = {
              ...propSchemas[0],
              enum: Array.from(allEnumValues),
            };
          }
        }
      });

      // 단일 객체 타입으로 생성
      let objType = "{\n";

      // 공통 필수 필드
      Object.entries(commonProperties).forEach(([propName, propSchema]) => {
        const type = getTypeScriptType(propSchema);
        objType += `    ${propName}: ${type};\n`;
      });

      // 선택적 필드
      Object.entries(optionalProperties).forEach(([propName, propSchema]) => {
        const type = getTypeScriptType(propSchema);
        objType += `    ${propName}?: ${type};\n`;
      });

      objType += "  }";
      return objType;
    }

    // 객체가 아니거나 $ref가 있는 경우 유니온 타입으로 처리
    const unionTypeStrings = unionTypes.map((subSchema: any) => {
      if (subSchema.$ref) {
        const refName = subSchema.$ref.split("/").pop();
        return refName ? `Schema.${refName}` : "any";
      }
      return getTypeScriptType(subSchema);
    });
    return unionTypeStrings.join(" | ");
  }

  if (schema.type === "string") {
    if (schema.enum) {
      return schema.enum.map((v: string) => `"${v}"`).join(" | ");
    }
    if (schema.format === "date-time") return "string";
    if (schema.format === "email") return "string";
    return "string";
  }
  if (schema.type === "number" || schema.type === "integer") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "array") {
    const itemType = getTypeScriptType(schema.items);
    return `${itemType}[]`;
  }
  if (schema.type === "object") {
    if (schema.properties) {
      let objType = "{\n";
      Object.entries(schema.properties).forEach(
        ([propName, propSchema]: [string, any]) => {
          const type = getTypeScriptType(propSchema);
          const optional = schema.required?.includes(propName) ? "" : "?";
          objType += `    ${propName}${optional}: ${type};\n`;
        }
      );
      objType += "  }";
      return objType;
    }
    return "Record<string, any>";
  }
  if (schema.$ref) {
    const refName = schema.$ref.split("/").pop();
    return refName ? `Schema.${refName}` : "any";
  }
  return "any";
}

// 함수명 생성 (카멜케이스)
function generateFunctionName(method: string, path: string): string {
  const methodPrefix = method.toLowerCase();

  // 경로를 파싱하여 더 구체적인 함수명 생성
  const pathSegments = path
    .split("/")
    .filter((part) => part && !part.startsWith("{"));

  // 각 세그먼트를 적절히 변환
  const convertedSegments = pathSegments.map((part, index) => {
    // 하이픈을 제거하고 카멜케이스로 변환
    const camelCasePart = part.replace(/-([a-z])/g, (_, letter) =>
      letter.toUpperCase()
    );

    // 첫 번째 세그먼트는 소문자로, 나머지는 첫 글자만 대문자로
    if (index === 0) {
      return camelCasePart.toLowerCase();
    }

    // 특별한 경우 처리
    const specialCases: Record<string, string> = {
      posts: "Posts",
      members: "Members",
      comments: "Comments",
      like: "Like",
      sync: "Sync",
      delete: "Delete",
      communities: "Communities",
      users: "Users",
      missions: "Missions",
      routines: "Routines",
      gatherings: "Gatherings",
      announcements: "Announcements",
      faqs: "Faqs",
      fcm: "Fcm",
      images: "Images",
      tmi: "Tmi",
      store: "Store",
      auth: "Auth",
      uploadImage: "UploadImage",
    };

    return (
      specialCases[camelCasePart] ||
      camelCasePart.charAt(0).toUpperCase() + camelCasePart.slice(1)
    );
  });

  // 전체 경로를 조합
  const fullPath = convertedSegments.join("");

  // 경로 파라미터 개수에 따라 추가 식별자
  const paramCount = (path.match(/\{/g) || []).length;
  let suffix = "";
  if (paramCount === 1) suffix = "ById";
  else if (paramCount === 2) suffix = "ByTwoIds";
  else if (paramCount > 2) suffix = "ByMultipleIds";

  return `${methodPrefix}${fullPath.charAt(0).toUpperCase() + fullPath.slice(1)}${suffix}`;
}

// 타입명 생성
function generateTypeName(
  method: string,
  path: string,
  type: "Req" | "Res"
): string {
  const methodPrefix = method.toUpperCase();

  // 경로를 파싱하여 더 구체적인 타입명 생성
  const pathSegments = path
    .split("/")
    .filter((part) => part && !part.startsWith("{"));

  // 각 세그먼트를 적절히 변환
  const convertedSegments = pathSegments.map((part) => {
    // 하이픈을 제거하고 카멜케이스로 변환
    const camelCasePart = part.replace(/-([a-z])/g, (_, letter) =>
      letter.toUpperCase()
    );

    // 특별한 경우 처리
    const specialCases: Record<string, string> = {
      posts: "Posts",
      members: "Members",
      comments: "Comments",
      like: "Like",
      sync: "Sync",
      delete: "Delete",
      communities: "Communities",
      users: "Users",
      missions: "Missions",
      routines: "Routines",
      gatherings: "Gatherings",
      announcements: "Announcements",
      faqs: "Faqs",
      fcm: "Fcm",
      images: "Images",
      tmi: "Tmi",
      store: "Store",
      auth: "Auth",
      uploadImage: "UploadImage",
    };

    return (
      specialCases[camelCasePart] ||
      camelCasePart.charAt(0).toUpperCase() + camelCasePart.slice(1)
    );
  });

  // 전체 경로를 조합
  const fullPath = convertedSegments.join("");

  // 경로 파라미터 개수에 따라 추가 식별자
  const paramCount = (path.match(/\{/g) || []).length;
  let suffix = "";
  if (paramCount === 1) suffix = "ById";
  else if (paramCount === 2) suffix = "ByTwoIds";
  else if (paramCount > 2) suffix = "ByMultipleIds";

  return `T${methodPrefix}${fullPath}${suffix}${type}`;
}

// API 함수 생성
function generateApiFunctions(endpoints: ApiEndpoint[]): string {
  // 태그별로 그룹화
  const groupedEndpoints = endpoints.reduce(
    (acc, endpoint) => {
      const tag = endpoint.tags[0] || "default";
      if (!acc[tag]) acc[tag] = [];
      acc[tag].push(endpoint);
      return acc;
    },
    {} as Record<string, ApiEndpoint[]>
  );

  // 태그를 알파벳 순으로 정렬하여 일관된 순서 보장
  const sortedTags = Object.keys(groupedEndpoints).sort();
  sortedTags.forEach((tag) => {
    const tagEndpoints = groupedEndpoints[tag];

    // 엔드포인트를 path와 method로 정렬하여 일관된 순서 보장
    const sortedEndpoints = [...tagEndpoints].sort((a, b) => {
      const pathCompare = a.path.localeCompare(b.path);
      if (pathCompare !== 0) return pathCompare;
      return a.method.localeCompare(b.method);
    });
    const fileName = `${tag.toLowerCase()}-api.ts`;
    const filePath = path.join(API_DIR, fileName);

    let fileContent = `/**
 * @description ${tag} 관련 API 함수들
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { get, post, put, patch, del } from "@/lib/axios";
import type * as Types from "@/types/generated/${tag.toLowerCase()}-types";

`;

    sortedEndpoints.forEach((endpoint) => {
      const {
        path: endpointPath,
        method,
        operationId,
        parameters = [],
        requestBody,
        responses,
      } = endpoint;

      // 함수명 생성 (카멜케이스)
      const funcName =
        operationId || generateFunctionName(method, endpointPath);

      // 타입명 생성
      const reqTypeName = generateTypeName(method, endpointPath, "Req");
      const resTypeName = generateTypeName(method, endpointPath, "Res");

      // 파라미터 타입 생성
      const pathParams = parameters.filter((p: any) => p.in === "path");
      const queryParams = parameters.filter((p: any) => p.in === "query");
      const isMultipart = !!requestBody?.content?.["multipart/form-data"];
      const hasJsonBody =
        requestBody && requestBody.content?.["application/json"]?.schema;
      const hasRequestBody = isMultipart || hasJsonBody;

      // 응답 스키마 확인
      const successResponse =
        responses["200"] || responses["201"] || responses["204"];
      const hasResponseSchema =
        successResponse?.content?.["application/json"]?.schema;

      // URL 생성
      let url = endpointPath;
      if (pathParams.length > 0) {
        pathParams.forEach((p: any) => {
          url = url.replace(`{${p.name}}`, `\${request.${p.name}}`);
        });
      }

      // HTTP 메서드에 따른 함수 생성
      const httpMethod = method.toLowerCase();
      const axiosMethod = httpMethod === "delete" ? "del" : httpMethod;

      // 함수 생성
      const hasResponseType = hasResponseSchema;

      // 멀티파트: 시그니처와 호출을 별도로 처리
      if (isMultipart) {
        // axios interceptor가 Result<TData>를 TData로 변환하므로 Result 래핑 제거
        const responseType = hasResponseType ? `Types.${resTypeName}` : "any";
        if (pathParams.length === 0 && queryParams.length === 0) {
          fileContent += `export const ${funcName} = (formData: FormData) => {\n`;
          fileContent += `  return ${axiosMethod}<${responseType}>(\`${url}\`, formData, { headers: { \"Content-Type\": \"multipart/form-data\" } });\n`;
          fileContent += `};\n\n`;
          return;
        } else if (pathParams.length > 0 && queryParams.length === 0) {
          const pathParamNames = pathParams.map((p: any) => p.name).join(", ");
          fileContent += `export const ${funcName} = (request: Types.${reqTypeName}, formData: FormData) => {\n`;
          fileContent += `  const { ${pathParamNames} } = request;\n`;
          fileContent += `  return ${axiosMethod}<${responseType}>(\`${url}\`, formData, { headers: { \"Content-Type\": \"multipart/form-data\" } });\n`;
          fileContent += `};\n\n`;
          return;
        }
      }

      // 멀티파트가 아닌 경우: 함수 시그니처 열기
      const hasRequestParams =
        pathParams.length > 0 || queryParams.length > 0 || hasRequestBody;
      if (hasRequestParams) {
        fileContent += `export const ${funcName} = (request: Types.${reqTypeName}) => {\n`;
      } else {
        fileContent += `export const ${funcName} = () => {\n`;
      }

      if (queryParams.length > 0 && !hasRequestBody) {
        // GET 요청의 경우 queryParams를 params로 전달
        // axios interceptor가 Result<TData>를 TData로 변환하므로 Result 래핑 제거
        const responseType = hasResponseType ? `Types.${resTypeName}` : "any";
        fileContent += `  return ${axiosMethod}<${responseType}>(\`${url}\`, { params: request });\n`;
      } else if (hasRequestBody && pathParams.length > 0) {
        // POST/PUT/PATCH/DELETE 요청의 경우 pathParams와 data 분리
        const pathParamNames = pathParams.map((p: any) => p.name).join(", ");
        // axios interceptor가 Result<TData>를 TData로 변환하므로 Result 래핑 제거
        const responseType = hasResponseType ? `Types.${resTypeName}` : "any";
        fileContent += `  const { ${pathParamNames}, ...data } = request;\n`;
        // DELETE 요청은 config.data에 body를 전달해야 함
        if (httpMethod === "delete") {
          fileContent += `  return ${axiosMethod}<${responseType}>(\`${url}\`, { data: data.data ?? data });\n`;
        } else {
          // request body가 data 필드로 감싸져 있는 경우 data.data를 전달
          fileContent += `  return ${axiosMethod}<${responseType}>(\`${url}\`, data.data ?? data);\n`;
        }
      } else if (hasRequestBody) {
        // POST/PUT/PATCH/DELETE 요청 (pathParams 없는 경우)
        // axios interceptor가 Result<TData>를 TData로 변환하므로 Result 래핑 제거
        const responseType = hasResponseType ? `Types.${resTypeName}` : "any";
        // DELETE 요청은 config.data에 body를 전달해야 함
        if (httpMethod === "delete") {
          fileContent += `  return ${axiosMethod}<${responseType}>(\`${url}\`, { data: request.data ?? request });\n`;
        } else {
          // request body가 data 필드로 감싸져 있는 경우 data.data를 전달
          fileContent += `  return ${axiosMethod}<${responseType}>(\`${url}\`, request.data ?? request);\n`;
        }
      } else {
        // GET 요청 (pathParams만 있는 경우 또는 파라미터 없는 경우)
        // axios interceptor가 Result<TData>를 TData로 변환하므로 Result 래핑 제거
        const responseType = hasResponseType ? `Types.${resTypeName}` : "any";
        fileContent += `  return ${axiosMethod}<${responseType}>(\`${url}\`);\n`;
      }

      fileContent += `};\n\n`;
    });

    // any가 실제로 사용되는지 확인하여 eslint-disable 주석 추가/제거
    const hasAnyUsage =
      fileContent.includes(": any") ||
      fileContent.includes(" as any") ||
      fileContent.includes("(any") ||
      fileContent.includes("any[]") ||
      fileContent.includes("any>") ||
      fileContent.includes("= any") ||
      fileContent.includes("<any") ||
      /\bany\b/.test(fileContent);

    const hasEslintDisable = fileContent.includes(
      "/* eslint-disable @typescript-eslint/no-explicit-any */"
    );

    if (hasAnyUsage && !hasEslintDisable) {
      // any 사용 시 주석이 없으면 추가 (JSDoc 주석 밖에)
      fileContent = fileContent.replace(
        /^(\/\*\*[\s\S]*?\*\/\s*)\n(import)/,
        `$1\n\n/* eslint-disable @typescript-eslint/no-explicit-any */\n$2`
      );
    } else if (!hasAnyUsage && hasEslintDisable) {
      // any 사용하지 않을 때 주석이 있으면 제거
      fileContent = fileContent.replace(
        /^\/\* eslint-disable @typescript-eslint\/no-explicit-any \*\/\s*\n/im,
        ""
      );
    }

    fs.writeFileSync(filePath, fileContent);
    formatGeneratedFile(filePath);
    debug.log(`✅ ${fileName} 생성 완료`);
  });

  return "";
}

// 타입 파일 생성
function generateTypeFiles(endpoints: ApiEndpoint[], spec: SwaggerSpec): void {
  // 태그별로 그룹화
  const groupedEndpoints = endpoints.reduce(
    (acc, endpoint) => {
      const tag = endpoint.tags[0] || "default";
      if (!acc[tag]) acc[tag] = [];
      acc[tag].push(endpoint);
      return acc;
    },
    {} as Record<string, ApiEndpoint[]>
  );

  // 태그를 알파벳 순으로 정렬하여 일관된 순서 보장
  const sortedTags = Object.keys(groupedEndpoints).sort();
  sortedTags.forEach((tag) => {
    const tagEndpoints = groupedEndpoints[tag];

    // 엔드포인트를 path와 method로 정렬하여 일관된 순서 보장
    const sortedEndpoints = [...tagEndpoints].sort((a, b) => {
      const pathCompare = a.path.localeCompare(b.path);
      if (pathCompare !== 0) return pathCompare;
      return a.method.localeCompare(b.method);
    });
    const fileName = `${tag.toLowerCase()}-types.ts`;
    const filePath = path.join(TYPES_DIR, fileName);

    let fileContent = `/**
 * @description ${tag} 관련 타입 정의
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import type * as Schema from "./api-schema";

`;

    sortedEndpoints.forEach((endpoint) => {
      const {
        path: endpointPath,
        method,
        parameters = [],
        requestBody,
        responses,
      } = endpoint;

      // 타입명 생성
      const reqTypeName = generateTypeName(method, endpointPath, "Req");
      const resTypeName = generateTypeName(method, endpointPath, "Res");

      // Request 타입 생성 (파라미터가 있는 경우에만)
      const pathParams = parameters.filter((p: any) => p.in === "path");
      const queryParams = parameters.filter((p: any) => p.in === "query");
      const hasRequestBody =
        requestBody && requestBody.content?.["application/json"]?.schema;

      if (pathParams.length > 0 || queryParams.length > 0 || hasRequestBody) {
        fileContent += `export interface ${reqTypeName} {\n`;

        // Path parameters
        pathParams.forEach((p: any) => {
          fileContent += `  ${p.name}: string;\n`;
        });

        // Query parameters
        queryParams.forEach((p: any) => {
          const type = getTypeScriptType(p.schema);
          const optional = p.required ? "" : "?";
          fileContent += `  ${p.name}${optional}: ${type};\n`;
        });

        // Request body
        if (hasRequestBody) {
          const bodySchema = requestBody.content["application/json"].schema;
          if (bodySchema.$ref) {
            const refName = bodySchema.$ref.split("/").pop();
            if (refName && availableSchemaNames.has(refName)) {
              fileContent += `  data: Schema.${refName};\n`;
            } else {
              fileContent += `  data: any;\n`;
            }
          } else {
            // 인라인 스키마인 경우 직접 타입 생성
            const bodyType = getTypeScriptType(bodySchema);
            fileContent += `  data: ${bodyType};\n`;
          }
        }

        fileContent += `}\n\n`;
      }

      // Response 타입 생성 (응답 스키마가 있는 경우에만)
      const successResponse =
        responses["200"] || responses["201"] || responses["204"];
      const hasResponseSchema =
        successResponse?.content?.["application/json"]?.schema;

      if (hasResponseSchema) {
        fileContent += `export type ${resTypeName} = `;
        const responseSchema =
          successResponse.content["application/json"].schema;

        if (responseSchema.$ref) {
          const refName = responseSchema.$ref.split("/").pop();
          if (refName && availableSchemaNames.has(refName)) {
            // $ref로 참조된 스키마를 실제 스키마로 해결
            const resolvedSchema = spec.components?.schemas?.[refName];
            if (resolvedSchema && resolvedSchema.properties?.data) {
              // data 필드가 있으면 Schema.XXX["data"] 형태로 타입 추출 (axios interceptor가 data만 반환)
              fileContent += `Schema.${refName}["data"];\n\n`;
            } else {
              // data 필드가 없으면 전체 스키마 사용
              fileContent += `Schema.${refName};\n\n`;
            }
          } else {
            fileContent += `any;\n\n`;
          }
        } else if (responseSchema.allOf) {
          // allOf를 사용하는 경우 (StandardResponse + data 필드 조합 등)
          // 실제 응답 구조를 반영하여 타입 생성
          // 백엔드: res.success({user}) → { status: 200, data: { user: User } }
          let dataType: string | null = null;

          responseSchema.allOf.forEach((subSchema: any) => {
            // $ref는 StandardResponse 같은 기본 응답 구조
            // properties.data가 있는 경우를 찾음
            if (subSchema.properties?.data) {
              const dataSchema = subSchema.properties.data;
              if (dataSchema.$ref) {
                // data: User 형태인 경우, 실제 응답은 data: { user: User }
                const refName = dataSchema.$ref.split("/").pop();
                if (refName && availableSchemaNames.has(refName)) {
                  // 실제 응답 구조 반영: { user: User }
                  dataType = `{ user?: Schema.${refName} }`;
                }
              } else if (
                dataSchema.type === "object" &&
                dataSchema.properties
              ) {
                // 이미 객체 형태인 경우 그대로 사용
                dataType = getTypeScriptType(dataSchema);
              } else {
                dataType = getTypeScriptType(dataSchema);
              }
            }
          });

          if (dataType) {
            fileContent += `${dataType};\n\n`;
          } else {
            fileContent += `any;\n\n`;
          }
        } else if (responseSchema.properties?.data) {
          // 응답 스키마에 data 필드가 있는 경우, data 필드의 타입만 추출
          const dataType = getTypeScriptType(responseSchema.properties.data);
          fileContent += `${dataType};\n\n`;
        } else {
          // 인라인 스키마인 경우 직접 타입 생성
          const responseType = getTypeScriptType(responseSchema);
          fileContent += `${responseType};\n\n`;
        }
      }
    });

    // any가 실제로 사용되는지 확인하여 eslint-disable 주석 추가/제거
    const hasAnyUsage =
      fileContent.includes(": any") ||
      fileContent.includes(" as any") ||
      fileContent.includes("(any") ||
      fileContent.includes("any[]") ||
      fileContent.includes("any>") ||
      fileContent.includes("= any") ||
      fileContent.includes("<any") ||
      /\bany\b/.test(fileContent);

    const hasEslintDisable = fileContent.includes(
      "/* eslint-disable @typescript-eslint/no-explicit-any */"
    );

    if (hasAnyUsage && !hasEslintDisable) {
      // any 사용 시 주석이 없으면 추가
      fileContent = `/* eslint-disable @typescript-eslint/no-explicit-any */\n${fileContent}`;
    } else if (!hasAnyUsage && hasEslintDisable) {
      // any 사용하지 않을 때 주석이 있으면 제거
      fileContent = fileContent.replace(
        /^\/\* eslint-disable @typescript-eslint\/no-explicit-any \*\/\s*\n/im,
        ""
      );
    }

    // Schema import가 실제로 사용되는지 확인하고, 사용되지 않으면 제거
    const hasSchemaUsage = /Schema\.\w+/.test(fileContent);
    if (!hasSchemaUsage) {
      fileContent = fileContent.replace(
        /^import type \* as Schema from "\.\/api-schema";\s*\n\n?/m,
        ""
      );
    }

    fs.writeFileSync(filePath, fileContent);
    formatGeneratedFile(filePath);
    debug.log(`✅ ${fileName} 생성 완료`);
  });
}

// Query Keys 생성
function generateQueryKeys(endpoints: ApiEndpoint[]): string {
  let queryKeys = `
/**
 * @description Swagger에서 자동 생성된 Query Keys
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

`;

  // 태그별로 그룹화
  const groupedEndpoints = endpoints.reduce(
    (acc, endpoint) => {
      const tag = endpoint.tags[0] || "default";
      if (!acc[tag]) acc[tag] = [];
      acc[tag].push(endpoint);
      return acc;
    },
    {} as Record<string, ApiEndpoint[]>
  );

  // 타입 임포트 추가 (요청 파라미터가 있는 태그에 한해)
  // 알파벳 순으로 정렬하여 일관된 순서 보장
  const tagNames = Object.keys(groupedEndpoints)
    .map((t) => t.toLowerCase())
    .sort();
  const uniqueTagNames = Array.from(new Set(tagNames));
  if (uniqueTagNames.length > 0) {
    uniqueTagNames.forEach((name) => {
      queryKeys += `import type * as ${name}Types from "@/types/generated/${name}-types";\n`;
    });
    queryKeys += `\n`;
  }

  // 공용 헬퍼: 쿼리 정규화 및 키 빌더 (파일당 한 번만 선언)
  queryKeys += `function __normalizeQuery(obj: Record<string, unknown>) {\n`;
  queryKeys += `  const normalized: Record<string, unknown> = {};\n`;
  queryKeys += `  Object.keys(obj).forEach((k) => {\n`;
  queryKeys += `    const val = (obj as any)[k];\n`;
  queryKeys += `    if (val === undefined) return;\n`;
  queryKeys += `    normalized[k] = val instanceof Date ? val.toISOString() : val;\n`;
  queryKeys += `  });\n`;
  queryKeys += `  return normalized;\n`;
  queryKeys += `}\n\n`;

  queryKeys += `function __buildKey(tag: string, name: string, parts?: { path?: Record<string, unknown>; query?: Record<string, unknown> }) {\n`;
  queryKeys += `  if (!parts) return [tag, name] as const;\n`;
  queryKeys += `  const { path, query } = parts;\n`;
  queryKeys += `  return [tag, name, path ?? {}, __normalizeQuery(query ?? {})] as const;\n`;
  queryKeys += `}\n\n`;

  // 태그를 알파벳 순으로 정렬하여 일관된 순서 보장
  const sortedTags = Object.keys(groupedEndpoints).sort();
  sortedTags.forEach((tag) => {
    const tagName = tag.toLowerCase();
    const tagEndpoints = groupedEndpoints[tag];
    queryKeys += `// ${tag} Query Keys\nexport const ${tagName}Keys = {\n`;

    // 엔드포인트를 path와 method로 정렬하여 일관된 순서 보장
    const sortedEndpoints = [...tagEndpoints].sort((a, b) => {
      const pathCompare = a.path.localeCompare(b.path);
      if (pathCompare !== 0) return pathCompare;
      return a.method.localeCompare(b.method);
    });

    sortedEndpoints.forEach((endpoint) => {
      const {
        method,
        operationId,
        path,
        parameters = [],
        requestBody,
      } = endpoint;
      const keyName = operationId || generateFunctionName(method, path);

      // GET만 키 생성 (중복/불필요한 키 생성 방지)
      if (method.toLowerCase() !== "get") {
        return;
      }

      const pathParams = parameters.filter((p: any) => p.in === "path");
      const queryParams = parameters.filter((p: any) => p.in === "query");
      const hasRequestBody =
        requestBody && requestBody.content?.["application/json"]?.schema;
      const hasRequestParams =
        pathParams.length > 0 || queryParams.length > 0 || hasRequestBody;

      if (hasRequestParams) {
        const reqTypeName = generateTypeName(method, path, "Req");
        const pathKeysStr = pathParams
          .map((p: any) => `${p.name}: request.${p.name}`)
          .join(", ");
        const queryKeysStr = queryParams
          .map((p: any) => `${p.name}: request.${p.name}`)
          .join(", ");

        queryKeys += `  ${keyName}: (request: ${tagName}Types.${reqTypeName}) => __buildKey("${tagName}", "${keyName}", { path: { ${pathKeysStr} }, query: { ${queryKeysStr} } }),\n`;
      } else {
        // 요청 파라미터가 없는 경우 상수 키
        queryKeys += `  ${keyName}: __buildKey("${tagName}", "${keyName}"),\n`;
      }
    });

    queryKeys += `} as const;\n\n`;
  });

  // any가 실제로 사용되는지 확인하여 eslint-disable 주석 추가/제거
  const hasAnyUsage =
    queryKeys.includes(": any") ||
    queryKeys.includes(" as any") ||
    queryKeys.includes("(any") ||
    queryKeys.includes("any[]") ||
    queryKeys.includes("any>") ||
    queryKeys.includes("= any") ||
    queryKeys.includes("<any") ||
    /\bany\b/.test(queryKeys);

  const hasEslintDisable = queryKeys.includes(
    "/* eslint-disable @typescript-eslint/no-explicit-any */"
  );

  if (hasAnyUsage && !hasEslintDisable) {
    // any 사용 시 주석이 없으면 추가 (JSDoc 주석 바로 다음에)
    // JSDoc 주석 다음에 빈 줄이 오는 패턴을 찾아서 그 사이에 주석 추가
    queryKeys = queryKeys.replace(
      /(\/\*\*[\s\S]*?\*\/\s*)\n\n/,
      `$1\n\n/* eslint-disable @typescript-eslint/no-explicit-any */\n\n`
    );
    // 위 패턴이 매칭되지 않으면 (빈 줄이 하나만 있는 경우) 다른 패턴 시도
    if (
      !queryKeys.includes(
        "/* eslint-disable @typescript-eslint/no-explicit-any */"
      )
    ) {
      queryKeys = queryKeys.replace(
        /(\/\*\*[\s\S]*?\*\/\s*)\n(import|function)/,
        `$1\n\n/* eslint-disable @typescript-eslint/no-explicit-any */\n$2`
      );
    }
  } else if (!hasAnyUsage && hasEslintDisable) {
    // any 사용하지 않을 때 주석이 있으면 제거
    queryKeys = queryKeys.replace(
      /^\/\* eslint-disable @typescript-eslint\/no-explicit-any \*\/\s*\n/im,
      ""
    );
  }

  return queryKeys;
}

// React Query Hooks 생성
function generateHooks(endpoints: ApiEndpoint[]): string {
  // 태그별로 그룹화
  const groupedEndpoints = endpoints.reduce(
    (acc, endpoint) => {
      const tag = endpoint.tags[0] || "default";
      if (!acc[tag]) acc[tag] = [];
      acc[tag].push(endpoint);
      return acc;
    },
    {} as Record<string, ApiEndpoint[]>
  );

  // 태그를 알파벳 순으로 정렬하여 일관된 순서 보장
  const sortedTags = Object.keys(groupedEndpoints).sort();
  sortedTags.forEach((tag) => {
    const tagEndpoints = groupedEndpoints[tag];

    // 엔드포인트를 path와 method로 정렬하여 일관된 순서 보장
    const sortedEndpoints = [...tagEndpoints].sort((a, b) => {
      const pathCompare = a.path.localeCompare(b.path);
      if (pathCompare !== 0) return pathCompare;
      return a.method.localeCompare(b.method);
    });
    const fileName = `${tag.toLowerCase()}-hooks.ts`;
    const filePath = path.join(HOOKS_DIR, fileName);

    let fileContent = `/**
 * @description ${tag} 관련 React Query Hooks
 * ⚠️ 이 파일은 자동 생성되므로 수정하지 마세요
 */

import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import * as Api from "@/api/generated/${tag.toLowerCase()}-api";
import { ${tag.toLowerCase()}Keys } from "@/constants/generated/query-keys";
import type * as Types from "@/types/generated/${tag.toLowerCase()}-types";

`;

    sortedEndpoints.forEach((endpoint) => {
      const {
        method,
        operationId,
        path,
        parameters = [],
        requestBody,
        responses,
      } = endpoint;
      const funcName = operationId || generateFunctionName(method, path);
      const hookName = `use${funcName.charAt(0).toUpperCase() + funcName.slice(1)}`;

      // 파라미터가 있는지 확인
      const pathParams = parameters.filter((p: any) => p.in === "path");
      const queryParams = parameters.filter((p: any) => p.in === "query");
      const isMultipart = !!requestBody?.content?.["multipart/form-data"];
      const hasRequestBody =
        requestBody && requestBody.content?.["application/json"]?.schema;
      const hasRequestParams =
        pathParams.length > 0 ||
        queryParams.length > 0 ||
        hasRequestBody ||
        isMultipart;

      // 응답 타입이 있는지 확인
      const successResponse =
        responses["200"] || responses["201"] || responses["204"];
      const hasResponseSchema =
        successResponse?.content?.["application/json"]?.schema;
      const reqTypeName = generateTypeName(method, path, "Req");
      const resTypeName = generateTypeName(method, path, "Res");
      // 응답 타입이 없으면 any 사용
      const responseType = hasResponseSchema ? `Types.${resTypeName}` : "any";

      if (method.toLowerCase() === "get") {
        // Query Hook
        if (hasRequestParams) {
          fileContent += `export const ${hookName} = <TData = ${responseType}>(\n`;
          fileContent += `  options: {\n`;
          fileContent += `    request: Types.${reqTypeName};\n`;
          fileContent += `  } & Omit<UseQueryOptions<${responseType}, Error, TData>, "queryKey" | "queryFn">\n`;
          fileContent += `) => {\n`;
          fileContent += `  const { request, ...queryOptions } = options;\n`;
          fileContent += `  return useQuery<${responseType}, Error, TData>({\n`;
          fileContent += `    queryKey: ${tag.toLowerCase()}Keys.${funcName}(request),\n`;
          fileContent += `    queryFn: async () => {\n`;
          fileContent += `      const response = await Api.${funcName}(request);\n`;
          fileContent += `      return response.data;\n`;
          fileContent += `    },\n`;
          fileContent += `    ...queryOptions,\n`;
          fileContent += `  });\n`;
          fileContent += `};\n\n`;
        } else {
          fileContent += `export const ${hookName} = <TData = ${responseType}>(\n`;
          fileContent += `  options?: Omit<UseQueryOptions<${responseType}, Error, TData>, "queryKey" | "queryFn">\n`;
          fileContent += `) => {\n`;
          fileContent += `  return useQuery<${responseType}, Error, TData>({\n`;
          fileContent += `    queryKey: ${tag.toLowerCase()}Keys.${funcName},\n`;
          fileContent += `    queryFn: async () => {\n`;
          fileContent += `      const response = await Api.${funcName}();\n`;
          fileContent += `      return response.data;\n`;
          fileContent += `    },\n`;
          fileContent += `    ...options,\n`;
          fileContent += `  });\n`;
          fileContent += `};\n\n`;
        }
      } else {
        // Mutation Hook
        if (isMultipart) {
          if (pathParams.length === 0 && queryParams.length === 0) {
            fileContent += `export const ${hookName} = <\n`;
            fileContent += `  TContext = unknown,\n`;
            fileContent += `  TVariables = FormData\n`;
            fileContent += `>(\n`;
            fileContent += `  options?: Omit<UseMutationOptions<Awaited<ReturnType<typeof Api.${funcName}>>, Error, TVariables, TContext>, "mutationFn">\n`;
            fileContent += `) => {\n`;
            fileContent += `  return useMutation<Awaited<ReturnType<typeof Api.${funcName}>>, Error, TVariables, TContext>({\n`;
            fileContent += `    mutationFn: (variables: TVariables) => Api.${funcName}(variables as FormData),\n`;
            fileContent += `    ...options,\n`;
            fileContent += `  });\n`;
            fileContent += `};\n\n`;
          } else if (pathParams.length > 0 && queryParams.length === 0) {
            const reqTypeName = generateTypeName(method, path, "Req");
            fileContent += `export const ${hookName} = <\n`;
            fileContent += `  TContext = unknown,\n`;
            fileContent += `  TVariables = { request: Types.${reqTypeName}; formData: FormData }\n`;
            fileContent += `>(\n`;
            fileContent += `  options?: Omit<UseMutationOptions<Awaited<ReturnType<typeof Api.${funcName}>>, Error, TVariables, TContext>, "mutationFn">\n`;
            fileContent += `) => {\n`;
            fileContent += `  return useMutation<Awaited<ReturnType<typeof Api.${funcName}>>, Error, TVariables, TContext>({\n`;
            fileContent += `    mutationFn: (variables: TVariables) => {\n`;
            fileContent += `      const { request, formData } = variables as { request: Types.${reqTypeName}; formData: FormData };\n`;
            fileContent += `      return Api.${funcName}(request, formData);\n`;
            fileContent += `    },\n`;
            fileContent += `    ...options,\n`;
            fileContent += `  });\n`;
            fileContent += `};\n\n`;
          } else {
            const reqTypeName = generateTypeName(method, path, "Req");
            fileContent += `export const ${hookName} = <\n`;
            fileContent += `  TContext = unknown,\n`;
            fileContent += `  TVariables = Types.${reqTypeName}\n`;
            fileContent += `>(\n`;
            fileContent += `  options?: Omit<UseMutationOptions<Awaited<ReturnType<typeof Api.${funcName}>>, Error, TVariables, TContext>, "mutationFn">\n`;
            fileContent += `) => {\n`;
            fileContent += `  return useMutation<Awaited<ReturnType<typeof Api.${funcName}>>, Error, TVariables, TContext>({\n`;
            fileContent += `    mutationFn: (variables: TVariables) => Api.${funcName}(variables as Types.${reqTypeName}),\n`;
            fileContent += `    ...options,\n`;
            fileContent += `  });\n`;
            fileContent += `};\n\n`;
          }
        } else if (hasRequestParams) {
          const reqTypeName = generateTypeName(method, path, "Req");
          fileContent += `export const ${hookName} = <\n`;
          fileContent += `  TContext = unknown,\n`;
          fileContent += `  TVariables = Types.${reqTypeName}\n`;
          fileContent += `>(\n`;
          fileContent += `  options?: Omit<UseMutationOptions<Awaited<ReturnType<typeof Api.${funcName}>>, Error, TVariables, TContext>, "mutationFn">\n`;
          fileContent += `) => {\n`;
          fileContent += `  return useMutation<Awaited<ReturnType<typeof Api.${funcName}>>, Error, TVariables, TContext>({\n`;
          fileContent += `    mutationFn: (variables: TVariables) => Api.${funcName}(variables as Types.${reqTypeName}),\n`;
          fileContent += `    ...options,\n`;
          fileContent += `  });\n`;
          fileContent += `};\n\n`;
        } else {
          fileContent += `export const ${hookName} = <\n`;
          fileContent += `  TContext = unknown,\n`;
          fileContent += `  TVariables = void\n`;
          fileContent += `>(\n`;
          fileContent += `  options?: Omit<UseMutationOptions<Awaited<ReturnType<typeof Api.${funcName}>>, Error, TVariables, TContext>, "mutationFn">\n`;
          fileContent += `) => {\n`;
          fileContent += `  return useMutation<Awaited<ReturnType<typeof Api.${funcName}>>, Error, TVariables, TContext>({\n`;
          fileContent += `    mutationFn: (_variables: TVariables) => Api.${funcName}(),\n`;
          fileContent += `    ...options,\n`;
          fileContent += `  });\n`;
          fileContent += `};\n\n`;
        }
      }
    });

    // any가 실제로 사용되는지 확인하여 eslint-disable 주석 추가/제거
    const hasAnyUsage =
      fileContent.includes(": any") ||
      fileContent.includes(" as any") ||
      fileContent.includes("(any") ||
      fileContent.includes("any[]") ||
      fileContent.includes("any>") ||
      fileContent.includes("= any") ||
      fileContent.includes("<any") ||
      /\bany\b/.test(fileContent);

    const hasEslintDisable = fileContent.includes(
      "/* eslint-disable @typescript-eslint/no-explicit-any */"
    );

    if (hasAnyUsage && !hasEslintDisable) {
      // any 사용 시 주석이 없으면 추가 (JSDoc 주석 밖에)
      fileContent = fileContent.replace(
        /^(\/\*\*[\s\S]*?\*\/\s*)\n(import)/,
        `$1\n\n/* eslint-disable @typescript-eslint/no-explicit-any */\n$2`
      );
    } else if (!hasAnyUsage && hasEslintDisable) {
      // any 사용하지 않을 때 주석이 있으면 제거
      fileContent = fileContent.replace(
        /^\/\* eslint-disable @typescript-eslint\/no-explicit-any \*\/\s*\n/im,
        ""
      );
    }

    fs.writeFileSync(filePath, fileContent);
    formatGeneratedFile(filePath);
    debug.log(`✅ ${fileName} 생성 완료`);
  });

  return "";
}

// Backup 및 Restore 함수
const BACKUP_DIR = path.join(__dirname, "../.generated-backup");

function backupGeneratedFiles() {
  try {
    // 기존 backup 디렉토리가 있으면 삭제
    if (fs.existsSync(BACKUP_DIR)) {
      fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
    }

    // backup 디렉토리 생성
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    // generated 디렉토리들 백업 (상대 경로 구조 유지)
    const dirsToBackup = [
      { dir: TYPES_DIR, relativePath: "types/generated" },
      { dir: API_DIR, relativePath: "api/generated" },
      { dir: HOOKS_DIR, relativePath: "hooks/generated" },
      { dir: CONSTANTS_DIR, relativePath: "constants/generated" },
    ];
    dirsToBackup.forEach(({ dir, relativePath }) => {
      if (fs.existsSync(dir)) {
        const backupPath = path.join(BACKUP_DIR, relativePath);
        const backupParent = path.dirname(backupPath);
        fs.mkdirSync(backupParent, { recursive: true });
        fs.cpSync(dir, backupPath, { recursive: true });
        debug.log(`📦 ${relativePath} 백업 완료`);
      }
    });

    debug.log("✅ Generated 파일 백업 완료");
  } catch (error) {
    debug.error("❌ 백업 실패:", error);
    throw error;
  }
}

function restoreGeneratedFiles() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      debug.log("⚠️  백업 디렉토리가 없어 복원할 수 없습니다");
      return;
    }

    debug.log("🔄 Generated 파일 복원 중...");

    // 백업된 디렉토리들 복원
    const dirsToRestore = [
      { relativePath: "types/generated", targetDir: TYPES_DIR },
      { relativePath: "api/generated", targetDir: API_DIR },
      { relativePath: "hooks/generated", targetDir: HOOKS_DIR },
      { relativePath: "constants/generated", targetDir: CONSTANTS_DIR },
    ];

    dirsToRestore.forEach(({ relativePath, targetDir }) => {
      const backupPath = path.join(BACKUP_DIR, relativePath);
      if (fs.existsSync(backupPath)) {
        // 기존 디렉토리 삭제
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }
        // 백업 복원
        const targetParent = path.dirname(targetDir);
        fs.mkdirSync(targetParent, { recursive: true });
        fs.cpSync(backupPath, targetDir, { recursive: true });
        debug.log(`🔄 ${relativePath} 복원 완료`);
      }
    });

    debug.log("✅ Generated 파일 복원 완료");
  } catch (error) {
    debug.error("❌ 복원 실패:", error);
    throw error;
  }
}

function cleanupBackup() {
  try {
    if (fs.existsSync(BACKUP_DIR)) {
      fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
      debug.log("🗑️  백업 디렉토리 삭제 완료");
    }
  } catch (error) {
    debug.error("⚠️  백업 디렉토리 삭제 실패 (무시):", error);
  }
}

// 메인 실행 함수
function generateApiCode() {
  try {
    debug.log("🔄 API 코드 생성 시작...");

    // 1. 기존 generated 파일들 백업
    debug.log("📦 기존 Generated 파일 백업 중...");
    backupGeneratedFiles();

    // Swagger 파일 읽기
    if (!fs.existsSync(SWAGGER_FILE)) {
      throw new Error(`Swagger 파일을 찾을 수 없습니다: ${SWAGGER_FILE}`);
    }

    const swaggerSpec: SwaggerSpec = JSON.parse(
      fs.readFileSync(SWAGGER_FILE, "utf-8")
    );
    // 사용 가능한 스키마 이름들 기록
    Object.keys(swaggerSpec.components?.schemas || {}).forEach((name) =>
      availableSchemaNames.add(name)
    );
    debug.log(
      `📊 Swagger 스펙 로드 완료: ${Object.keys(swaggerSpec.paths || {}).length}개 엔드포인트`
    );

    // 출력 디렉토리 생성
    ensureDir(TYPES_DIR);
    ensureDir(API_DIR);
    ensureDir(HOOKS_DIR);
    ensureDir(CONSTANTS_DIR);

    // 엔드포인트 추출 (경로와 메서드 순으로 정렬하여 일관된 순서 보장)
    const endpoints: ApiEndpoint[] = [];
    const sortedPaths = Object.keys(swaggerSpec.paths || {}).sort();
    sortedPaths.forEach((path) => {
      const methods = swaggerSpec.paths![path];
      const sortedMethods = Object.keys(methods).sort();
      sortedMethods.forEach((method) => {
        const spec = methods[method];
        endpoints.push({
          path,
          method: method.toUpperCase(),
          operationId: spec.operationId,
          summary: spec.summary || "",
          tags: spec.tags || ["default"],
          parameters: spec.parameters || [],
          requestBody: spec.requestBody,
          responses: spec.responses || {},
        });
      });
    });

    debug.log(`📋 ${endpoints.length}개 엔드포인트 처리 중...`);

    // 1. 타입 정의 생성
    debug.log("📝 타입 정의 생성 중...");
    const typesContent = generateTypes(swaggerSpec);
    const apiSchemaPath = path.join(TYPES_DIR, "api-schema.ts");
    fs.writeFileSync(apiSchemaPath, typesContent);
    formatGeneratedFile(apiSchemaPath);
    debug.log("✅ api-schema.ts 생성 완료");

    // 2. 개별 타입 파일들 생성
    debug.log("📝 개별 타입 파일들 생성 중...");
    generateTypeFiles(endpoints, swaggerSpec);

    // 3. API 함수들 생성
    debug.log("🔧 API 함수들 생성 중...");
    generateApiFunctions(endpoints);

    // 3. Query Keys 생성
    debug.log("🔑 Query Keys 생성 중...");
    const queryKeysContent = generateQueryKeys(endpoints);
    const queryKeysPath = path.join(CONSTANTS_DIR, "query-keys.ts");
    fs.writeFileSync(queryKeysPath, queryKeysContent);
    formatGeneratedFile(queryKeysPath);
    debug.log("✅ query-keys.ts 생성 완료");

    // 4. React Query Hooks 생성
    debug.log("🎣 React Query Hooks 생성 중...");
    generateHooks(endpoints);

    debug.log("🎉 API 코드 생성 완료!");
    debug.log(`📁 생성된 파일들:`);
    debug.log(`  - ${path.join(TYPES_DIR, "api-schema.ts")}`);
    debug.log(`  - ${path.join(CONSTANTS_DIR, "query-keys.ts")}`);
    debug.log(`  - ${API_DIR}/*.ts`);
    debug.log(`  - ${HOOKS_DIR}/*.ts`);

    // 2. 생성 성공 시 백업 디렉토리 삭제
    debug.log("🗑️  백업 디렉토리 정리 중...");
    cleanupBackup();
  } catch (error) {
    debug.error("❌ API 코드 생성 실패:", error);
    debug.log("🔄 백업된 파일로 복원 중...");
    restoreGeneratedFiles();
    throw error;
  }
}

// 스크립트가 직접 실행될 때만 실행
if (require.main === module) {
  try {
    generateApiCode();
    debug.log("🎉 API 코드 생성 완료");
  } catch (error) {
    debug.error("💥 오류 발생:", error);
    process.exit(1);
  }
}

export { generateApiCode };
