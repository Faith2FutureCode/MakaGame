export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v | 0));
}

export function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function smoothstep01(t) {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
}

export function clampFloat(v, min, max) {
  let n = parseFloat(v);
  if(!Number.isFinite(n)) n = min;
  return Math.max(min, Math.min(max, n));
}

export function sanitizeHexColor(value, fallback = '#7fe3ff') {
  if(typeof value !== 'string') return fallback;
  const hex = value.trim();
  if(/^#([0-9a-fA-F]{6})$/.test(hex)){
    return `#${hex.slice(1).toLowerCase()}`;
  }
  if(/^#([0-9a-fA-F]{3})$/.test(hex)){
    const digits = hex.slice(1).toLowerCase();
    return `#${digits.split('').map((c)=> c + c).join('')}`;
  }
  return fallback;
}

export function degToRad(deg) {
  return (Number(deg) || 0) * Math.PI / 180;
}

export function radToDeg(rad) {
  return (Number(rad) || 0) * 180 / Math.PI;
}
