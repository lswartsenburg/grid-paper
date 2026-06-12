import { describe, it, expect } from 'vitest';
import { parseYaml } from './parse';
import { serializeToYaml } from './serialize';
import type { DrawingDocument } from '../../types/canvas';

// Minimal stub — parseYaml only reads viewport, gridConfig, id, and timestamps.
const BASE_DOC: DrawingDocument = {
  id: 'doc-1',
  title: 'Test',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  viewport: { zoom: 1, panOffset: { x: 0, y: 0 } },
  gridConfig: { majorEvery: 5 },
  layers: [],
};

function parse(yaml: string): DrawingDocument {
  const result = parseYaml(yaml, BASE_DOC);
  if (result.error) throw new Error(result.error);
  if (!result.document) throw new Error('parseYaml returned no document');
  return result.document;
}

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
