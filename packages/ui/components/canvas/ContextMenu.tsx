'use client';

import { useEffect, useRef } from 'react';

interface MenuItem {
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
}

interface MenuSection {
  items: MenuItem[];
}

interface Props {
  /** Position relative to the nearest positioned ancestor. */
  x: number;
  y: number;
  sections: MenuSection[];
  onClose: () => void;
}

/**
 * Floating dark context menu.
 * Closes on outside click, Escape, or any item action.
 */
export default function ContextMenu({ x, y, sections, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ left: x, top: y }}
      className="absolute z-50 min-w-48 bg-zinc-800 rounded-lg shadow-2xl border border-zinc-700 py-1 text-sm select-none"
      // Prevent canvas from receiving the mousedown that opens this menu
      onMouseDown={(e) => e.stopPropagation()}
    >
      {sections.map((section, si) => (
        <div key={si}>
          {si > 0 && <div className="my-1 border-t border-zinc-700" />}
          {section.items.map((item, ii) => (
            <button
              key={ii}
              onClick={() => {
                item.onClick();
                onClose();
              }}
              disabled={item.disabled}
              className="w-full flex items-center justify-between gap-6 px-3 py-1.5 text-left text-zinc-100 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <span>{item.label}</span>
              {item.shortcut && (
                <span className="text-xs text-zinc-400 font-mono">
                  {item.shortcut}
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
