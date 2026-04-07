"use client";

import { Component, useMemo } from "react";
import dynamic from "next/dynamic";
import type { ExtendedRecordMap } from "notion-types";

const NotionRenderer = dynamic(
  () => import("react-notion-x").then((m) => m.NotionRenderer),
  { ssr: false }
);

interface SafeNotionRendererProps {
  recordMap?: ExtendedRecordMap | null;
  [key: string]: unknown;
}

interface RenderErrorBoundaryProps {
  children: React.ReactNode;
}

interface RenderErrorBoundaryState {
  hasError: boolean;
}

type NotionEntity = {
  role?: unknown;
  value?: Record<string, unknown> & {
    value?: Record<string, unknown>;
    role?: unknown;
    content?: unknown;
    page_sort?: unknown;
  };
};

type NotionTable = Record<string, NotionEntity>;

class RenderErrorBoundary extends Component<
  RenderErrorBoundaryProps,
  RenderErrorBoundaryState
> {
  state: RenderErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RenderErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

const normalizeNotionRecordMap = (
  recordMap: ExtendedRecordMap | null | undefined
): ExtendedRecordMap | undefined => {
  if (!recordMap || typeof recordMap !== "object") return undefined;

  const normalized = structuredClone(recordMap) as ExtendedRecordMap;

  const normalizeValueWrapper = (table?: NotionTable) => {
    if (!table) return;
    Object.keys(table).forEach((key) => {
      const item = table[key];
      if (item?.value?.value && typeof item.value.value === "object") {
        table[key] = {
          ...item,
          role: item.value.role ?? item.role,
          value: item.value.value,
        };
      }
    });
  };

  normalizeValueWrapper(normalized.block as unknown as NotionTable | undefined);
  normalizeValueWrapper(
    normalized.collection as unknown as NotionTable | undefined
  );
  normalizeValueWrapper(
    normalized.collection_view as unknown as NotionTable | undefined
  );

  const blockMap = normalized.block as unknown as NotionTable | undefined;
  if (!blockMap) return normalized;

  Object.keys(blockMap).forEach((blockId) => {
    const blockValue = blockMap[blockId]?.value;
    if (!blockValue || typeof blockValue !== "object") return;

    if (Array.isArray(blockValue.content)) {
      blockValue.content = blockValue.content.filter(
        (id: unknown) => typeof id === "string" && Boolean(blockMap[id])
      );
    }
  });

  const collectionViewMap = normalized.collection_view as unknown as
    | NotionTable
    | undefined;
  if (collectionViewMap) {
    Object.keys(collectionViewMap).forEach((viewId) => {
      const viewValue = collectionViewMap[viewId]?.value;
      if (!viewValue || typeof viewValue !== "object") return;

      if (Array.isArray(viewValue.page_sort)) {
        viewValue.page_sort = viewValue.page_sort.filter(
          (id: unknown) => typeof id === "string" && Boolean(blockMap[id])
        );
      }
    });
  }

  return normalized;
};

export const SafeNotionRenderer = ({
  recordMap,
  ...props
}: SafeNotionRendererProps) => {
  const normalizedRecordMap = useMemo(
    () => normalizeNotionRecordMap(recordMap),
    [recordMap]
  );

  if (!normalizedRecordMap?.block) return null;

  return (
    <RenderErrorBoundary>
      <NotionRenderer recordMap={normalizedRecordMap} {...props} />
    </RenderErrorBoundary>
  );
};
