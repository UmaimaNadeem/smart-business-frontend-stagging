"use client";

import React, { useEffect } from "react";

type ModalBackdropProps = {
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
};

/**
 * Full-screen modal overlay.
 * - Sits above header/sidebar (z-index)
 * - Scrolls when content is taller than the viewport
 * - Click outside closes
 */
export default function ModalBackdrop({
  onClose,
  children,
  className = "",
}: ModalBackdropProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-[100000] overflow-y-auto ${className}`}
      role="presentation"
    >
      {/* Dim layer */}
      <div
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Scrollable centering shell */}
      <div className="relative flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Constrain tall panels; children keep their max-w-* */}
          <div className="mx-auto flex w-full justify-center [&>*]:max-h-[calc(100dvh-2rem)] [&>*]:overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
