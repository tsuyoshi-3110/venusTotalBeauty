"use client";

import React, { useMemo } from "react";
import clsx from "clsx";
import {
  SwipeableList, SwipeableListItem,
  LeadingActions, TrailingActions, SwipeAction,
} from "react-swipeable-list";
import "react-swipeable-list/dist/styles.css";

import { ThemeKey, THEMES } from "@/lib/themes";
import { useThemeGradient } from "@/lib/useThemeGradient";

type MenuItem = {
  id: string;
  name: string;
  description?: string;
  price?: number | null;
  isTaxIncluded?: boolean;
  order: number;
};

export default function MenuItemCard({
  item,
  onDelete,
  onEdit,
  isLoggedIn,
}: {
  item: MenuItem;
  onDelete: () => void;
  onEdit: (item: MenuItem) => void; // 親の“統一モーダル”を開く
  isLoggedIn: boolean;
}) {
  const yen = (n: number) => n.toLocaleString("ja-JP");
  const gradient = useThemeGradient();
  const isDark = useMemo(() => {
    const dark: ThemeKey[] = ["brandG", "brandH", "brandI"];
    return gradient ? dark.some((k) => gradient === THEMES[k]) : false;
  }, [gradient]);

  const leading = () =>
    isLoggedIn ? (
      <LeadingActions>
        <SwipeAction onClick={() => onEdit(item)}>
          <div className="bg-emerald-500 text-white px-4 py-2 flex items-center justify-center whitespace-nowrap w-24 rounded-l">
            編集
          </div>
        </SwipeAction>
      </LeadingActions>
    ) : undefined;

  const trailing = () =>
    isLoggedIn ? (
      <TrailingActions>
        <SwipeAction onClick={onDelete}>
          <div className="bg-red-500 text-white px-4 py-2 flex items-center justify-center whitespace-nowrap w-24 rounded-r">
            削除
          </div>
        </SwipeAction>
      </TrailingActions>
    ) : undefined;

  return (
    <SwipeableList threshold={0.25}>
      <SwipeableListItem
        leadingActions={leading()}
        trailingActions={trailing()}
      >
        <div
          className={clsx(
            "flex flex-col gap-1 py-3 px-2 rounded border-b",
            isDark ? "text-white border-white/20" : "text-black border-gray-200"
          )}
        >
          <p className={clsx("font-semibold whitespace-pre-wrap text-black")}>
            {item.name}
          </p>

          {item.price != null && (
            <p className={clsx("text-sm", "text-black")}>
              ¥{yen(item.price)}
              {typeof item.isTaxIncluded === "boolean"
                ? `（${item.isTaxIncluded ? "税込" : "税別"}）`
                : ""}
            </p>
          )}

          {item.description && (
            <p className={clsx("whitespace-pre-wrap text-sm", "text-black")}>
              {item.description}
            </p>
          )}
        </div>
      </SwipeableListItem>
    </SwipeableList>
  );
}
