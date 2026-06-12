export type ToolType =
  | 'select'
  | 'hand'
  | 'line'
  | 'polyline'
  | 'circle'
  | 'rect'
  | 'freehand';

export interface ToolSettings {
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  snapEnabled: boolean;
  snapStep: number;
}

export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
  strokeColor: '#1a1a1a',
  strokeWidth: 1.5,
  fillColor: 'transparent',
  snapEnabled: true,
  snapStep: 1,
};
