export function createPhysicsSystem({
  minions,
  minionDiameter,
  minionRadius,
  mapState,
  player,
  circleCollides,
  moveCircleWithCollision
} = {}) {
  function buildMinionGrid(){
    const buckets = new Map();
    const cellSize = Math.max(1, minionDiameter * 2);
    function cellKey(cx, cy){
      return `${cx},${cy}`;
    }
    for(let i = 0; i < minions.length; i++){
      const m = minions[i];
      if(!m) continue;
      const cx = Math.floor(m.x / cellSize);
      const cy = Math.floor(m.y / cellSize);
      const key = cellKey(cx, cy);
      if(!buckets.has(key)){
        buckets.set(key, []);
      }
      buckets.get(key).push(i);
    }
    return {
      cellSize,
      buckets,
      cellKey
    };
  }

  function resolveOverlaps(iterations = 2){
    const n = minions.length;
    if(n<=1) return;
    const grid = buildMinionGrid();
    for(let it=0; it<iterations; it++){
      for(let i=0;i<n;i++){
        const a = minions[i];
        if(!a) continue;
        const baseCx = Math.floor(a.x / grid.cellSize);
        const baseCy = Math.floor(a.y / grid.cellSize);
        for(let j=i+1;j<n;j++){
          const b = minions[j];
          if(!b) continue;

          // Bucket cull: only consider neighbors in adjacent cells
          const bx = Math.floor(b.x / grid.cellSize);
          const by = Math.floor(b.y / grid.cellSize);
          if(Math.abs(baseCx - bx) > 1 || Math.abs(baseCy - by) > 1){
            continue;
          }

          // Relax same-side separation if either is in intake zone (lets them stack toward portal)
          if(a.side===b.side && (a.inPortalZone || b.inPortalZone)) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          let d = Math.hypot(dx,dy);
          const minD = minionDiameter;

          if(d < minD){
            let nx, ny;
            if(d === 0){
              const angle = Math.random()*Math.PI*2;
              nx = Math.cos(angle); ny = Math.sin(angle);
              d = 0.0001;
            } else {
              nx = dx / d; ny = dy / d;
            }
            const push = (minD - d) * 0.5;
            const nextAx = a.x - nx * push;
            const nextAy = a.y - ny * push;
            if(!circleCollides(nextAx, nextAy, minionRadius)){
              a.x = nextAx;
              a.y = nextAy;
            }
            const nextBx = b.x + nx * push;
            const nextBy = b.y + ny * push;
            if(!circleCollides(nextBx, nextBy, minionRadius)){
              b.x = nextBx;
              b.y = nextBy;
            }

            a.x = Math.max(minionRadius, Math.min(mapState.width - minionRadius, a.x));
            a.y = Math.max(minionRadius, Math.min(mapState.height - minionRadius, a.y));
            b.x = Math.max(minionRadius, Math.min(mapState.width - minionRadius, b.x));
            b.y = Math.max(minionRadius, Math.min(mapState.height - minionRadius, b.y));
          }
        }
      }
    }
  }

  function resolvePlayerMinionSeparation(iterations = 2){
    if(!minions.length || player.r <= 0) return;
    const minDistBase = minionRadius + player.r;
    if(minDistBase <= 0) return;
    for(let it=0; it<iterations; it++){
      let adjusted = false;
      for(const m of minions){
        if(!m || m.hp <= 0) continue;
        const dx = m.x - player.x;
        const dy = m.y - player.y;
        let d = Math.hypot(dx, dy);
        const minDist = minionRadius + player.r;
        if(d < minDist){
          let nx, ny;
          if(d === 0){
            const angle = Math.random() * Math.PI * 2;
            nx = Math.cos(angle);
            ny = Math.sin(angle);
            d = 0.0001;
          } else {
            nx = dx / d;
            ny = dy / d;
          }
          let overlap = minDist - d;
          if(overlap <= 0) continue;
          let playerShare = overlap * 0.5;
          if(playerShare < 0) playerShare = 0;
          const px0 = player.x;
          const py0 = player.y;
          let playerMove = 0;
          if(playerShare > 0){
            const playerResult = moveCircleWithCollision(px0, py0, -nx * playerShare, -ny * playerShare, player.r);
            player.x = playerResult.x;
            player.y = playerResult.y;
            const movedX = player.x - px0;
            const movedY = player.y - py0;
            playerMove = -(movedX * nx + movedY * ny);
            if(playerMove < 0) playerMove = 0;
          }
          let remaining = overlap - playerMove;
          if(remaining > 0){
            const mx0 = m.x;
            const my0 = m.y;
            const minionResult = moveCircleWithCollision(mx0, my0, nx * remaining, ny * remaining, minionRadius);
            m.x = minionResult.x;
            m.y = minionResult.y;
            const movedX = m.x - mx0;
            const movedY = m.y - my0;
            const minionMove = movedX * nx + movedY * ny;
            remaining -= minionMove;
            if(remaining > 0){
              const px1 = player.x;
              const py1 = player.y;
              const retry = moveCircleWithCollision(px1, py1, -nx * remaining, -ny * remaining, player.r);
              player.x = retry.x;
              player.y = retry.y;
            }
          }
          player.x = Math.max(player.r, Math.min(mapState.width - player.r, player.x));
          player.y = Math.max(player.r, Math.min(mapState.height - player.r, player.y));
          m.x = Math.max(minionRadius, Math.min(mapState.width - minionRadius, m.x));
          m.y = Math.max(minionRadius, Math.min(mapState.height - minionRadius, m.y));
          adjusted = true;
        }
      }
      if(!adjusted) break;
    }
  }

  return { resolveOverlaps, resolvePlayerMinionSeparation };
}
