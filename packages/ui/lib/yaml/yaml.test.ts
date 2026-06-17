import { describe, it, expect } from 'vitest';
import { parseYaml } from './parse';
import { serializeToYaml } from './serialize';
import type { DrawingDocument, VectorShape } from '../../types/canvas';

// Minimal stub — parseYaml only reads viewport, gridConfig, id, and timestamps.
const BASE_DOC: DrawingDocument = {
  id: 'doc-1',
  title: 'Test',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  viewport: { zoom: 1, panOffset: { x: 0, y: 0 } },
  gridConfig: { majorEvery: 5, snapToGrid: true, cellSize: 1 },
  layers: [],
};

function parse(yaml: string): DrawingDocument {
  const result = parseYaml(yaml, BASE_DOC);
  if (result.error) throw new Error(result.error);
  if (!result.document) throw new Error('parseYaml returned no document');
  return result.document;
}

// ─── grid settings: parse ────────────────────────────────────────────────────

describe('grid settings — parse', () => {
  it('reads snapToGrid: false', () => {
    const doc = parse(`grid:\n  snapToGrid: false\nlayers: []`);
    expect(doc.gridConfig.snapToGrid).toBe(false);
  });

  it('reads unit and cellSize', () => {
    const doc = parse(`grid:\n  unit: "cm"\n  cellSize: 10\nlayers: []`);
    expect(doc.gridConfig.unit).toBe('cm');
    expect(doc.gridConfig.cellSize).toBe(10);
  });

  it('falls back to current gridConfig when grid block is absent', () => {
    const doc = parse(`layers: []`);
    expect(doc.gridConfig.snapToGrid).toBe(true);
    expect(doc.gridConfig.unit).toBeUndefined();
    expect(doc.gridConfig.cellSize).toBe(1);
  });

  it('unit is undefined when omitted', () => {
    const doc = parse(`grid:\n  majorEvery: 4\nlayers: []`);
    expect(doc.gridConfig.unit).toBeUndefined();
  });
});

// ─── grid settings: serialize ─────────────────────────────────────────────────

describe('grid settings — serialize', () => {
  it('omits grid block when all fields are default', () => {
    const doc = parse(`layers: []`);
    expect(serializeToYaml(doc)).not.toContain('grid:');
  });

  it('emits snapToGrid: false when disabled', () => {
    const doc = parse(`grid:\n  snapToGrid: false\nlayers: []`);
    const yaml = serializeToYaml(doc);
    expect(yaml).toContain('snapToGrid: false');
  });

  it('emits unit but not cellSize when cellSize is 1', () => {
    const doc = parse(`grid:\n  unit: "ft"\nlayers: []`);
    const yaml = serializeToYaml(doc);
    expect(yaml).toContain('unit: "ft"');
    expect(yaml).not.toContain('cellSize:');
  });

  it('emits cellSize when unit is set and cellSize is not 1', () => {
    const doc = parse(`grid:\n  unit: "cm"\n  cellSize: 10\nlayers: []`);
    const yaml = serializeToYaml(doc);
    expect(yaml).toContain('unit: "cm"');
    expect(yaml).toContain('cellSize: 10');
  });

  it('round-trips grid settings through parse → serialize → parse', () => {
    const original = `title: "Test"\ngrid:\n  majorEvery: 4\n  snapToGrid: false\n  unit: "in"\n  cellSize: 6\nlayers:\n  - name: "L"\n    shapes: []\n`;
    const doc1 = parse(original);
    const reserialised = serializeToYaml(doc1);
    const doc2 = parse(reserialised);
    expect(doc2.gridConfig.majorEvery).toBe(4);
    expect(doc2.gridConfig.snapToGrid).toBe(false);
    expect(doc2.gridConfig.unit).toBe('in');
    expect(doc2.gridConfig.cellSize).toBe(6);
  });
});

// ─── key field: parse ─────────────────────────────────────────────────────────

describe('key field — parse', () => {
  it('preserves key on a rect', () => {
    const doc = parse(`
layers:
  - name: L
    shapes:
      - key: "my-rect"
        type: rect
        origin: [0, 0]
        width: 5
        height: 4
`);
    expect(doc.layers[0].items[0].key).toBe('my-rect');
  });

  it('preserves key on a line', () => {
    const doc = parse(`
layers:
  - name: L
    shapes:
      - key: baseline
        type: line
        from: [0, 0]
        to: [10, 0]
`);
    expect(doc.layers[0].items[0].key).toBe('baseline');
  });

  it('key is undefined when omitted', () => {
    const doc = parse(`
layers:
  - name: L
    shapes:
      - type: line
        from: [0, 0]
        to: [5, 5]
`);
    expect(doc.layers[0].items[0].key).toBeUndefined();
  });

  it('preserves key on a group', () => {
    const doc = parse(`
layers:
  - name: L
    shapes:
      - key: "box-group"
        type: group
        shapes:
          - type: line
            from: [0, 0]
            to: [1, 1]
`);
    expect(doc.layers[0].items[0].key).toBe('box-group');
  });

  it('preserves key on a nested shape inside a group', () => {
    const doc = parse(`
layers:
  - name: L
    shapes:
      - type: group
        shapes:
          - key: "inner"
            type: circle
            center: [5, 5]
            radius: 2
`);
    const group = doc.layers[0].items[0];
    if (group.type !== 'group') throw new Error('expected group');
    expect(group.children[0].key).toBe('inner');
  });
});

// ─── key field: serialize ─────────────────────────────────────────────────────

describe('key field — serialize', () => {
  it('emits key as the bullet field for a shape', () => {
    const doc = parse(`
layers:
  - name: L
    shapes:
      - key: "target"
        type: rect
        origin: [1, 2]
        width: 3
        height: 4
`);
    const yaml = serializeToYaml(doc);
    // key should appear before type, as the bullet entry
    expect(yaml).toContain('- key: "target"');
    const keyIndex = yaml.indexOf('- key: "target"');
    const typeIndex = yaml.indexOf('type: rect');
    expect(typeIndex).toBeGreaterThan(keyIndex);
  });

  it('omits key field when not set', () => {
    const doc = parse(`
layers:
  - name: L
    shapes:
      - type: line
        from: [0, 0]
        to: [5, 0]
`);
    const yaml = serializeToYaml(doc);
    expect(yaml).not.toContain('key:');
  });

  it('round-trips key through parse → serialize → parse', () => {
    const original = `title: "Test"
layers:
  - name: "L"
    shapes:
      - key: "my-rect"
        type: rect
        origin: [1, 2]
        width: 3
        height: 4
`;
    const doc1 = parse(original);
    const reserialised = serializeToYaml(doc1);
    const doc2 = parse(reserialised);
    expect(doc2.layers[0].items[0].key).toBe('my-rect');
  });
});

// ─── label field: parse ───────────────────────────────────────────────────────

describe('label field — parse', () => {
  it('preserves label on a rect', () => {
    const doc = parse(`
layers:
  - name: L
    shapes:
      - label: "Room A"
        type: rect
        origin: [0, 0]
        width: 5
        height: 4
`);
    expect((doc.layers[0].items[0] as VectorShape).label).toBe('Room A');
  });

  it('preserves label on a line', () => {
    const doc = parse(`
layers:
  - name: L
    shapes:
      - label: baseline
        type: line
        from: [0, 0]
        to: [10, 0]
`);
    expect((doc.layers[0].items[0] as VectorShape).label).toBe('baseline');
  });

  it('label is undefined when omitted', () => {
    const doc = parse(`
layers:
  - name: L
    shapes:
      - type: line
        from: [0, 0]
        to: [5, 5]
`);
    expect((doc.layers[0].items[0] as VectorShape).label).toBeUndefined();
  });
});

// ─── strokeDash field ────────────────────────────────────────────────────────

describe('strokeDash field — parse', () => {
  it('preserves strokeDash: dashed on a line', () => {
    const doc = parse(`
layers:
  - name: L
    shapes:
      - type: line
        from: [0, 0]
        to: [5, 0]
        strokeDash: dashed
`);
    expect((doc.layers[0].items[0] as VectorShape).strokeDash).toBe('dashed');
  });

  it('strokeDash is undefined when omitted', () => {
    const doc = parse(`
layers:
  - name: L
    shapes:
      - type: line
        from: [0, 0]
        to: [5, 0]
`);
    expect((doc.layers[0].items[0] as VectorShape).strokeDash).toBeUndefined();
  });
});

describe('strokeDash field — serialize', () => {
  it('emits strokeDash for dashed lines', () => {
    const doc = parse(`
layers:
  - name: L
    shapes:
      - type: line
        from: [0, 0]
        to: [5, 0]
        strokeDash: dashed
`);
    expect(serializeToYaml(doc)).toContain('strokeDash: dashed');
  });

  it('omits strokeDash when solid (default)', () => {
    const doc = parse(`
layers:
  - name: L
    shapes:
      - type: line
        from: [0, 0]
        to: [5, 0]
        strokeDash: solid
`);
    expect(serializeToYaml(doc)).not.toContain('strokeDash:');
  });

  it('round-trips strokeDash: dotted through parse → serialize → parse', () => {
    const original = `title: "Test"
layers:
  - name: "L"
    shapes:
      - type: rect
        origin: [0, 0]
        width: 4
        height: 3
        strokeDash: dotted
`;
    const doc1 = parse(original);
    const doc2 = parse(serializeToYaml(doc1));
    expect((doc2.layers[0].items[0] as VectorShape).strokeDash).toBe('dotted');
  });
});

// ─── label field: serialize ───────────────────────────────────────────────────

describe('label field — serialize', () => {
  it('emits label line after key for a labelled shape', () => {
    const doc = parse(`
layers:
  - name: L
    shapes:
      - label: "Kitchen"
        type: rect
        origin: [1, 2]
        width: 3
        height: 4
`);
    const yaml = serializeToYaml(doc);
    expect(yaml).toContain('label: "Kitchen"');
  });

  it('omits label field when not set', () => {
    const doc = parse(`
layers:
  - name: L
    shapes:
      - type: line
        from: [0, 0]
        to: [5, 0]
`);
    const yaml = serializeToYaml(doc);
    expect(yaml).not.toContain('label:');
  });

  it('round-trips label through parse → serialize → parse', () => {
    const original = `title: "Test"
layers:
  - name: "L"
    shapes:
      - label: "my-label"
        type: rect
        origin: [1, 2]
        width: 3
        height: 4
`;
    const doc1 = parse(original);
    const reserialised = serializeToYaml(doc1);
    const doc2 = parse(reserialised);
    expect((doc2.layers[0].items[0] as VectorShape).label).toBe('my-label');
  });
});
