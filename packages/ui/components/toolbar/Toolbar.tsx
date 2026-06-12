'use client';

import type { ToolType } from '../../lib/tools/types';

interface Tool {
  type: ToolType;
  label: string;
  icon: React.ReactNode;
}

const TOOLS: Tool[] = [
  {
    type: 'select',
    label: 'Select',
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path d="M3 1 L3 12 L6 9 L9 14.5 L11 13.5 L8 8 L12 8 Z" />
      </svg>
    ),
  },
  {
    type: 'hand',
    label: 'Hand — pan canvas (H)',
    icon: (
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 8V4.5a1 1 0 0 1 2 0V8m0-3.5V3a1 1 0 0 1 2 0v5m0-3a1 1 0 0 1 2 0v3.5A4.5 4.5 0 0 1 7.5 13a3 3 0 0 1-3-3V7a1 1 0 0 1 2 0v1" />
      </svg>
    ),
  },
  {
    type: 'line',
    label: 'Line',
    icon: (
      <svg
        viewBox="0 0 16 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <line x1="2" y1="13" x2="13" y2="2" />
      </svg>
    ),
  },
  {
    type: 'polyline',
    label: 'Polyline (click; dbl-click to finish)',
    icon: (
      <svg
        viewBox="0 0 16 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <polyline points="2,12 6,4 10,9 14,3" />
      </svg>
    ),
  },
  {
    type: 'rect',
    label: 'Rectangle',
    icon: (
      <svg
        viewBox="0 0 16 16"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      >
        <rect x="2" y="4" width="12" height="8" />
      </svg>
    ),
  },
  {
    type: 'circle',
    label: 'Circle',
    icon: (
      <svg
        viewBox="0 0 16 16"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      >
        <circle cx="8" cy="8" r="6" />
      </svg>
    ),
  },
  {
    type: 'freehand',
    label: 'Freehand',
    icon: (
      <svg
        viewBox="0 0 16 16"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      >
        <path d="M 2 13 C 4 9, 5 13, 7 9 S 10 5, 13 3" />
      </svg>
    ),
  },
];

interface Props {
  activeTool: ToolType;
  onSetTool: (t: ToolType) => void;
}

export default function Toolbar({ activeTool, onSetTool }: Props) {
  return (
    <div className="flex flex-row items-center gap-1 px-2 py-1.5 bg-white rounded-xl shadow-md border border-zinc-200">
      {TOOLS.map((tool) => (
        <button
          key={tool.type}
          title={tool.label}
          onClick={() => onSetTool(tool.type)}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
            activeTool === tool.type
              ? 'bg-zinc-900 text-white'
              : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
        >
          <span className="w-4 h-4">{tool.icon}</span>
        </button>
      ))}
    </div>
  );
}
