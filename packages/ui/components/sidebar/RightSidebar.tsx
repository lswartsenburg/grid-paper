'use client';

import type { ReactNode } from 'react';

export type PanelId = string;

/** Definition for a single toggleable panel in the right sidebar. */
export interface SidebarPanel {
  id: PanelId;
  label: string;
  /** 16×16 icon rendered inside the toggle button. */
  icon: ReactNode;
  content: ReactNode;
}

interface Props {
  panels: SidebarPanel[];
  /** ID of the currently open panel, or null if all are closed. */
  activePanel: PanelId | null;
  /** Clicking an open panel's button closes it; clicking a closed one opens it. */
  onTogglePanel: (id: PanelId) => void;
}

/**
 * Right-side icon strip with toggleable panels.
 * The icon strip is always visible; the panel slides in to its left when open.
 * Hidden by default (activePanel = null).
 */
export default function RightSidebar({
  panels,
  activePanel,
  onTogglePanel,
}: Props) {
  const active = panels.find((p) => p.id === activePanel);

  return (
    <div className="flex shrink-0">
      {/* Panel content — only rendered when a panel is active */}
      {active && (
        <div className="flex flex-col w-72 bg-white border-l border-zinc-200 overflow-hidden">
          <div className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide border-b border-zinc-100 shrink-0 select-none">
            {active.label}
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            {active.content}
          </div>
        </div>
      )}

      {/* Icon button strip */}
      <div className="flex flex-col items-center gap-1 px-1 py-2 bg-white border-l border-zinc-200 w-10 shrink-0">
        {panels.map((panel) => (
          <button
            key={panel.id}
            title={panel.label}
            onClick={() => onTogglePanel(panel.id)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
              activePanel === panel.id
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <span className="w-4 h-4">{panel.icon}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
