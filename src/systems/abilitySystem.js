export function createAbilitySystem({
  abilityDefinitions,
  abilityTunables,
  SPELL_SCALE_MIN,
  SPELL_SCALE_MAX,
  renderAbilityBar,
  isAbilityRepoOpen,
  updateAbilityRepoSubtitle,
  renderSpellList,
  spellSpeedScaleInput,
  spellSizeScaleInput,
  abilityAllowedCastTypes,
  defaultAbilityCastType,
  normalizeCastType
} = {}) {
  Object.values(abilityDefinitions).forEach(ability => {
    if(!ability) return;
    ability.castType = normalizeAbilityCastType(ability, ability.castType);
  });

  function listAbilities(){ return Object.values(abilityDefinitions); }
  function getAbilityDefinition(id){ return abilityDefinitions[id] || null; }
  function abilityField(ability, key){
    if(!ability || !Array.isArray(ability.fields)) return null;
    return ability.fields.find(field => field.key === key) || null;
  }
  function isSpellSpeedField(field){
    if(!field) return false;
    if(field.scale === 'speed') return true;
    if(field.scale === 'size') return false;
    const key = String(field.key || '');
    if(/speed/i.test(key)) return true;
    const unit = String(field.unit || '');
    if(/px\s*\/\s*s/i.test(unit)) return true;
    return false;
  }
  function isSpellSizeField(field){
    if(!field) return false;
    if(field.scale === 'size') return true;
    if(field.scale === 'speed') return false;
    const key = String(field.key || '');
    if(/(width|length|distance|range|radius|diameter|size|height)/i.test(key)) return true;
    const unit = String(field.unit || '');
    if(/px/i.test(unit) && !/px\s*\/\s*s/i.test(unit)) return true;
    return false;
  }
  function abilityFieldValue(ability, key, options = {}){
    const field = abilityField(ability, key);
    if(!field) return undefined;
    if(key === 'cooldownMs' || key === 'cancelCooldownMs'){
      return 0;
    }
    let value = field.value;
    if(!options || !options.skipScaling){
      if(isSpellSpeedField(field)){
        value = value * abilityTunables.spellSpeedScale;
      } else if(isSpellSizeField(field)){
        value = value * abilityTunables.spellSizeScale;
      }
    }
    return value;
  }
  function clampFieldValue(field, raw){
    if(!field) return 0;
    let value = parseFloat(raw);
    if(!Number.isFinite(value)) value = field.min;
    value = Math.max(field.min, Math.min(field.max, value));
    const step = Number(field.step || 1);
    if(step > 0){
      value = Math.round(value / step) * step;
      const decimals = step >= 1 ? 0 : (String(step).split('.')[1] || '').length;
      if(decimals > 0) value = Number(value.toFixed(decimals));
      value = Math.max(field.min, Math.min(field.max, value));
    }
    return value;
  }
  function abilitySummary(ability){
    if(!ability) return '';
    const damage = abilityFieldValue(ability, 'damage');
    const baseDamage = abilityFieldValue(ability, 'baseDamage');
    const damageScalePct = abilityFieldValue(ability, 'damageScalePct');
    const chillDurationMs = abilityFieldValue(ability, 'chillDurationMs', { skipScaling: true });
    const chillDamageMultiplier = abilityFieldValue(ability, 'chillDamageMultiplier', { skipScaling: true });
    const slow = abilityFieldValue(ability, 'slowPct');
    const slowDuration = abilityFieldValue(ability, 'slowDurationMs');
    const slowMinRange = abilityFieldValue(ability, 'slowMinRangePx');
    const length = abilityFieldValue(ability, 'beamLength');
    const coneDistance = abilityFieldValue(ability, 'laserDistance');
    const grabRange = abilityFieldValue(ability, 'grabRange');
    const blinkDistance = abilityFieldValue(ability, 'blinkDistance');
    const width = abilityFieldValue(ability, 'beamWidth');
    const coneWidth = abilityFieldValue(ability, 'laserWidth');
    const grabCenterWidth = abilityFieldValue(ability, 'grabWidthCenter');
    const grabEdgeWidth = abilityFieldValue(ability, 'grabWidthEdge');
    const projectileWidth = abilityFieldValue(ability, 'laserProjectileWidth');
    const speed = abilityFieldValue(ability, 'laserSpeed');
    const grabSpeed = abilityFieldValue(ability, 'grabSpeed');
    const count = abilityFieldValue(ability, 'laserCount');
    const barrageChannel = abilityFieldValue(ability, 'channelDurationMs');
    const barrageInterval = abilityFieldValue(ability, 'shotIntervalMs');
    const barrageRange = abilityFieldValue(ability, 'projectileRangePx');
    const barrageWidth = abilityFieldValue(ability, 'projectileWidthPx');
    const barrageSpeed = abilityFieldValue(ability, 'projectileSpeedPxS');
    const barrageDamage = abilityFieldValue(ability, 'damagePerShot');
    const plasmaDamageFlat = abilityFieldValue(ability, 'damage_flat');
    const plasmaRange = abilityFieldValue(ability, 'projectile_range_px');
    const plasmaWidth = abilityFieldValue(ability, 'projectile_width_px');
    const plasmaSpeed = abilityFieldValue(ability, 'projectile_speed_px_per_ms');
    const plasmaSlowPct = abilityFieldValue(ability, 'slow_percent');
    const plasmaSlowDuration = abilityFieldValue(ability, 'slow_duration_ms');
    const plasmaSplitAngle = abilityFieldValue(ability, 'split_angle_deg');
    const plasmaRecastWindow = abilityFieldValue(ability, 'recast_window_ms');
    const plasmaSplitTriggerRaw = abilityFieldValue(ability, 'split_trigger', { skipScaling: true });
    const chargeMinMs = abilityFieldValue(ability, 'chargeMinMs');
    const chargeMaxMs = abilityFieldValue(ability, 'chargeMaxMs');
    const chargeRangeMin = abilityFieldValue(ability, 'rangeMinPx');
    const chargeRangeMax = abilityFieldValue(ability, 'rangeMaxPx');
    const chargeDamageMin = abilityFieldValue(ability, 'damageMin');
    const chargeDamageMax = abilityFieldValue(ability, 'damageMax');
    const chargeWidth = abilityFieldValue(ability, 'widthPx');
    const chargeProjectileSpeed = abilityFieldValue(ability, 'projectileSpeedPxPerMs');
    const chargeMoveSlow = abilityFieldValue(ability, 'movementSlowPct');
    const cooldown = abilityFieldValue(ability, 'cooldownMs');
    const castTime = abilityFieldValue(ability, 'castTimeMs');
    const damageReductionPct = abilityFieldValue(ability, 'damageReductionPct');
    const damageReductionDuration = abilityFieldValue(ability, 'damageReductionDurationMs');
    const stunDuration = abilityFieldValue(ability, 'stunDurationMs');
    const pullDistance = abilityFieldValue(ability, 'pullDistance');
    const postHitLockout = abilityFieldValue(ability, 'postHitLockoutMs');
    const impactDamage = abilityFieldValue(ability, 'impactDamage');
    const fissureDamage = abilityFieldValue(ability, 'fissureDamage');
    const impactRadius = abilityFieldValue(ability, 'impactRadius');
    const fissureLength = abilityFieldValue(ability, 'fissureLength');
    const fissureWidth = abilityFieldValue(ability, 'fissureWidth');
    const fissureSpeed = abilityFieldValue(ability, 'fissureSpeed');
    const iceFieldDuration = abilityFieldValue(ability, 'iceFieldDurationMs');
    const iceFieldSlowPct = abilityFieldValue(ability, 'iceFieldSlowPct');
    const dashDistance = abilityFieldValue(ability, 'dashDistancePx');
    const snapbackDelay = abilityFieldValue(ability, 'returnDelayMs');
    const snapbackSpeed = abilityFieldValue(ability, 'returnSpeedPxS');
    const snapbackWidth = abilityFieldValue(ability, 'phantomWidthPx');
    const snapbackRadius = abilityFieldValue(ability, 'impactRadiusPx');
    const twinFirstRange = abilityFieldValue(ability, 'firstDashRangePx');
    const twinSecondRange = abilityFieldValue(ability, 'secondDashRangePx');
    const twinDashWidth = abilityFieldValue(ability, 'dashWidthPx');
    const twinOvershoot = abilityFieldValue(ability, 'minimumOvershootPx');
    const twinFirstDamage = abilityFieldValue(ability, 'firstDamage');
    const twinSecondDamage = abilityFieldValue(ability, 'secondDamage');
    const sweepDamage = abilityFieldValue(ability, 'sweepDamage');
    const slamDamage = abilityFieldValue(ability, 'slamDamage');
    const sweepRange = abilityFieldValue(ability, 'sweepRangePx');
    const slamRange = abilityFieldValue(ability, 'slamRangePx');
    const lashRange = abilityFieldValue(ability, 'lashRange');
    const lashWidthStart = abilityFieldValue(ability, 'lashWidthStart');
    const lashWidthEnd = abilityFieldValue(ability, 'lashWidthEnd');
    const tetherDurationMs = abilityFieldValue(ability, 'tetherDurationMs', { skipScaling: true });
    const followupRangeBonus = abilityFieldValue(ability, 'followupRangeBonus');
    const linkRootMs = abilityFieldValue(ability, 'rootDurationMs', { skipScaling: true });
    const epicenterRadius = abilityFieldValue(ability, 'innerRadiusPx');
    const outerDamagePct = abilityFieldValue(ability, 'outerDamagePct');
    const walkerCount = abilityFieldValue(ability, 'walkerCount');
    const maidenHp = abilityFieldValue(ability, 'maidenHp');
    const maidenDamage = abilityFieldValue(ability, 'maidenDamage');
    const walkerHp = abilityFieldValue(ability, 'walkerHp');
    const walkerDamage = abilityFieldValue(ability, 'walkerDamage');
    const leashRange = abilityFieldValue(ability, 'leashRangePx');
    const summonRange = abilityFieldValue(ability, 'summonRangePx');
    const releaseDelayMs = abilityFieldValue(ability, 'releaseDelayMs');
    const dashCharges = abilityFieldValue(ability, 'maxDashes');
    const boltSeekRadius = abilityFieldValue(ability, 'boltSeekRadiusPx');
    const boltSpeed = abilityFieldValue(ability, 'boltSpeedPxS');
    const boltCount = abilityFieldValue(ability, 'boltCount');
    const recastWindowMs = abilityFieldValue(ability, 'recastWindowMs', { skipScaling: true });
    const recastLockoutMs = abilityFieldValue(ability, 'recastLockoutMs', { skipScaling: true });
    const coverRange = abilityFieldValue(ability, 'nearTerrainRangePx');
    const camoGraceMs = abilityFieldValue(ability, 'lingerDurationMs');
    const detectionRadius = abilityFieldValue(ability, 'detectionRadiusPx');
    const trailRange = abilityFieldValue(ability, 'trailRangePx');
    const attackSpeedPct = abilityFieldValue(ability, 'attackSpeedPct');
    const moveSpeedStartPct = abilityFieldValue(ability, 'moveSpeedStartPct');
    const moveSpeedEndPct = abilityFieldValue(ability, 'moveSpeedEndPct');
    const durationMs = abilityFieldValue(ability, 'durationMs');
    const ghostDurationMs = abilityFieldValue(ability, 'ghostDurationMs');
    const bonusMoveSpeed = abilityFieldValue(ability, 'bonusMoveSpeed');
    const recastDelayMs = abilityFieldValue(ability, 'recastDelayMs', { skipScaling: true });
    const parts = [];
    if(Number.isFinite(damage)) parts.push(`Damage ${damage}`);
    if(Number.isFinite(twinFirstDamage) && twinFirstDamage > 0) parts.push(`Dash1 ${Math.round(twinFirstDamage)}`);
    if(Number.isFinite(twinSecondDamage) && twinSecondDamage > 0) parts.push(`Dash2 ${Math.round(twinSecondDamage)}`);
    if(Number.isFinite(sweepDamage) && sweepDamage > 0) parts.push(`Sweep ${Math.round(sweepDamage)}`);
    if(Number.isFinite(slamDamage) && slamDamage > 0) parts.push(`Crush ${Math.round(slamDamage)}`);
    if(Number.isFinite(chargeDamageMin) || Number.isFinite(chargeDamageMax)){
      const minDmg = Number.isFinite(chargeDamageMin) ? Math.round(chargeDamageMin) : null;
      const maxDmg = Number.isFinite(chargeDamageMax) ? Math.round(chargeDamageMax) : null;
      if(minDmg !== null && maxDmg !== null){
        if(minDmg === maxDmg){
          parts.push(`Damage ${minDmg}`);
        } else {
          parts.push(`Damage ${minDmg}-${maxDmg}`);
        }
      } else if(minDmg !== null){
        parts.push(`Damage ${minDmg}`);
      } else if(maxDmg !== null){
        parts.push(`Damage up to ${maxDmg}`);
      }
    }
    if(Number.isFinite(chargeWidth)) parts.push(`Width ${Math.round(chargeWidth)}px`);
    if(Number.isFinite(chargeProjectileSpeed) && chargeProjectileSpeed > 0) parts.push(`${Math.round(chargeProjectileSpeed)} px/s`);
    if(Number.isFinite(chargeMoveSlow) && chargeMoveSlow > 0) parts.push(`${Math.round(chargeMoveSlow)}% slow (self)`);
    if(Number.isFinite(baseDamage) && baseDamage > 0) parts.push(`Base ${baseDamage}`);
    if(Number.isFinite(damageScalePct) && damageScalePct > 0) parts.push(`${damageScalePct}% scale`);
    if(Number.isFinite(chillDurationMs) && chillDurationMs > 0){
      const chillSeconds = chillDurationMs / 1000;
      const chillText = chillSeconds >= 10 ? Math.round(chillSeconds) : Number(chillSeconds.toFixed(1));
      parts.push(`Chill ${chillText}s`);
    }
    if(Number.isFinite(chillDamageMultiplier) && chillDamageMultiplier > 1){
      parts.push(`x${chillDamageMultiplier} vs chilled`);
    }
    if(Number.isFinite(slow) && slow > 0) parts.push(`Slow ${slow}%`);
    if(Number.isFinite(slowDuration) && slowDuration > 0) parts.push(`Slow ${slowDuration}ms`);
    if(Number.isFinite(slowMinRange) && slowMinRange > 0 && Number.isFinite(slow) && slow > 0){
      parts.push(`Slow past ${Math.round(slowMinRange)}px`);
    }
    if(Number.isFinite(damageReductionPct) && damageReductionPct > 0){
      if(Number.isFinite(damageReductionDuration) && damageReductionDuration > 0){
        const seconds = damageReductionDuration / 1000;
        const secondsText = seconds >= 10 ? Math.round(seconds) : Number(seconds.toFixed(1));
        parts.push(`Reduce dmg ${Math.round(damageReductionPct)}% for ${secondsText}s`);
      } else {
        parts.push(`Reduce dmg ${Math.round(damageReductionPct)}%`);
      }
    }
    if(Number.isFinite(length) && length > 0) parts.push(`Length ${length}px`);
    if(Number.isFinite(coneDistance) && coneDistance > 0) parts.push(`Range ${coneDistance}px`);
    if(Number.isFinite(grabRange) && grabRange > 0) parts.push(`Range ${Math.round(grabRange)}px`);
    if(Number.isFinite(sweepRange) && sweepRange > 0) parts.push(`Range ${Math.round(sweepRange)}px`);
    if(Number.isFinite(slamRange) && slamRange > 0 && (!Number.isFinite(sweepRange) || Math.round(slamRange) !== Math.round(sweepRange))){
      parts.push(`Follow-up ${Math.round(slamRange)}px`);
    }
    if(Number.isFinite(dashDistance) && dashDistance > 0) parts.push(`Dash ${Math.round(dashDistance)}px`);
    if(Number.isFinite(twinFirstRange) && twinFirstRange > 0) parts.push(`Dash ${Math.round(twinFirstRange)}px`);
    if(Number.isFinite(twinSecondRange) && twinSecondRange > 0 && (!Number.isFinite(twinFirstRange) || Math.round(twinSecondRange) !== Math.round(twinFirstRange))){
      parts.push(`Recast ${Math.round(twinSecondRange)}px`);
    }
    if(Number.isFinite(dashCharges) && dashCharges > 1) parts.push(`${Math.round(dashCharges)} charges`);
    if(Number.isFinite(bonusMoveSpeed) && bonusMoveSpeed > 0) parts.push(`+${Math.round(bonusMoveSpeed)}px/s`);
    if(Number.isFinite(attackSpeedPct) && attackSpeedPct > 0){
      parts.push(`Attack speed +${Math.round(attackSpeedPct)}%`);
    }
    if(Number.isFinite(moveSpeedStartPct) && moveSpeedStartPct > 0){
      const endPct = Number.isFinite(moveSpeedEndPct) ? moveSpeedEndPct : moveSpeedStartPct;
      const movementText = Math.round(moveSpeedStartPct) === Math.round(endPct)
        ? `${Math.round(moveSpeedStartPct)}%`
        : `${Math.round(moveSpeedStartPct)}%→${Math.round(endPct)}%`;
      const durationText = Number.isFinite(durationMs) && durationMs > 0 ? ` over ${Math.round(durationMs)}ms` : '';
      parts.push(`Move speed ${movementText}${durationText}`);
    }
    if(Number.isFinite(ghostDurationMs) && ghostDurationMs > 0){
      parts.push(`Ghosted ${Math.round(ghostDurationMs)}ms`);
    }
    if(Number.isFinite(coverRange) && coverRange > 0) parts.push(`Cover ${Math.round(coverRange)}px`);
    if(Number.isFinite(camoGraceMs) && camoGraceMs > 0) parts.push(`Away ${Math.round(camoGraceMs)}ms`);
    if(Number.isFinite(detectionRadius) && detectionRadius > 0) parts.push(`Trail r${Math.round(detectionRadius)}px`);
    if(Number.isFinite(trailRange) && trailRange > 0 && (!Number.isFinite(detectionRadius) || Math.round(trailRange) !== Math.round(detectionRadius))){
      parts.push(`Track ${Math.round(trailRange)}px`);
    }
    if(Number.isFinite(snapbackDelay) && snapbackDelay > 0) parts.push(`Return ${Math.round(snapbackDelay)}ms`);
    if(Number.isFinite(blinkDistance) && blinkDistance > 0) parts.push(`Blink ${Math.round(blinkDistance)}px`);
    if(Number.isFinite(width) && width > 0) parts.push(`Width ${width}px`);
    if(Number.isFinite(coneWidth) && coneWidth > 0) parts.push(`Width ${coneWidth}px`);
    if(Number.isFinite(twinDashWidth) && twinDashWidth > 0) parts.push(`Width ${Math.round(twinDashWidth)}px`);
    if(Number.isFinite(twinOvershoot) && twinOvershoot > 0) parts.push(`Overshoot ${Math.round(twinOvershoot)}px`);
    if(Number.isFinite(grabCenterWidth) && grabCenterWidth > 0) parts.push(`Center ${Math.round(grabCenterWidth)}px`);
    if(Number.isFinite(grabEdgeWidth) && grabEdgeWidth > 0) parts.push(`Edge ${Math.round(grabEdgeWidth)}px`);
    if(Number.isFinite(lashRange) && lashRange > 0) parts.push(`Range ${Math.round(lashRange)}px`);
    if(Number.isFinite(lashWidthEnd) && lashWidthEnd > 0){
      if(Number.isFinite(lashWidthStart) && lashWidthStart > 0 && lashWidthStart !== lashWidthEnd){
        parts.push(`Width ${Math.round(lashWidthStart)}-${Math.round(lashWidthEnd)}px`);
      } else {
        parts.push(`Width ${Math.round(lashWidthEnd)}px`);
      }
    }
    if(Number.isFinite(impactRadius) && impactRadius > 0) parts.push(`Impact r${Math.round(impactRadius)}px`);
    if(Number.isFinite(projectileWidth) && projectileWidth > 0) parts.push(`Width ${projectileWidth}px`);
    if(Number.isFinite(speed) && speed > 0) parts.push(`Speed ${speed.toFixed(0)}px/s`);
    if(Number.isFinite(grabSpeed) && grabSpeed > 0) parts.push(`Speed ${grabSpeed.toFixed(0)}px/s`);
    if(Number.isFinite(snapbackSpeed) && snapbackSpeed > 0) parts.push(`Speed ${Math.round(snapbackSpeed)}px/s`);
    if(Number.isFinite(count) && count > 0) parts.push(`${count} beams`);
    if(Number.isFinite(barrageChannel) && barrageChannel > 0) parts.push(`Channel ${Math.round(barrageChannel)}ms`);
    if(Number.isFinite(barrageInterval) && barrageInterval > 0) parts.push(`Interval ${Math.round(barrageInterval)}ms`);
    if(Number.isFinite(barrageRange) && barrageRange > 0) parts.push(`Range ${Math.round(barrageRange)}px`);
    if(Number.isFinite(barrageWidth) && barrageWidth > 0) parts.push(`Width ${Math.round(barrageWidth)}px`);
    if(Number.isFinite(barrageSpeed) && barrageSpeed > 0) parts.push(`Speed ${Math.round(barrageSpeed)}px/s`);
    if(Number.isFinite(barrageDamage) && barrageDamage > 0) parts.push(`Damage ${Math.round(barrageDamage)}`);
    if(Number.isFinite(boltCount) && boltCount > 0) parts.push(`${Math.round(boltCount)} bolts`);
    if(Number.isFinite(boltSeekRadius) && boltSeekRadius > 0) parts.push(`Seek r${Math.round(boltSeekRadius)}px`);
    if(Number.isFinite(boltSpeed) && boltSpeed > 0) parts.push(`${Math.round(boltSpeed)}px/s bolts`);
    if(Number.isFinite(plasmaDamageFlat) && plasmaDamageFlat > 0) parts.push(`Damage ${Math.round(plasmaDamageFlat)}`);
    if(Number.isFinite(plasmaRange) && plasmaRange > 0) parts.push(`Range ${Math.round(plasmaRange)}px`);
    if(Number.isFinite(plasmaWidth) && plasmaWidth > 0) parts.push(`Width ${Math.round(plasmaWidth)}px`);
    if(Number.isFinite(plasmaSpeed) && plasmaSpeed > 0) parts.push(`Speed ${Math.round(plasmaSpeed * 1000)}px/s`);
    if(Number.isFinite(plasmaSlowPct) && plasmaSlowPct > 0) parts.push(`Slow ${Math.round(plasmaSlowPct)}%`);
    if(Number.isFinite(plasmaSlowDuration) && plasmaSlowDuration > 0) parts.push(`Slow ${Math.round(plasmaSlowDuration)}ms`);
    if(Number.isFinite(plasmaSplitAngle) && plasmaSplitAngle > 0) parts.push(`Split ${Math.round(plasmaSplitAngle)}°`);
    if(Number.isFinite(plasmaRecastWindow) && plasmaRecastWindow > 0) parts.push(`Recast ${Math.round(plasmaRecastWindow)}ms`);
    if(Number.isFinite(followupRangeBonus) && followupRangeBonus > 0){
      parts.push(`+${Math.round(followupRangeBonus)}px follow-up range`);
    }
    if(Number.isFinite(tetherDurationMs) && tetherDurationMs > 0){
      parts.push(`Tether ${(tetherDurationMs / 1000).toFixed(1)}s`);
    }
    if(Number.isFinite(linkRootMs) && linkRootMs > 0){
      parts.push(`Root ${(linkRootMs / 1000).toFixed(2).replace(/0+$/,'').replace(/\.$/,'')}s`);
    }
    if(typeof plasmaSplitTriggerRaw === 'string' && plasmaSplitTriggerRaw.trim()){
      const triggers = {
        on_collision: 'on collision',
        on_max_range: 'on max range',
        on_recast: 'on recast',
        on_all: 'on collision, max range, or recast'
      };
      parts.push(triggers[plasmaSplitTriggerRaw] || plasmaSplitTriggerRaw);
    }
    if(Number.isFinite(recastWindowMs) && recastWindowMs > 0){
      const seconds = recastWindowMs / 1000;
      const text = seconds >= 10 ? Math.round(seconds) : Number(seconds.toFixed(1));
      parts.push(`Recast ${text}s`);
    }
    if(Number.isFinite(recastLockoutMs) && recastLockoutMs > 0){
      const seconds = recastLockoutMs / 1000;
      const text = seconds >= 10 ? Math.round(seconds) : Number(seconds.toFixed(1));
      parts.push(`Delay ${text}s`);
    }
    if(Number.isFinite(recastDelayMs) && recastDelayMs > 0){
      const seconds = recastDelayMs / 1000;
      const text = seconds >= 10 ? Math.round(seconds) : Number(seconds.toFixed(1));
      parts.push(`Recast unlock ${text}s`);
    }
    const trapCount = abilityFieldValue(ability, 'dropCount');
    if(Number.isFinite(trapCount) && trapCount > 0) parts.push(`${trapCount} traps`);
    const trapArmDelay = abilityFieldValue(ability, 'armDelayMs');
    if(Number.isFinite(trapArmDelay) && trapArmDelay > 0) parts.push(`Arm ${trapArmDelay}ms`);
    const trapLifetime = abilityFieldValue(ability, 'lifetimeMs');
    if(Number.isFinite(trapLifetime) && trapLifetime > 0) parts.push(`Lifetime ${trapLifetime}ms`);
    const trapTrigger = abilityFieldValue(ability, 'triggerRadiusPx');
    if(Number.isFinite(trapTrigger) && trapTrigger > 0) parts.push(`Trigger r${trapTrigger}px`);
    const trapAoe = abilityFieldValue(ability, 'aoeRadiusPx');
    if(Number.isFinite(trapAoe) && trapAoe > 0) parts.push(`AoE r${trapAoe}px`);
    const trapRoot = abilityFieldValue(ability, 'immobilizeMs');
    if(Number.isFinite(trapRoot) && trapRoot > 0) parts.push(`Root ${trapRoot}ms`);
    if(Number.isFinite(epicenterRadius) && epicenterRadius > 0) parts.push(`Center r${Math.round(epicenterRadius)}px`);
    if(Number.isFinite(outerDamagePct) && outerDamagePct >= 0 && outerDamagePct < 100) parts.push(`${Math.round(outerDamagePct)}% outer`);
    if(Number.isFinite(snapbackWidth) && snapbackWidth > 0) parts.push(`Path w${Math.round(snapbackWidth)}px`);
    if(Number.isFinite(snapbackRadius) && snapbackRadius > 0) parts.push(`Impact r${Math.round(snapbackRadius)}px`);
    const trapMaxActive = abilityFieldValue(ability, 'maxActiveTraps');
    if(Number.isFinite(trapMaxActive) && trapMaxActive > 0) parts.push(`Max ${trapMaxActive}`);
    const trapSubsequentPct = abilityFieldValue(ability, 'subsequentHitPct');
    if(Number.isFinite(trapSubsequentPct) && trapSubsequentPct > 0 && trapSubsequentPct < 100){
      parts.push(`Subsequent ${Math.round(trapSubsequentPct)}%`);
    }
    if(Number.isFinite(walkerCount) && walkerCount > 0) parts.push(`${walkerCount} walkers`);
    if(Number.isFinite(maidenHp) && maidenHp > 0) parts.push(`Maiden ${Math.round(maidenHp)} hp`);
    if(Number.isFinite(maidenDamage) && maidenDamage > 0) parts.push(`Maiden dmg ${Math.round(maidenDamage)}`);
    if(Number.isFinite(walkerHp) && walkerHp > 0) parts.push(`Walker ${Math.round(walkerHp)} hp`);
    if(Number.isFinite(walkerDamage) && walkerDamage > 0) parts.push(`Walker dmg ${Math.round(walkerDamage)}`);
    if(Number.isFinite(leashRange) && leashRange > 0) parts.push(`Leash ${Math.round(leashRange)}px`);
    if(Number.isFinite(summonRange) && summonRange > 0) parts.push(`Range ${Math.round(summonRange)}px`);
    if(Number.isFinite(releaseDelayMs) && releaseDelayMs > 0) parts.push(`Recast ${Math.round(releaseDelayMs)}ms`);
    const placementModeRaw = abilityFieldValue(ability, 'placementMode', { skipScaling: true });
    if(Number.isFinite(placementModeRaw)){
      const modes = ['Inline drop', 'Cluster drop', 'Free drop'];
      const idx = Math.max(0, Math.min(modes.length - 1, Math.round(placementModeRaw)));
      const label = modes[idx];
      if(label) parts.push(label);
    }
    const modeCharges = abilityFieldValue(ability, 'modeCharges');
    const modeDuration = abilityFieldValue(ability, 'modeDurationMs');
    const explosionDelay = abilityFieldValue(ability, 'explosionDelayMs');
    const explosionRadius = abilityFieldValue(ability, 'aoeRadiusPx');
    const artilleryMinRange = abilityFieldValue(ability, 'minRangePx');
    const artilleryMaxRange = abilityFieldValue(ability, 'maxRangePx');
    const fuseMs = abilityFieldValue(ability, 'chargeLifetimeMs');
    const knockbackRange = abilityFieldValue(ability, 'knockbackMaxPx');
    const selfLaunchRange = abilityFieldValue(ability, 'selfDashMaxPx');
    if(Number.isFinite(modeCharges) && modeCharges > 0) parts.push(`${modeCharges} charges`);
    if(Number.isFinite(modeDuration) && modeDuration > 0) parts.push(`Mode ${Math.round(modeDuration)}ms`);
    if(Number.isFinite(explosionDelay) && explosionDelay > 0) parts.push(`Delay ${Math.round(explosionDelay)}ms`);
    if(Number.isFinite(explosionRadius) && explosionRadius > 0) parts.push(`AoE r${Math.round(explosionRadius)}px`);
    if(Number.isFinite(knockbackRange) && knockbackRange > 0) parts.push(`Knockback ${Math.round(knockbackRange)}px`);
    if(Number.isFinite(selfLaunchRange) && selfLaunchRange > 0) parts.push(`Self launch ${Math.round(selfLaunchRange)}px`);
    if(Number.isFinite(fuseMs) && fuseMs > 0) parts.push(`Fuse ${Math.round(fuseMs)}ms`);
    if(Number.isFinite(artilleryMaxRange) && artilleryMaxRange > 0){
      if(Number.isFinite(artilleryMinRange) && artilleryMinRange > 0){
        parts.push(`Range ${Math.round(artilleryMinRange)}-${Math.round(artilleryMaxRange)}px`);
      } else {
        parts.push(`Range ${Math.round(artilleryMaxRange)}px`);
      }
    }
    return parts.join(' · ');
  }
  function clampSpellScale(value){
    let numeric = parseFloat(value);
    if(!Number.isFinite(numeric)) numeric = 1;
    numeric = Math.max(SPELL_SCALE_MIN, Math.min(SPELL_SCALE_MAX, numeric));
    return Math.round(numeric * 100) / 100;
  }
  function refreshAbilitiesForSpellScaling(){
    renderAbilityBar();
    if(isAbilityRepoOpen()){
      updateAbilityRepoSubtitle();
      renderSpellList();
    }
  }
  function setSpellSpeedScale(value, { syncInput = true } = {}){
    const next = clampSpellScale(value);
    abilityTunables.spellSpeedScale = next;
    if(syncInput && spellSpeedScaleInput){
      spellSpeedScaleInput.value = String(next);
    }
    refreshAbilitiesForSpellScaling();
  }
  function setSpellSizeScale(value, { syncInput = true } = {}){
    const next = clampSpellScale(value);
    abilityTunables.spellSizeScale = next;
    if(syncInput && spellSizeScaleInput){
      spellSizeScaleInput.value = String(next);
    }
    refreshAbilitiesForSpellScaling();
  }

  function normalizeAbilityCastType(ability, value){
    const allowed = abilityAllowedCastTypes(ability);
    if(!allowed || allowed.length === 0){
      return normalizeCastType(value);
    }
    if(value === undefined || value === null || value === ''){
      const fallback = defaultAbilityCastType(ability);
      if(allowed.includes(fallback)){
        return fallback;
      }
      return allowed[0];
    }
    if(allowed.includes(value)){
      return value;
    }
    const normalized = normalizeCastType(value);
    if(allowed.includes(normalized)){
      return normalized;
    }
    const fallback = defaultAbilityCastType(ability);
    if(allowed.includes(fallback)){
      return fallback;
    }
    return allowed[0];
  }

  return {
    listAbilities,
    getAbilityDefinition,
    abilityField,
    isSpellSpeedField,
    isSpellSizeField,
    abilityFieldValue,
    clampFieldValue,
    abilitySummary,
    clampSpellScale,
    refreshAbilitiesForSpellScaling,
    setSpellSpeedScale,
    setSpellSizeScale,
    normalizeAbilityCastType
  };
}
