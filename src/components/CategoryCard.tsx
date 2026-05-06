import { useState } from "react";
import type { CategoryResult } from "../lib/types";
import { useScanStore } from "../lib/stores/scan";
import { formatBytes } from "../lib/utils/format";
import { ScanItemRow } from "./ScanItem";

interface Props {
  category: CategoryResult;
}

export function CategoryCard({ category }: Props) {
  const [expanded, setExpanded] = useState(true);
  const { selectedIds, toggleItem, toggleCategory, toggleCategoryAll } =
    useScanStore();

  const greenItems = category.items.filter((i) => i.safety === "green");
  const yellowItems = category.items.filter((i) => i.safety === "yellow");
  const selectableItems = category.items.filter((i) => i.safety !== "red");
  const allSelected =
    greenItems.length > 0 && greenItems.every((i) => selectedIds.has(i.id));
  const someSelected =
    !allSelected && greenItems.some((i) => selectedIds.has(i.id));
  const allIncludingYellowSelected =
    selectableItems.length > 0 &&
    selectableItems.every((i) => selectedIds.has(i.id));

  return (
    <div className="category-card">
      <div className="category-card__header" onClick={() => setExpanded(!expanded)}>
        <div className="category-card__left">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={(e) => {
              e.stopPropagation();
              toggleCategory(category);
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <div>
            <h3 className="category-card__title">{category.display_name}</h3>
            <p className="category-card__desc">{category.description}</p>
          </div>
        </div>
        <div className="category-card__right">
          {yellowItems.length > 0 && (
            <button
              type="button"
              className="category-card__select-all"
              onClick={(e) => {
                e.stopPropagation();
                toggleCategoryAll(category);
              }}
              title="Select every item in this category, including yellow items that need review"
            >
              {allIncludingYellowSelected ? "Deselect all" : "Select all"}
            </button>
          )}
          <span className="category-card__size">
            {formatBytes(category.total_bytes)}
          </span>
          <span className={`category-card__arrow ${expanded ? "expanded" : ""}`}>
            &#9662;
          </span>
        </div>
      </div>
      {expanded && (
        <div className="category-card__items">
          {category.items.map((item) => (
            <ScanItemRow
              key={item.id}
              item={item}
              selected={selectedIds.has(item.id)}
              onToggle={() => toggleItem(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
