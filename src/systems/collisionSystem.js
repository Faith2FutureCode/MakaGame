export function createCollisionHelpers({
  GameState,
  mapState,
  customColliders,
  clampSettingValue,
  SETTINGS_RANGE_MIN,
  perfCounters
} = {}) {
  const NAV_CELL_SIZE = 14;
  const MAX_PATHFIND_NODES = 5000;
  const NAV_LINE_STEP = NAV_CELL_SIZE * 0.5;

  function hitboxPixelsReady() {
    return !!(GameState.map.hitbox.loaded && GameState.map.hitbox.data && GameState.map.hitbox.data.length);
  }

  function hitboxActive() {
    return hitboxPixelsReady() || customColliders.length > 0;
  }

  function circleCollides(x, y, radius) {
    if(perfCounters && typeof perfCounters.circleChecks === 'number'){ perfCounters.circleChecks += 1; }
    if(customColliders.length && collidersBlockCircle(x, y, radius)){
      return true;
    }
    if(!hitboxPixelsReady()) return false;
    const width = GameState.map.hitbox.width;
    const height = GameState.map.hitbox.height;
    if((x + radius) < 0 || (y + radius) < 0 || (x - radius) >= width || (y - radius) >= height){
      return true;
    }
    const coarse = GameState.map.hitbox && GameState.map.hitbox.coarse;
    if(coarse && coarse.mask && coarse.mask.length){
      const { cellSize, cols, rows, mask } = coarse;
      const minCx = Math.max(0, Math.floor((x - radius) / cellSize));
      const maxCx = Math.min(cols - 1, Math.floor((x + radius) / cellSize));
      const minCy = Math.max(0, Math.floor((y - radius) / cellSize));
      const maxCy = Math.min(rows - 1, Math.floor((y + radius) / cellSize));
      for(let cy = minCy; cy <= maxCy; cy++){
        const rowIndex = cy * cols;
        for(let cx = minCx; cx <= maxCx; cx++){
          if(mask[rowIndex + cx]){
            return true;
          }
        }
      }
      return false;
    }
    if(radius <= 0){
      const px = Math.floor(x);
      const py = Math.floor(y);
      if(px < 0 || py < 0 || px >= GameState.map.hitbox.width || py >= GameState.map.hitbox.height) return true;
      return !!GameState.map.hitbox.data[py * GameState.map.hitbox.width + px];
    }
    const minX = Math.max(0, Math.floor(x - radius));
    const maxX = Math.min(GameState.map.hitbox.width - 1, Math.ceil(x + radius));
    const minY = Math.max(0, Math.floor(y - radius));
    const maxY = Math.min(GameState.map.hitbox.height - 1, Math.ceil(y + radius));
    const rSq = radius * radius;
    for(let py=minY; py<=maxY; py++){
      const rowIndex = py * GameState.map.hitbox.width;
      for(let px=minX; px<=maxX; px++){
        if(GameState.map.hitbox.data[rowIndex + px]){
          const dx = (px + 0.5) - x;
          const dy = (py + 0.5) - y;
          if(dx*dx + dy*dy <= rSq) return true;
        }
      }
    }
    return false;
  }

  function ensureColliderGrid(){
    const collidersState = GameState && GameState.map && GameState.map.colliders;
    if(!collidersState || !Array.isArray(customColliders)){ return null; }
    const version = collidersState.nextId || customColliders.length;
    const spatial = collidersState.spatial;
    if(spatial && spatial.version === version && spatial.buckets){
      return spatial;
    }
    const cellSize = 256;
    const buckets = new Map();
    function addToBucket(cx, cy, index){
      const key = `${cx},${cy}`;
      if(!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(index);
    }
    for(let i=0;i<customColliders.length;i++){
      const c = customColliders[i];
      if(!c) continue;
      const r = Math.max(0, Number(c.radius) || 0);
      const len = Math.max(0, Number(c.length) || 0);
      const reach = Math.max(r, len * 0.5 + r);
      const minCx = Math.floor((c.x - reach) / cellSize);
      const maxCx = Math.floor((c.x + reach) / cellSize);
      const minCy = Math.floor((c.y - reach) / cellSize);
      const maxCy = Math.floor((c.y + reach) / cellSize);
      for(let cy=minCy; cy<=maxCy; cy++){
        for(let cx=minCx; cx<=maxCx; cx++){
          addToBucket(cx, cy, i);
        }
      }
    }
    const grid = { cellSize, buckets, version };
    collidersState.spatial = grid;
    return grid;
  }

  function collidersBlockCircle(x, y, radius) {
    const r = Math.max(0, Number(radius) || 0);
    const grid = ensureColliderGrid();
    if(grid){
      const { cellSize, buckets } = grid;
      const minCx = Math.floor((x - r) / cellSize);
      const maxCx = Math.floor((x + r) / cellSize);
      const minCy = Math.floor((y - r) / cellSize);
      const maxCy = Math.floor((y + r) / cellSize);
      const tested = new Set();
      for(let cy = minCy; cy <= maxCy; cy++){
        for(let cx = minCx; cx <= maxCx; cx++){
          const key = `${cx},${cy}`;
          const list = buckets.get(key);
          if(!list) continue;
          for(const idx of list){
            if(tested.has(idx)) continue;
            tested.add(idx);
            const collider = customColliders[idx];
            if(!collider) continue;
            if(colliderBlocksCircle(collider, x, y, r)){
              return true;
            }
          }
        }
      }
      return false;
    }
    for(let i=0;i<customColliders.length;i++){
      const collider = customColliders[i];
      if(!collider) continue;
      if(colliderBlocksCircle(collider, x, y, r)){
        return true;
      }
    }
    return false;
  }

  function colliderBlocksCircle(collider, x, y, radius) {
    if(!collider) return false;
    const type = collider.type === 'capsule' ? 'capsule'
      : (collider.type === 'crescent' ? 'crescent' : 'circle');
    const cx = Number(collider.x) || 0;
    const cy = Number(collider.y) || 0;
    if(type === 'circle'){
      const rad = Math.max(0, Number(collider.radius) || 0);
      const dx = x - cx;
      const dy = y - cy;
      return Math.hypot(dx, dy) <= rad + radius;
    }
    if(type === 'crescent'){
      const metrics = ensureCrescentMetrics(collider);
      const distOuter = Math.hypot(x - metrics.cx, y - metrics.cy);
      if(distOuter > metrics.radius + radius) return false;
      if(metrics.innerRadius <= 0) return true;
      const distInner = Math.hypot(x - metrics.innerCx, y - metrics.innerCy);
      return distInner + radius > metrics.innerRadius;
    }
    return circleIntersectsCapsule(x, y, radius, collider);
  }

  function ensureCapsuleMetrics(collider) {
    const radius = clampSettingValue(Number(collider && collider.radius), SETTINGS_RANGE_MIN);
    const rawLength = Number(collider && collider.length);
    const fallbackLength = radius * 2;
    const totalLength = Number.isFinite(rawLength)
      ? clampSettingValue(rawLength, fallbackLength)
      : clampSettingValue(fallbackLength);
    const span = Math.max(0, totalLength - radius * 2);
    const halfSpan = span / 2;
    const angle = Number.isFinite(collider.angle) ? collider.angle : 0;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const ax = collider.x - cos * halfSpan;
    const ay = collider.y - sin * halfSpan;
    const bx = collider.x + cos * halfSpan;
    const by = collider.y + sin * halfSpan;
    const reach = halfSpan + radius;
    return { radius, totalLength, span, halfSpan, angle, ax, ay, bx, by, reach };
  }

  function ensureCrescentMetrics(collider) {
    const cx = Number(collider && collider.x) || 0;
    const cy = Number(collider && collider.y) || 0;
    const radius = clampSettingValue(Number(collider && collider.radius), SETTINGS_RANGE_MIN);
    const rawInner = collider ? Number(collider.innerRadius) : NaN;
    let innerRadius = Number.isFinite(rawInner)
      ? clampSettingValue(rawInner, radius * 0.6)
      : clampSettingValue(radius * 0.6);
    innerRadius = Math.min(radius, innerRadius);
    const rawOffset = collider ? Number(collider.offset) : NaN;
    const fallbackOffset = radius > 0 ? (radius + innerRadius) / 2 : SETTINGS_RANGE_MIN;
    let offset = Number.isFinite(rawOffset)
      ? clampSettingValue(rawOffset, fallbackOffset)
      : clampSettingValue(fallbackOffset);
    const maxOffset = radius + innerRadius;
    offset = Math.min(maxOffset, Math.max(SETTINGS_RANGE_MIN, offset));
    const angle = Number.isFinite(collider && collider.angle) ? collider.angle : 0;
    if(collider){
      collider.radius = radius;
      collider.innerRadius = innerRadius;
      collider.offset = offset;
      collider.angle = angle;
    }
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const innerCx = cx + cos * offset;
    const innerCy = cy + sin * offset;
    return { cx, cy, radius, innerRadius, offset, angle, innerCx, innerCy };
  }

  function distancePointToSegment(px, py, ax, ay, bx, by) {
    const vx = bx - ax;
    const vy = by - ay;
    const lenSq = vx*vx + vy*vy;
    if(lenSq <= 1e-9){
      return Math.hypot(px - ax, py - ay);
    }
    const t = ((px - ax) * vx + (py - ay) * vy) / lenSq;
    const clamped = Math.max(0, Math.min(1, t));
    const closestX = ax + vx * clamped;
    const closestY = ay + vy * clamped;
    return Math.hypot(px - closestX, py - closestY);
  }

  function circleIntersectsCapsule(x, y, radius, collider) {
    const metrics = ensureCapsuleMetrics(collider);
    if(metrics.span <= 0){
      return Math.hypot(x - collider.x, y - collider.y) <= metrics.radius + radius;
    }
    const dist = distancePointToSegment(x, y, metrics.ax, metrics.ay, metrics.bx, metrics.by);
    return dist <= metrics.radius + radius;
  }

  function stepAlongAxis(start, delta, fixedCoord, radius, isX){
    let lo = 0;
    let hi = 1;
    let best = 0;
    for(let i=0;i<5;i++){
      const mid = (lo + hi) / 2;
      const candidate = start + delta * mid;
      const cx = isX ? candidate : fixedCoord;
      const cy = isX ? fixedCoord : candidate;
      if(circleCollides(cx, cy, radius)) hi = mid;
      else { best = mid; lo = mid; }
    }
    return start + delta * best;
  }

  function moveCircleWithCollision(x, y, moveX, moveY, radius){
    const targetX = x + moveX;
    const targetY = y + moveY;
    if(!hitboxActive()) return {x: targetX, y: targetY};
    if(!circleCollides(targetX, targetY, radius)) return {x: targetX, y: targetY};
    let newX = x;
    let newY = y;
    if(moveX !== 0){
      const candidateX = x + moveX;
      if(!circleCollides(candidateX, y, radius)) newX = candidateX;
      else newX = stepAlongAxis(x, moveX, y, radius, true);
    }
    if(moveY !== 0){
      const candidateY = y + moveY;
      if(!circleCollides(newX, candidateY, radius)) newY = candidateY;
      else newY = stepAlongAxis(y, moveY, newX, radius, false);
    }
    if(circleCollides(newX, newY, radius)) return {x, y};
    return {x: newX, y: newY};
  }

  function navGoalKey(goal, radius){
    return goal ? `${goal.x.toFixed(1)}|${goal.y.toFixed(1)}|${radius.toFixed(1)}` : '';
  }

  function pointToCell(x, y){
    const cx = Math.max(0, Math.min(Math.floor(x / NAV_CELL_SIZE), Math.ceil(mapState.width / NAV_CELL_SIZE) - 1));
    const cy = Math.max(0, Math.min(Math.floor(y / NAV_CELL_SIZE), Math.ceil(mapState.height / NAV_CELL_SIZE) - 1));
    return {cx, cy};
  }

  function cellCenter(cx, cy){
    const x = Math.max(0, Math.min(mapState.width - 1, (cx + 0.5) * NAV_CELL_SIZE));
    const y = Math.max(0, Math.min(mapState.height - 1, (cy + 0.5) * NAV_CELL_SIZE));
    return {x, y};
  }

  function isCellWalkable(cx, cy, cols, rows, radius){
    if(cx < 0 || cy < 0 || cx >= cols || cy >= rows) return false;
    const {x, y} = cellCenter(cx, cy);
    return !circleCollides(x, y, radius);
  }

  function findNearestWalkableCell(cx, cy, cols, rows, radius){
    const startCx = Math.max(0, Math.min(cols - 1, cx));
    const startCy = Math.max(0, Math.min(rows - 1, cy));
    if(isCellWalkable(startCx, startCy, cols, rows, radius)){
      return {cx: startCx, cy: startCy, adjusted: false};
    }
    const visited = new Uint8Array(cols * rows);
    const queue = [{cx: startCx, cy: startCy, dist: 0}];
    const neighborSteps = [
      [-1,  0], [1, 0], [0, -1], [0, 1],
      [-1, -1], [1, -1], [-1, 1], [1, 1]
    ];
    let head = 0;
    visited[startCy * cols + startCx] = 1;
    const MAX_SEARCH = 42;
    while(head < queue.length){
      const {cx: qx, cy: qy, dist} = queue[head++];
      if(dist >= MAX_SEARCH) continue;
      for(const [dx, dy] of neighborSteps){
        const nx = qx + dx;
        const ny = qy + dy;
        if(nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const idx = ny * cols + nx;
        if(visited[idx]) continue;
        visited[idx] = 1;
        if(isCellWalkable(nx, ny, cols, rows, radius)){
          return {cx: nx, cy: ny, adjusted: true};
        }
        queue.push({cx: nx, cy: ny, dist: dist + 1});
      }
    }
    return null;
  }

  function lineOfSight(ax, ay, bx, by, radius){
    const dist = Math.hypot(bx - ax, by - ay);
    if(dist === 0) return !circleCollides(ax, ay, radius);
    const steps = Math.max(1, Math.ceil(dist / Math.max(4, NAV_LINE_STEP)));
    for(let i=1;i<steps;i++){
      const t = i / steps;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      if(circleCollides(x, y, radius)) return false;
    }
    return !circleCollides(bx, by, radius);
  }

  function simplifyPath(points, radius){
    if(points.length <= 2) return points.slice();
    const result = [points[0]];
    for(let i=2;i<points.length;i++){
      const anchor = result[result.length - 1];
      const candidate = points[i];
      if(!lineOfSight(anchor.x, anchor.y, candidate.x, candidate.y, radius)){
        result.push(points[i-1]);
      }
    }
    result.push(points[points.length - 1]);
    return result;
  }

  function findPath(start, goal, radius){
    if(perfCounters && typeof perfCounters.pathfindCalls === 'number'){ perfCounters.pathfindCalls += 1; }
    if(!hitboxActive()) return null;
    const cols = Math.ceil(mapState.width / NAV_CELL_SIZE);
    const rows = Math.ceil(mapState.height / NAV_CELL_SIZE);
    let startCell = pointToCell(start.x, start.y);
    let goalCell = pointToCell(goal.x, goal.y);
    const startInfo = findNearestWalkableCell(startCell.cx, startCell.cy, cols, rows, radius);
    if(!startInfo) return null;
    startCell = {cx: startInfo.cx, cy: startInfo.cy};
    const goalInfo = findNearestWalkableCell(goalCell.cx, goalCell.cy, cols, rows, radius);
    if(!goalInfo) return null;
    goalCell = {cx: goalInfo.cx, cy: goalInfo.cy};
    const goalPoint = goalInfo.adjusted ? cellCenter(goalCell.cx, goalCell.cy) : {x: goal.x, y: goal.y};

    const total = cols * rows;
    const gScore = new Array(total).fill(Infinity);
    const fScore = new Array(total).fill(Infinity);
    const came = new Int32Array(total);
    came.fill(-1);
    const closed = new Uint8Array(total);

    function indexOf(cx, cy){ return cy * cols + cx; }
    function coordsOf(index){ return { cx: index % cols, cy: Math.floor(index / cols) }; }

    const startIdx = indexOf(startCell.cx, startCell.cy);
    const goalIdx = indexOf(goalCell.cx, goalCell.cy);
    const open = [startIdx];
    gScore[startIdx] = 0;
    fScore[startIdx] = Math.hypot(goalCell.cx - startCell.cx, goalCell.cy - startCell.cy);

    const neighborOffsets = [
      [-1,  0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
      [-1, -1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, 1, Math.SQRT2]
    ];

    let visitedNodes = 0;
    while(open.length){
      if(visitedNodes >= MAX_PATHFIND_NODES){
        return null;
      }
      let bestIndex = 0;
      for(let i=1;i<open.length;i++){
        if(fScore[open[i]] < fScore[open[bestIndex]]) bestIndex = i;
      }
      const current = open.splice(bestIndex, 1)[0];
      if(current === goalIdx) break;
      if(closed[current]) continue;
      closed[current] = 1;
      const {cx, cy} = coordsOf(current);

      for(const [dx, dy, cost] of neighborOffsets){
        if(perfCounters && typeof perfCounters.pathfindNodesVisited === 'number'){ perfCounters.pathfindNodesVisited += 1; }
        visitedNodes += 1;
        if(visitedNodes >= MAX_PATHFIND_NODES){
          return null;
        }
        const nx = cx + dx;
        const ny = cy + dy;
        if(!isCellWalkable(nx, ny, cols, rows, radius)) continue;
        if(dx !== 0 && dy !== 0){
          if(!isCellWalkable(cx + dx, cy, cols, rows, radius)) continue;
          if(!isCellWalkable(cx, cy + dy, cols, rows, radius)) continue;
        }
        const neighborIdx = indexOf(nx, ny);
        if(closed[neighborIdx]) continue;
        const tentative = gScore[current] + cost;
        if(tentative < gScore[neighborIdx]){
          gScore[neighborIdx] = tentative;
          const heuristic = Math.hypot(goalCell.cx - nx, goalCell.cy - ny);
          fScore[neighborIdx] = tentative + heuristic;
          came[neighborIdx] = current;
          if(!open.includes(neighborIdx)) open.push(neighborIdx);
        }
      }
    }

    if(came[goalIdx] === -1 && goalIdx !== startIdx) return null;
    const cells = [];
    let cur = goalIdx;
    while(cur !== -1 && cur !== startIdx){
      cells.push(cur);
      cur = came[cur];
    }
    cells.reverse();

    const rawPoints = [{x: start.x, y: start.y}];
    if(startInfo.adjusted){
      rawPoints.push(cellCenter(startCell.cx, startCell.cy));
    }
    for(const idx of cells){
      const {cx, cy} = coordsOf(idx);
      rawPoints.push(cellCenter(cx, cy));
    }
    rawPoints.push(goalPoint);

    const simplified = simplifyPath(rawPoints, radius);
    if(simplified.length <= 1) return [goalPoint];
    simplified.shift();
    return simplified;
  }

  return {
    hitboxPixelsReady,
    hitboxActive,
    circleCollides,
    collidersBlockCircle,
    colliderBlocksCircle,
    ensureCapsuleMetrics,
    ensureCrescentMetrics,
    distancePointToSegment,
    circleIntersectsCapsule,
    moveCircleWithCollision,
    navGoalKey,
    pointToCell,
    cellCenter,
    isCellWalkable,
    findNearestWalkableCell,
    lineOfSight,
    simplifyPath,
    findPath,
    NAV_CELL_SIZE,
    NAV_LINE_STEP
  };
}
