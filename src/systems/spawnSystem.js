export function createSpawnSystem({
  blueSpawns,
  redSpawns,
  pendingSpawns,
  waveState,
  portalState,
  fanSlotOffset,
  laneFanSpacing,
  lanePointAtDistance,
  updateMinionLaneFrame,
  minions,
  minionDiameter,
  minionRadius,
  mapState,
  defaultSpawnPosition,
  clampSettingValue
} = {}) {
  function getPath(side){
    const s = side==='blue' ? blueSpawns : redSpawns;
    const e = side==='blue' ? redSpawns : blueSpawns; // opponent spawn acts as endpoint (portal)
    if(s.length && e.length) return {from:s[0], to:e[0]};
    return null;
  }

  function statsForWave(w){
    // Linear scaling: base × (1 + portalState.scalePct% × (w-1))
    const mult = 1 + (portalState.scalePct/100) * Math.max(0, w-1);
    const hp = Math.max(1, Math.round(portalState.baseMinionHP * mult));
    const dmg = Math.max(1, Math.round(portalState.baseMinionDMG * mult));
    return {hp, dmg};
  }

  function enqueueMinionSpawn(side, path, hp, dmg, spawnAt, slotIndex = 0, laneIndex = 0){
    const job = {
      side,
      at: spawnAt,
      from: { x: path && path.from ? path.from.x : 0, y: path && path.from ? path.from.y : 0 },
      to: { x: path && path.to ? path.to.x : 0, y: path && path.to ? path.to.y : 0 },
      hp,
      dmg,
      slotIndex,
      laneIndex,
      laneLabel: path && path.label ? path.label : String((laneIndex || 0) + 1),
      path: path || null,
      teamId: path && path.teamId ? path.teamId : side,
      teamColor: path && path.teamColor ? path.teamColor : null
    };

    const insertAt = pendingSpawns.findIndex(existing => job.at < existing.at);
    if(insertAt === -1){ pendingSpawns.push(job); }
    else { pendingSpawns.splice(insertAt, 0, job); }
  }

  function blendAngles(from, to, weight){
    const t = Math.max(0, Math.min(1, weight));
    const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from));
    return from + diff * t;
  }

  function spawnFromQueue(job){
    const lanePath = job.path || null;
    const slotIndex = job.slotIndex || 0;
    const fanOffset = fanSlotOffset(slotIndex) * laneFanSpacing;
    const laneColor = job.teamColor || null;
    const laneTeamId = job.teamId || job.side;
    const minionSide = laneTeamId || job.side;

    if(lanePath){
      const laneLen = lanePath.totalLength || Math.hypot(job.to.x - job.from.x, job.to.y - job.from.y) || 1;
      const midSample = lanePointAtDistance(lanePath, laneLen * 0.5);
      const firstSegment = lanePath.segments && lanePath.segments[0] ? lanePath.segments[0] : null;
      const laneDir = firstSegment ? { x: firstSegment.dirX, y: firstSegment.dirY }
        : (()=>{
            const dx = job.to.x - job.from.x;
            const dy = job.to.y - job.from.y;
            const len = Math.hypot(dx, dy) || 1;
            return { x: dx / len, y: dy / len };
          })();
      const laneNormal = firstSegment ? { x: firstSegment.normalX, y: firstSegment.normalY }
        : { x: -laneDir.y, y: laneDir.x };
      const laneFacing = Math.atan2(laneDir.y, laneDir.x);
      const neutralProj = midSample ? midSample.distance : laneLen * 0.5;
      const neutralPoint = midSample ? { x: midSample.point.x, y: midSample.point.y }
        : {
            x: job.from.x + laneDir.x * neutralProj,
            y: job.from.y + laneDir.y * neutralProj
          };
      const offsideLimit = Math.min(laneLen, neutralProj);
      const minion = {
        side: minionSide,
        teamId: laneTeamId,
        teamColor: laneColor,
        x: job.from.x,
        y: job.from.y,
        to: { x: job.to.x, y: job.to.y },
        spawn: { x: job.from.x, y: job.from.y },
        neutralPoint,
        neutralProj,
        laneDir,
        laneFacing,
        laneNormal,
        fanOffset,
        laneLength: laneLen,
        offsideLimit,
        hp: job.hp,
        maxHp: job.hp,
        dmg: job.dmg,
        cd: 0,
        slowPct: 0,
        slowTimer: 0,
        stunTimer: 0,
        beingPulledBy: null,
        portalizing: 0,
        inPortalZone: false,
        scored: false,
        facing: laneFacing,
        nav: null,
        lanePath,
        laneIndex: Number.isFinite(job.laneIndex) ? job.laneIndex : 0,
        laneLabel: job.laneLabel || String((job.laneIndex || 0) + 1),
        pathDistance: 0,
        laneProjection: null,
        laneProgress: 0,
        offLaneDistance: 0
      };
      minions.push(minion);
      updateMinionLaneFrame(minion);
      return;
    }

    const laneDx = job.to.x - job.from.x;
    const laneDy = job.to.y - job.from.y;
    const laneLen = Math.hypot(laneDx, laneDy) || 1;
    const laneDir = { x: laneDx / laneLen, y: laneDy / laneLen };
    const neutralDistance = laneLen * 0.5;
    const neutralPoint = {
      x: job.from.x + laneDir.x * neutralDistance,
      y: job.from.y + laneDir.y * neutralDistance
    };
    const laneFacing = Math.atan2(laneDir.y, laneDir.x);
    const laneNormal = { x: -laneDir.y, y: laneDir.x };
    const offsideLimit = Math.min(laneLen, neutralDistance);
    minions.push({
      side: minionSide,
      teamId: laneTeamId,
      teamColor: laneColor,
      x: job.from.x,
      y: job.from.y,
      to: {x: job.to.x, y: job.to.y},
      spawn: {x: job.from.x, y: job.from.y},
      neutralPoint,
      neutralProj: neutralDistance,
      laneDir,
      laneFacing,
      laneNormal,
      fanOffset,
      laneLength: laneLen,
      offsideLimit,
      hp: job.hp,
      maxHp: job.hp,
      dmg: job.dmg,
      cd: 0,
      slowPct: 0,
      slowTimer: 0,
      stunTimer: 0,
      beingPulledBy: null,
      portalizing: 0,
      inPortalZone: false,
      scored: false,
      facing: laneFacing,
      nav: null,
      lanePath: null,
      laneIndex: Number.isFinite(job.laneIndex) ? job.laneIndex : 0,
      laneLabel: job.laneLabel || String((job.laneIndex || 0) + 1),
      pathDistance: 0,
      laneProjection: null,
      laneProgress: 0,
      offLaneDistance: 0
    });
  }

  function distributeMinions(total, lanes){
    const safeLanes = Math.max(1, Math.floor(Number(lanes) || 0));
    const counts = new Array(safeLanes).fill(0);
    const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
    if(safeTotal === 0){
      return counts;
    }
    const base = Math.floor(safeTotal / safeLanes);
    const remainder = safeTotal % safeLanes;
    for(let i=0; i<safeLanes; i++){
      counts[i] = base + (i < remainder ? 1 : 0);
    }
    return counts;
  }

  function spawnWave(side, waveTime, lanePaths){
    const paths = Array.isArray(lanePaths) ? lanePaths.filter(Boolean) : [];
    const {hp, dmg} = statsForWave(waveState.waveNumber);
    if(paths.length){
      const counts = distributeMinions(waveState.waveCount, paths.length);
      const lanes = paths.map((path, laneIndex) => ({
        path,
        laneIndex,
        count: counts[laneIndex] || 0,
        emitted: 0
      }));
      const total = lanes.reduce((sum, lane) => sum + lane.count, 0);
      let spawnNumber = 0;
      let remaining = total;
      while(remaining > 0){
        let progressed = false;
        for(const lane of lanes){
          if(lane.emitted >= lane.count){
            continue;
          }
          const spawnAt = waveTime + spawnNumber * waveState.spawnSpacingMs;
          enqueueMinionSpawn(side, lane.path, hp, dmg, spawnAt, lane.emitted, lane.laneIndex);
          lane.emitted += 1;
          spawnNumber += 1;
          remaining -= 1;
          progressed = true;
          if(remaining <= 0){
            break;
          }
        }
        if(!progressed){
          break;
        }
      }
      return;
    }
    const fallback = getPath(side);
    if(!fallback){
      return;
    }
    for(let i=0;i<waveState.waveCount;i++){
      const spawnAt = waveTime + i * waveState.spawnSpacingMs;
      enqueueMinionSpawn(side, fallback, hp, dmg, spawnAt, i, 0);
    }
  }

  return {
    getPath,
    statsForWave,
    enqueueMinionSpawn,
    spawnFromQueue,
    distributeMinions,
    spawnWave,
    blendAngles
  };
}
