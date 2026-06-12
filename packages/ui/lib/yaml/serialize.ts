import type {
  DrawingDocument,
  Layer,
  LayerItem,
  VectorShape,
} from '../../types/canvas';

// Writes YAML manually for full control over formatting.
// Coordinate pairs are always inline [x, y]; shape blocks are always
// multi-line. This keeps the output easy for both humans and LLMs to read.

function indent(level: number): string {
  return '  '.repeat(level);
}

function pt(x: number, y: number): string {
  return `[${round(x)}, ${round(y)}]`;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function color(c: string): string {
  return c === 'transparent' ? 'transparent' : `"${c}"`;
}

function shapeLines(shape: VectorShape, level: number): string[] {
  const i = indent(level);
  const lines: string[] = [];

  const strokeLine =
    shape.strokeColor !== '#1a1a1a'
      ? `${i}stroke: ${color(shape.strokeColor)}`
      : null;
  const widthLine =
    shape.strokeWidth !== 1.5
      ? `${i}strokeWidth: ${round(shape.strokeWidth)}`
      : null;

  switch (shape.type) {
    case 'line':
      lines.push(`${i}type: line`);
      lines.push(`${i}from: ${pt(shape.points[0].x, shape.points[0].y)}`);
      lines.push(`${i}to: ${pt(shape.points[1].x, shape.points[1].y)}`);
      break;
    case 'polyline':
      lines.push(`${i}type: polyline`);
      lines.push(
        `${i}points: [${shape.points.map((p) => pt(p.x, p.y)).join(', ')}]`
      );
      break;
    case 'circle':
      lines.push(`${i}type: circle`);
      lines.push(`${i}center: ${pt(shape.center.x, shape.center.y)}`);
      lines.push(`${i}radius: ${round(shape.radius)}`);
      if (shape.fillColor !== 'transparent')
        lines.push(`${i}fill: ${color(shape.fillColor)}`);
      break;
    case 'rect':
      lines.push(`${i}type: rect`);
      lines.push(`${i}origin: ${pt(shape.origin.x, shape.origin.y)}`);
      lines.push(`${i}width: ${round(shape.width)}`);
      lines.push(`${i}height: ${round(shape.height)}`);
      if (shape.fillColor !== 'transparent')
        lines.push(`${i}fill: ${color(shape.fillColor)}`);
      break;
    case 'freehand':
      lines.push(`${i}type: freehand`);
      lines.push(
        `${i}points: [${shape.points.map((p) => pt(p.x, p.y)).join(', ')}]`
      );
      break;
  }

  if (strokeLine) lines.push(strokeLine);
  if (widthLine) lines.push(widthLine);

  return lines;
}

function itemLines(item: LayerItem, level: number): string[] {
  const i = indent(level);
  const bullet = `${indent(level - 1)}- `;

  if (item.type === 'group') {
    const lines: string[] = [];
    lines.push(`${bullet}type: group`);
    if (item.name) lines.push(`${i}name: "${item.name}"`);
    if (item.children.length > 0) {
      lines.push(`${i}shapes:`);
      for (const child of item.children) {
        lines.push(...itemLines(child, level + 2));
      }
    }
    return lines;
  }

  const shapeBlock = shapeLines(item, i.length > 0 ? level : level);
  if (shapeBlock.length === 0) return [];

  // Replace the first line's indent with a bullet
  const [first, ...rest] = shapeBlock;
  return [`${bullet}${first.trimStart()}`, ...rest];
}

function layerLines(layer: Layer): string[] {
  const lines: string[] = [];
  lines.push(`  - name: "${layer.name}"`);
  if (!layer.visible) lines.push(`    visible: false`);
  if (layer.locked) lines.push(`    locked: true`);

  if (layer.items.length > 0) {
    lines.push(`    shapes:`);
    for (const item of layer.items) {
      lines.push(...itemLines(item, 3));
    }
  } else {
    lines.push(`    shapes: []`);
  }

  return lines;
}

export function serializeToYaml(doc: DrawingDocument): string {
  const lines: string[] = [];

  lines.push(`title: "${doc.title}"`);

  if (doc.gridConfig.majorEvery !== 5) {
    lines.push(`grid:`);
    lines.push(`  majorEvery: ${doc.gridConfig.majorEvery}`);
  }

  lines.push(`layers:`);
  doc.layers.forEach((layer) => {
    lines.push(...layerLines(layer));
  });

  return lines.join('\n') + '\n';
}
