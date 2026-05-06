import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import type { ScanResult, ScanItem, CategoryResult } from "../types";
import * as api from "../api";

interface ScanState {
  result: ScanResult | null;
  isScanning: boolean;
  selectedIds: Set<string>;
  startScan: () => Promise<void>;
  loadCachedScan: () => Promise<void>;
  toggleItem: (id: string) => void;
  toggleCategory: (category: CategoryResult) => void;
  toggleCategoryAll: (category: CategoryResult) => void;
  selectAllGreen: () => void;
  clearSelection: () => void;
}

export const useScanStore = create<ScanState>((set, get) => ({
  result: null,
  isScanning: false,
  selectedIds: new Set(),

  async startScan() {
    set({ isScanning: true, selectedIds: new Set() });

    const unlisten = await listen<ScanItem[]>("scan:progress", () => {
      // Progressive updates could be merged here in the future
    });

    try {
      const result = await api.startScan();
      const ids = new Set<string>();
      for (const cat of result.categories) {
        for (const item of cat.items) {
          if (item.safety === "green") ids.add(item.id);
        }
      }
      set({ result, selectedIds: ids });
    } finally {
      set({ isScanning: false });
      unlisten();
    }
  },

  async loadCachedScan() {
    const result = await api.getCachedScan();
    if (result) {
      const ids = new Set<string>();
      for (const cat of result.categories) {
        for (const item of cat.items) {
          if (item.safety === "green") ids.add(item.id);
        }
      }
      set({ result, selectedIds: ids });
    }
  },

  toggleItem(id: string) {
    const { selectedIds } = get();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ selectedIds: next });
  },

  toggleCategory(category: CategoryResult) {
    const { selectedIds } = get();
    const next = new Set(selectedIds);
    const greenItems = category.items.filter((i) => i.safety === "green");
    const allSelected = greenItems.every((i) => next.has(i.id));
    for (const item of greenItems) {
      if (allSelected) next.delete(item.id);
      else next.add(item.id);
    }
    set({ selectedIds: next });
  },

  toggleCategoryAll(category: CategoryResult) {
    const { selectedIds } = get();
    const next = new Set(selectedIds);
    const selectable = category.items.filter((i) => i.safety !== "red");
    const allSelected =
      selectable.length > 0 && selectable.every((i) => next.has(i.id));
    for (const item of selectable) {
      if (allSelected) next.delete(item.id);
      else next.add(item.id);
    }
    set({ selectedIds: next });
  },

  selectAllGreen() {
    const { result } = get();
    if (!result) return;
    const ids = new Set<string>();
    for (const cat of result.categories) {
      for (const item of cat.items) {
        if (item.safety === "green") ids.add(item.id);
      }
    }
    set({ selectedIds: ids });
  },

  clearSelection() {
    set({ selectedIds: new Set() });
  },
}));

export const useSelectedBytes = () =>
  useScanStore((s) => {
    const items =
      s.result?.categories
        .flatMap((c) => c.items)
        .filter((i) => s.selectedIds.has(i.id)) ?? [];
    return items.reduce((sum, i) => sum + i.size_bytes, 0);
  });
