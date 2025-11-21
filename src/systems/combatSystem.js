export function createCombatSystem({
  cullingBarrageChannels,
  cullingBarrageProjectiles,
  projectiles,
  hitsplats,
  player,
  minions,
  minionRadius,
  getSpellOrigin,
  fireCullingBarrageShot,
  endCullingBarrageChannel,
  applyCullingBarrageHit,
  isEnemyMinionForPlayer
} = {}) {
  function updateCullingBarrageChannels(dt){
    for(let i = cullingBarrageChannels.length - 1; i >= 0; i--){
      const channel = cullingBarrageChannels[i];
      if(!channel || channel.ended){
        cullingBarrageChannels.splice(i, 1);
        continue;
      }
      const caster = channel.casterRef || player;
      const { x: originX, y: originY } = getSpellOrigin(caster);
      channel.elapsed = Math.max(0, Number(channel.elapsed) || 0) + dt;

      const interval = Math.max(0, Number(channel.shotInterval) || 0);
      const totalShots = Math.max(1, Number(channel.totalShots) || 1);
      while(channel.shotsFired < totalShots && channel.elapsed + 1e-6 >= channel.nextShotTime){
        fireCullingBarrageShot(channel, originX, originY);
        channel.shotsFired++;
        channel.nextShotTime += interval;
        if(interval <= 0){
          channel.nextShotTime = channel.elapsed + 0.0001;
        }
      }

      const controlTimers = [caster && caster.stunTimer, caster && caster.knockupTimer, caster && caster.silenceTimer, caster && caster.disarmTimer, caster && caster.polymorphTimer];
      const interrupted = controlTimers.some(value => Number(value) > 0);
      if(interrupted){
        endCullingBarrageChannel(channel, { reason: 'control' });
        continue;
      }

      const duration = Math.max(0, Number(channel.duration) || 0);
      if((duration > 0 && channel.elapsed >= duration) || channel.shotsFired >= totalShots){
        endCullingBarrageChannel(channel, { reason: 'complete' });
      }
    }
  }

  function updateCullingBarrageProjectiles(dt){
    for(let i = cullingBarrageProjectiles.length - 1; i >= 0; i--){
      const proj = cullingBarrageProjectiles[i];
      if(!proj){
        cullingBarrageProjectiles.splice(i, 1);
        continue;
      }
      const range = Math.max(0, Number(proj.range) || 0);
      const speed = Math.max(0, Number(proj.speed) || 0);
      if(range <= 0 && speed <= 0){
        cullingBarrageProjectiles.splice(i, 1);
        continue;
      }
      const prevTraveled = Math.max(0, Number(proj.traveled) || 0);
      const nextTraveled = speed > 0 ? prevTraveled + speed * dt : range;
      const clampedTravel = range > 0 ? Math.min(nextTraveled, range) : nextTraveled;
      const halfWidth = Math.max(0, (Number(proj.width) || 0) / 2);
      const effectiveRadius = halfWidth + minionRadius;
      const effectiveSq = effectiveRadius * effectiveRadius;
      let removed = false;

      if(proj.canPierce){
        const hits = [];
        for(const m of minions){
          if(!m || !isEnemyMinionForPlayer(m)) continue;
          if(m.hp <= 0 || m.portalizing > 0) continue;
          if(proj.hitTargets && proj.hitTargets.has(m)) continue;
          const relX = m.x - proj.startX;
          const relY = m.y - proj.startY;
          const along = relX * proj.dirX + relY * proj.dirY;
          if(along < prevTraveled - minionRadius) continue;
          if(along > clampedTravel + minionRadius) continue;
          if(range > 0 && (along < -minionRadius || along > range + minionRadius)) continue;
          const closestX = proj.startX + proj.dirX * along;
          const closestY = proj.startY + proj.dirY * along;
          const offX = m.x - closestX;
          const offY = m.y - closestY;
          if(offX * offX + offY * offY <= effectiveSq){
            hits.push({ target: m, along });
          }
        }
        if(hits.length){
          hits.sort((a, b) => a.along - b.along);
          if(!proj.hitTargets) proj.hitTargets = new Set();
          for(const hit of hits){
            if(proj.hitTargets.has(hit.target)) continue;
            applyCullingBarrageHit(proj, hit.target);
            proj.hitTargets.add(hit.target);
          }
        }
      } else {
        let hitTarget = null;
        let hitAlong = Infinity;
        for(const m of minions){
          if(!m || !isEnemyMinionForPlayer(m)) continue;
          if(m.hp <= 0 || m.portalizing > 0) continue;
          const relX = m.x - proj.startX;
          const relY = m.y - proj.startY;
          const along = relX * proj.dirX + relY * proj.dirY;
          if(along < prevTraveled - minionRadius) continue;
          if(along > clampedTravel + minionRadius) continue;
          if(range > 0 && (along < -minionRadius || along > range + minionRadius)) continue;
          const closestX = proj.startX + proj.dirX * along;
          const closestY = proj.startY + proj.dirY * along;
          const offX = m.x - closestX;
          const offY = m.y - closestY;
          if(offX * offX + offY * offY <= effectiveSq && along < hitAlong){
            hitAlong = along;
            hitTarget = m;
          }
        }
        if(hitTarget){
          applyCullingBarrageHit(proj, hitTarget);
          cullingBarrageProjectiles.splice(i, 1);
          removed = true;
        }
      }

      if(removed) continue;

      proj.traveled = clampedTravel;
      proj.x = proj.startX + proj.dirX * clampedTravel;
      proj.y = proj.startY + proj.dirY * clampedTravel;
      proj.age = (Number(proj.age) || 0) + dt;

      if(range > 0 && clampedTravel >= range - 0.001){
        cullingBarrageProjectiles.splice(i, 1);
        continue;
      }

      if(range <= 0 && proj.age >= 0.6){
        cullingBarrageProjectiles.splice(i, 1);
      }
    }
  }

  function updateProjectiles(dt){
    for(let i = projectiles.length - 1; i >= 0; i--){
      const p = projectiles[i];
      if(p.targetRef){
        const target = p.targetRef;
        const targetAlive = target === player
          || target.isPracticeDummy
          || (typeof target.hp === 'number' && target.hp > 0);
        if(targetAlive){
          p.targetX = target.x;
          p.targetY = target.y;
        }
      }
      const duration = Math.max(0.001, p.duration);
      p.progress += dt / duration;
      if(p.progress >= 1){
        const impact = typeof p.onImpact === 'function' ? p.onImpact : null;
        projectiles.splice(i, 1);
        if(impact){
          try {
            impact();
          } catch (err){
            console.error('Monster projectile impact failed', err);
          }
        }
      }
    }
  }

  function updateHitSplats(dt){
    for(let i = hitsplats.length - 1; i >= 0; i--){
      const h = hitsplats[i];
      h.age += dt;
      if(h.age >= (h.lifetime || 0.001)){
        hitsplats.splice(i, 1);
      }
    }
  }

  return {
    updateCullingBarrageChannels,
    updateCullingBarrageProjectiles,
    updateProjectiles,
    updateHitSplats
  };
}
