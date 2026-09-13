export const ROUTE_GAP = 8;
export type Circle = { x: number; y: number; radius: number };
export function connectorGeometry(from: Circle, to: Circle, gap = ROUTE_GAP) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= from.radius + to.radius + gap * 2) return null;
  const ux = dx / distance, uy = dy / distance;
  return { x1: from.x + ux * (from.radius + gap), y1: from.y + uy * (from.radius + gap), x2: to.x - ux * (to.radius + gap), y2: to.y - uy * (to.radius + gap) };
}
