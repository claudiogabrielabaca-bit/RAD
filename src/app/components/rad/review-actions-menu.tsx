"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ReviewActionsMenuProps = {
  onEdit: () => void;
  onCreatePost: () => void;
  onDelete: () => void;
  disabled?: boolean;
};

type MenuPosition = {
  top: number;
  left: number;
};

const MENU_WIDTH = 192;
const MENU_HEIGHT = 168;
const MENU_GAP = 8;
const VIEWPORT_PADDING = 12;

export default function ReviewActionsMenu({
  onEdit,
  onCreatePost,
  onDelete,
  disabled = false,
}: ReviewActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0 });

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const canUsePortal = typeof document !== "undefined";

  function updatePosition() {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();

    const openUp =
      window.innerHeight - rect.bottom < MENU_HEIGHT + MENU_GAP + VIEWPORT_PADDING &&
      rect.top > MENU_HEIGHT + MENU_GAP + VIEWPORT_PADDING;

    const top = openUp
      ? rect.top - MENU_HEIGHT - MENU_GAP
      : rect.bottom + MENU_GAP;

    const left = Math.min(
      window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING,
      Math.max(VIEWPORT_PADDING, rect.right - MENU_WIDTH)
    );

    setPosition({ top, left });
  }

  useEffect(() => {
    if (!open) return;

    updatePosition();

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      const clickedButton = buttonRef.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);

      if (clickedButton || clickedMenu) return;

      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function handleViewportChange() {
      updatePosition();
    }

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open]);

  function runAction(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (!open) updatePosition();
          setOpen((prev) => !prev);
        }}
        aria-label="Open review actions"
        title="Open review actions"
        className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {canUsePortal && open
        ? createPortal(
            <div
              ref={menuRef}
              style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                width: MENU_WIDTH,
                zIndex: 9999,
              }}
              className="overflow-hidden rounded-2xl border border-white/10 bg-[#121212]/98 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.025),transparent_24%)]" />

              <div className="relative p-2">
                <button
                  type="button"
                  onClick={() => runAction(onEdit)}
                  className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06]"
                >
                  Edit review
                </button>

                <button
                  type="button"
                  onClick={() => runAction(onCreatePost)}
                  className="mt-1 flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06]"
                >
                  Create post
                </button>

                <div className="my-2 h-px bg-white/8" />

                <button
                  type="button"
                  onClick={() => runAction(onDelete)}
                  className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
                >
                  Delete review
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}