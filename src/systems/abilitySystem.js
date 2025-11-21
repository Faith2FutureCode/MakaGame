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
    const slow = abilityFieldValue(ability, 'slowPct');
    const slowDuration = abilityFieldValue(ability, 'slowDurationMs');
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
    const parts = [];
    if(Number.isFinite(damage)) parts.push(`Damage ${damage}`);
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
    if(Number.isFinite(slow) && slow > 0) parts.push(`Slow ${slow}%`);
    if(Number.isFinite(slowDuration) && slowDuration > 0) parts.push(`Slow ${slowDuration}ms`);
    if(Number.isFinite(length) && length > 0) parts.push(`Length ${length}px`);
    if(Number.isFinite(coneDistance) && coneDistance > 0) parts.push(`Range ${coneDistance}px`);
    if(Number.isFinite(grabRange) && grabRange > 0) parts.push(`Range ${Math.round(grabRange)}px`);
    if(Number.isFinite(blinkDistance) && blinkDistance > 0) parts.push(`Blink ${Math.round(blinkDistance)}px`);
    if(Number.isFinite(width) && width > 0) parts.push(`Width ${width}px`);
    if(Number.isFinite(coneWidth) && coneWidth > 0) parts.push(`Width ${coneWidth}px`);
    if(Number.isFinite(grabCenterWidth) && grabCenterWidth > 0) parts.push(`Center ${Math.round(grabCenterWidth)}px`);
    if(Number.isFinite(grabEdgeWidth) && grabEdgeWidth > 0) parts.push(`Edge ${Math.round(grabEdgeWidth)}px`);
    if(Number.isFinite(projectileWidth) && projectileWidth > 0) parts.push(`Width ${projectileWidth}px`);
    if(Number.isFinite(speed) && speed > 0) parts.push(`Speed ${speed.toFixed(0)}px/s`);
    if(Number.isFinite(grabSpeed) && grabSpeed > 0) parts.push(`Speed ${grabSpeed.toFixed(0)}px/s`);
    if(Number.isFinite(count) && count > 0) parts.push(`${count} beams`);
    if(Number.isFinite(barrageChannel) && barrageChannel > 0) parts.push(`Channel ${Math.round(barrageChannel)}ms`);
    if(Number.isFinite(barrageInterval) && barrageInterval > 0) parts.push(`Interval ${Math.round(barrageInterval)}ms`);
    if(Number.isFinite(barrageRange) && barrageRange > 0) parts.push(`Range ${Math.round(barrageRange)}px`);
    if(Number.isFinite(barrageWidth) && barrageWidth > 0) parts.push(`Width ${Math.round(barrageWidth)}px`);
    if(Number.isFinite(barrageSpeed) && barrageSpeed > 0) parts.push(`Speed ${Math.round(barrageSpeed)}px/s`);
    if(Number.isFinite(barrageDamage) && barrageDamage > 0) parts.push(`Damage ${Math.round(barrageDamage)}`);
    if(Number.isFinite(plasmaDamageFlat) && plasmaDamageFlat > 0) parts.push(`Damage ${Math.round(plasmaDamageFlat)}`);
    if(Number.isFinite(plasmaRange) && plasmaRange > 0) parts.push(`Range ${Math.round(plasmaRange)}px`);
    if(Number.isFinite(plasmaWidth) && plasmaWidth > 0) parts.push(`Width ${Math.round(plasmaWidth)}px`);
    if(Number.isFinite(plasmaSpeed) && plasmaSpeed > 0) parts.push(`Speed ${Math.round(plasmaSpeed * 1000)}px/s`);
    if(Number.isFinite(plasmaSlowPct) && plasmaSlowPct > 0) parts.push(`Slow ${Math.round(plasmaSlowPct)}%`);
    if(Number.isFinite(plasmaSlowDuration) && plasmaSlowDuration > 0) parts.push(`Slow ${Math.round(plasmaSlowDuration)}ms`);
    if(Number.isFinite(plasmaSplitAngle) && plasmaSplitAngle > 0) parts.push(`Split ${Math.round(plasmaSplitAngle)}°`);
    if(Number.isFinite(plasmaRecastWindow) && plasmaRecastWindow > 0) parts.push(`Recast ${Math.round(plasmaRecastWindow)}ms`);
    if(typeof plasmaSplitTriggerRaw === 'string' && plasmaSplitTriggerRaw.trim()){
      const triggers = {
        on_collision: 'on collision',
        on_max_range: 'on max range',
        on_recast: 'on recast',
        on_all: 'on collision, max range, or recast'
      };
      parts.push(triggers[plasmaSplitTriggerRaw] || plasmaSplitTriggerRaw);
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
    const trapMaxActive = abilityFieldValue(ability, 'maxActiveTraps');
    if(Number.isFinite(trapMaxActive) && trapMaxActive > 0) parts.push(`Max ${trapMaxActive}`);
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
    if(Number.isFinite(modeCharges) && modeCharges > 0) parts.push(`${modeCharges} charges`);
    if(Number.isFinite(modeDuration) && modeDuration > 0) parts.push(`Mode ${Math.round(modeDuration)}ms`);
    if(Number.isFinite(explosionDelay) && explosionDelay > 0) parts.push(`Delay ${Math.round(explosionDelay)}ms`);
    if(Number.isFinite(explosionRadius) && explosionRadius > 0) parts.push(`AoE r${Math.round(explosionRadius)}px`);
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
