export const PLAYER_STATUS_DEFS = [
    { id: 'stunned', label: 'Stunned', timerKey: 'stunTimer', defaultEmoji: '💫', defaultColor: '#ffd966' },
    { id: 'slowed', label: 'Slowed', timerKey: 'slowTimer', defaultEmoji: '🐌', defaultColor: '#9ad0ff' },
    { id: 'taunted', label: 'Taunted', timerKey: 'tauntTimer', defaultEmoji: '😡', defaultColor: '#ff8c8c' },
    { id: 'hasted', label: 'Hasted', timerKey: 'hasteTimer', defaultEmoji: '💨', defaultColor: '#ffd27f' },
    { id: 'recalling', label: 'Recalling', timerKey: 'recallTimer', defaultEmoji: '🏠', defaultColor: '#7fe3ff' },
    { id: 'homeguard', label: 'Homeguard', timerKey: 'homeguardTimer', defaultEmoji: '🦵', defaultColor: '#4ade80' },
    { id: 'invulnerable', label: 'Invulnerable', timerKey: 'baseInvulnTimer', defaultEmoji: '🛡️', defaultColor: '#facc15' }
  ];
  export function buildDefaultPlayerStatusConfig(){
    const config = {};
    for(const def of PLAYER_STATUS_DEFS){
      config[def.id] = { emoji: def.defaultEmoji, color: def.defaultColor };
    }
    return config;
  }

  export const PRAYER_DEFS = [
    { id: 'green', label: 'Green Protection', defaultBinding: { key: '1', code: 'Digit1' } },
    { id: 'blue', label: 'Blue Protection', defaultBinding: { key: '2', code: 'Digit2' } },
    { id: 'red', label: 'Red Protection', defaultBinding: { key: '3', code: 'Digit3' } }
  ];
  export const MONSTER_ABILITY_IDS = PRAYER_DEFS.map(def => def.id);
  export const DEFAULT_MONSTER_ICONS = { green: '🟢', blue: '🔵', red: '🔴' };
  export const MONSTER_SLOT_MACHINE_COLUMNS = 1;
  export const MONSTER_SLOT_MACHINE_DEFAULT_SPIN_DURATION = 1.2;
  export const MONSTER_SLOT_MACHINE_DEFAULT_REVEAL_DURATION = 0.6;
  export const MONSTER_SLOT_MACHINE_SPIN_REFRESH = 0.08;
  export const MONSTER_SLOT_MACHINE_IDLE_REFRESH = 0.4;
  export const prayerBindingLookup = new Map();

  export function randomMonsterAbility(){
    if(!MONSTER_ABILITY_IDS.length){
      return 'green';
    }
    const index = Math.floor(Math.random() * MONSTER_ABILITY_IDS.length);
    return MONSTER_ABILITY_IDS[Math.max(0, Math.min(MONSTER_ABILITY_IDS.length - 1, index))];
  }

  export function formatAbilityKeyLabel(key, code){
    if(typeof key === 'string' && key.length){
      if(key === ' ') return 'Space';
      if(key.length === 1) return key.toUpperCase();
      return key.charAt(0).toUpperCase() + key.slice(1);
    }
    if(typeof code === 'string' && code.length){
      if(code.startsWith('Digit')) return code.slice(5);
      if(code.startsWith('Key')) return code.slice(3);
      return code;
    }
    return '�?"';
  }

  export function buildDefaultPrayerBindings(){
    const bindings = {};
    for(const def of PRAYER_DEFS){
      const key = def.defaultBinding && typeof def.defaultBinding.key === 'string' ? def.defaultBinding.key : '';
      const code = def.defaultBinding && typeof def.defaultBinding.code === 'string' ? def.defaultBinding.code : '';
      bindings[def.id] = {
        key,
        code,
        label: formatAbilityKeyLabel(key, code)
      };
    }
    return bindings;
  }

  export function rebuildPrayerBindingLookup(state){
    prayerBindingLookup.clear();
    const bindings = state && state.bindings && typeof state.bindings === 'object' ? state.bindings : {};
    for(const def of PRAYER_DEFS){
      const binding = bindings[def.id];
      if(!binding || typeof binding !== 'object'){
        continue;
      }
      if(typeof binding.code === 'string' && binding.code){
        const codeKey = `code:${binding.code}`;
        if(!prayerBindingLookup.has(codeKey)){
          prayerBindingLookup.set(codeKey, def.id);
        }
      }
      if(typeof binding.key === 'string' && binding.key){
        const keyKey = `key:${binding.key.toLowerCase()}`;
        if(!prayerBindingLookup.has(keyKey)){
          prayerBindingLookup.set(keyKey, def.id);
        }
      }
    }
  }

  export function ensurePrayerState(){
    let state = GameState.prayers;
    if(!state || typeof state !== 'object'){
      state = { active: null, bindings: buildDefaultPrayerBindings() };
      GameState.prayers = state;
    }
    if(!state.bindings || typeof state.bindings !== 'object'){
      state.bindings = buildDefaultPrayerBindings();
    }
    const validIds = new Set(PRAYER_DEFS.map(def => def.id));
    for(const def of PRAYER_DEFS){
      const existing = state.bindings[def.id];
      const key = existing && typeof existing.key === 'string' ? existing.key : '';
      const code = existing && typeof existing.code === 'string' ? existing.code : '';
      const label = existing && typeof existing.label === 'string' && existing.label.trim()
        ? existing.label.trim()
        : formatAbilityKeyLabel(key, code);
      state.bindings[def.id] = { key, code, label };
    }
    for(const bindingKey of Object.keys(state.bindings)){
      if(!validIds.has(bindingKey)){
        delete state.bindings[bindingKey];
      }
    }
    if(!validIds.has(state.active)){
      state.active = null;
    }
    return state;
  }

  export function createDefaultMonsterState(overrides){
    const monster = {
      id: 'raidMonster',
      active: true,
      x: 2600,
      y: 2600,
      size: 140,
      aggroRadius: 420,
      hp: 5000,
      maxHp: 5000,
      projectileDamage: 120,
      castInterval: 3,
      queueSize: 3,
      freezeDuration: 1.5,
      speedBoostPct: 25,
      healAmount: 200,
      projectileSpeed: 520,
      projectileIcons: { ...DEFAULT_MONSTER_ICONS },
      abilityQueue: [],
      castTimer: 3,
      lastTargetCount: 0,
      slotMachineSpinDuration: MONSTER_SLOT_MACHINE_DEFAULT_SPIN_DURATION,
      slotMachineRevealDuration: MONSTER_SLOT_MACHINE_DEFAULT_REVEAL_DURATION,
      slotMachineActive: false,
      slotMachineSpinTimer: 0,
      slotMachineRevealTimer: 0,
      slotMachineFaceTimer: 0,
      slotMachineImpactReady: false,
      slotMachineFaces: [],
      pendingAbility: null
    };
    if(overrides && typeof overrides === 'object'){
      Object.assign(monster, overrides);
    }
    if(!monster.projectileIcons || typeof monster.projectileIcons !== 'object'){
      monster.projectileIcons = { ...DEFAULT_MONSTER_ICONS };
    }
    return monster;
  }

  export function normalizeMonsterState(monster){
    let normalized = monster && typeof monster === 'object' ? monster : createDefaultMonsterState();
    if(normalized !== monster){
      GameState.monster = normalized;
    }
    normalized.active = normalized.active === false ? false : true;
    const clampCoordValue = (value, limit) => {
      const numeric = Number(value);
      if(!Number.isFinite(numeric)) return limit / 2;
      return Math.max(0, Math.min(limit, numeric));
    };
    const mapWidth = GameState.map && Number.isFinite(Number(GameState.map.width)) ? Number(GameState.map.width) : 5000;
    const mapHeight = GameState.map && Number.isFinite(Number(GameState.map.height)) ? Number(GameState.map.height) : 5000;
    normalized.x = clampCoordValue(normalized.x, mapWidth);
    normalized.y = clampCoordValue(normalized.y, mapHeight);
    normalized.size = Math.max(40, Math.min(400, Number(normalized.size) || 140));
    normalized.aggroRadius = Math.max(0, Number(normalized.aggroRadius) || 0);
    normalized.maxHp = Math.max(1, Number(normalized.maxHp) || 1);
    normalized.hp = Math.max(0, Math.min(normalized.maxHp, Number(normalized.hp) || normalized.maxHp));
    normalized.projectileDamage = Math.max(0, Number(normalized.projectileDamage) || 0);
    normalized.castInterval = Math.max(0.5, Number(normalized.castInterval) || 3);
    normalized.queueSize = Math.max(1, Math.min(6, Number(normalized.queueSize) || 3));
    normalized.freezeDuration = Math.max(0, Number(normalized.freezeDuration) || 0);
    normalized.speedBoostPct = Math.max(0, Number(normalized.speedBoostPct) || 0);
    normalized.healAmount = Math.max(0, Number(normalized.healAmount) || 0);
    normalized.projectileSpeed = Math.max(60, Number(normalized.projectileSpeed) || 520);
    if(!Array.isArray(normalized.abilityQueue)){
      normalized.abilityQueue = [];
    }
    if(!normalized.projectileIcons || typeof normalized.projectileIcons !== 'object'){
      normalized.projectileIcons = { ...DEFAULT_MONSTER_ICONS };
    }
    for(const key of Object.keys(normalized.projectileIcons)){
      const value = normalized.projectileIcons[key];
      if(typeof value !== 'string' || !value.trim()){
        normalized.projectileIcons[key] = DEFAULT_MONSTER_ICONS[key] || '🛡️';
      } else {
        normalized.projectileIcons[key] = value.trim();
      }
    }
    const rawSpinDuration = Number(normalized.slotMachineSpinDuration);
    normalized.slotMachineSpinDuration = Math.max(0, Number.isFinite(rawSpinDuration) ? rawSpinDuration : MONSTER_SLOT_MACHINE_DEFAULT_SPIN_DURATION);
    const rawRevealDuration = Number(normalized.slotMachineRevealDuration);
    normalized.slotMachineRevealDuration = Math.max(0, Number.isFinite(rawRevealDuration) ? rawRevealDuration : MONSTER_SLOT_MACHINE_DEFAULT_REVEAL_DURATION);
    normalized.slotMachineActive = normalized.slotMachineActive === true;
    normalized.slotMachineSpinTimer = Math.max(0, Number(normalized.slotMachineSpinTimer) || 0);
    normalized.slotMachineRevealTimer = Math.max(0, Number(normalized.slotMachineRevealTimer) || 0);
    normalized.slotMachineFaceTimer = Math.max(0, Number(normalized.slotMachineFaceTimer) || 0);
    normalized.slotMachineImpactReady = normalized.slotMachineImpactReady === true;
    if(!Array.isArray(normalized.slotMachineFaces)){
      normalized.slotMachineFaces = [];
    }
    for(let i = 0; i < MONSTER_SLOT_MACHINE_COLUMNS; i++){
      const face = normalized.slotMachineFaces[i];
      if(!MONSTER_ABILITY_IDS.includes(face)){
        normalized.slotMachineFaces[i] = randomMonsterAbility();
      }
    }
    normalized.slotMachineFaces.length = MONSTER_SLOT_MACHINE_COLUMNS;
    normalized.pendingAbility = MONSTER_ABILITY_IDS.includes(normalized.pendingAbility) ? normalized.pendingAbility : null;
    normalized.castTimer = Number.isFinite(Number(normalized.castTimer)) ? Math.max(0, Number(normalized.castTimer)) : normalized.castInterval;
    normalized.lastTargetCount = Math.max(0, Number(normalized.lastTargetCount) || 0);
    return normalized;
  }
export function createDefaultPlayerFloatState(){
  return {
    width: 120,
    gap: 18,
    height: 18,
    color: '#5bc357',
    attack: { width: 120, height: 6, offsetX: 0, offsetY: 0 },
    icons: { width: 24, height: 24, offsetX: 12, offsetY: 0 },
    statuses: buildDefaultPlayerStatusConfig()
  };
}

  export function createDefaultPracticeDummy(overrides){
    const dummy = {
      isPracticeDummy: true,
      active: false,
      x: 2500,
      y: 2500,
      size: 120,
      radius: 900,
      hp: 0,
      maxHp: 1000,
      side: 'red',
      slowPct: 0,
      slowTimer: 0,
      stunTimer: 0,
      knockupTimer: 0,
      silenceTimer: 0,
      disarmTimer: 0,
      polymorphTimer: 0,
      tauntTimer: 0,
      hasteTimer: 0,
      hastePct: 0,
      portalizing: 0,
      beingPulledBy: null,
      cd: 0,
      statuses: buildDefaultPlayerStatusConfig(),
      deathResponse: 'respawn',
      respawnTimer: 0,
      placing: false
    };
    if(overrides && typeof overrides === 'object'){
      Object.assign(dummy, overrides);
    }
    return dummy;
  }

  export const practiceDummyDefaults = createDefaultPracticeDummy();

  export function createGameState()
{
  return {
    meta: { version: '0.1.0' },
    map: {
      width: 5000,
      height: 5000,
      loaded: false,
      image: { src: '', hitboxSrc: '', displayName: '' },
      hitbox: { loaded: false, width: 0, height: 0, data: null, displayName: '' },
      stagePointer: { inside: false, x: 0, y: 0, width: 0, height: 0, worldX: 0, worldY: 0 },
      colliders: {
        list: [],
        nextId: 1,
        selectedId: null,
        editMode: false,
        placing: false,
        pointerId: null,
        draggingId: null,
        dragOffset: { x: 0, y: 0 },
        dragMoved: false,
        hidden: false,
        defaults: {
          type: 'circle',
          radius: 80,
          innerRadius: 40,
          offset: 110,
          length: 200,
          angleDeg: 0
        }
      }
    },
    practiceDummy: createDefaultPracticeDummy(),
    bases: { blue: null, red: null },
    player: {
      facingRadians: 0,
      hurtboxVisible: true,
      hurtboxShape: 'capsule',
      hurtboxLength: 32,
      hurtboxWidth: 20,
      vision: {
        radius: 900,
        sources: [],
        nextId: 1,
        selectedId: null,
        editMode: false,
        placing: false,
        pointerId: null,
        draggingId: null,
        dragOffset: { x: 0, y: 0 },
        dragMoved: false,
        hidden: false,
        dummy: createDefaultPracticeDummy(),
        dummyState: { placing: false, dragging: false, pointerId: null, dragOffset: { x: 0, y: 0 }, selected: false },
        defaults: {
          type: 'circle',
          radius: 240,
          innerRadius: 120,
          offset: 240,
          length: 400,
          angleDeg: 0,
          mode: 1
        }
      },
      mp: 400,
      maxMp: 400,
      combatLockTimer: 0,
      homeguardTimer: 0,
      recallTimer: 0,
      baseInvulnTimer: 0,
      baseRegenProgress: 0,
      isInBaseZone: false,
      isInFountain: false,
      recall: { state: 'idle', timer: 0, lastStateChange: 0 },
      shop: { stayTimer: 0, undoStack: [], transactionSeq: 1 },
      inventory: []
    },
    camera: {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      baseWidth: 1920,
      baseHeight: 1080,
      scale: 1,
      manualOffsetX: 0,
      manualOffsetY: 0,
      followX: 0,
      followY: 0,
      mode: 'semi',
      viewportReady: false,
      followLagMs: 0,
      leadDistance: 0,
      horizontalOffsetPercent: 0,
      verticalOffsetPercent: 0,
      edgeScrollMargin: 0,
      edgeScrollSpeed: 0,
      recenterDelayMs: 0,
      manualLeash: 0,
      wheelSensitivity: 20,
      zoomInLocked: false,
      zoomInLimit: null,
      zoomOutLocked: false,
      zoomOutLimit: null,
      lockBinding: { key: ' ', code: 'Space', label: 'Space' },
      lockCapture: false,
      lastUnlockedMode: 'semi',
      lastManualMoveAt: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      drag: { active: false, pointerId: null, last: null },
      lastPlayerVelocity: { x: 0, y: 0 },
      lastTransform: { x: null, y: null, scale: null }
    },
    hud: {
      minimap: {
        autoScale: 1,
        userScale: 1,
        effectiveScale: 1,
        layoutVisible: true,
        clickToMoveEnabled: true,
        clickThroughEnabled: false,
        lastRender: 0,
        pointerActive: false,
        pointerId: null
      },
      playerFloat: createDefaultPlayerFloatState(),
      hudMessage: { timer: null },
      sidebar: { lastMeasuredWidth: null },
      abilityTunables: { spellSpeedScale: 1, spellSizeScale: 1 },
      abilityRuntime: { flameChomperSequence: 1, lastPointerWorld: null, stagePointerOrdering: false, activePointerId: null },
      cursor: { enabled: false, outlineEnabled: true, emoji: '🎯', hoverColor: '#7fe3ff' },
      pings: { types: { onMyWay: '🏃', enemyMissing: '❓', assistMe: '🆘', target: '🎯' }, active: [] },
      spellCasting: {
        defaultCastType: 'quick',
        normalModifier: { key: '', code: '', label: '—' },
        quickModifier: { key: '', code: '', label: '—' },
        quickIndicatorModifier: { key: '', code: '', label: '—' }
      },
      keybinds: {
        attackMove: { key: 'a', code: 'KeyA', label: 'A' },
        pingWheel: { key: 'g', code: 'KeyG', label: 'G' }
      },
      abilityBar: {
        orientation: 'horizontal',
        count: 20,
        scale: 1,
        healthPlacement: { horizontal: 'bottom', vertical: 'right', textVertical: 'top' },
        statsPlacementVertical: 'top',
        assignments: [],
        activeSlotIndex: null,
        editingAbilityId: null,
        hotkeys: [],
        slotStates: [],
        hotkeyMode: false,
        hotkeyCaptureIndex: null
      },
      timer: { running: false, start: 0, elapsedMs: 0, nextWaveAtMs: 0, lastText: '' },
      waves: { waveCount: 7, waveIntervalMs: 30000, spawnSpacingMs: 250, waveNumber: 0 },
      gold: { player: 0, lastDisplayText: '', perSecond: 15, perKill: 0 },
      score: { blue: 0, red: 0, lastBlueText: '', lastRedText: '', pointsPer: 1, winTarget: 50, gameOver: false },
      portal: { spin: 0, baseMinionHP: 1000, baseMinionDMG: 40, scalePct: 10 }
    },
    prayers: { active: null, bindings: buildDefaultPrayerBindings() },
    monster: createDefaultMonsterState(),
    spawns: { blue: [], red: [], pending: [], placing: null },
    lanes: {
      count: 1,
      configs: [],
      layout: null,
      layoutDirty: true,
      version: 1,
      minion: { diameter: 15, radius: 7.5, fanSpacing: 20.25 }
    },
    turrets: {
      perLane: 1,
      range: 650,
      damage: 150,
      attackInterval: 1.25,
      playerFocusSeconds: 2,
      offsets: []
    },
    minions: [],
    items: { abilityDefinitions: {} },
    effects: {
      activeBeams: [],
      beamCasts: [],
      laserConeCasts: [],
      grabCasts: [],
      piercingArrowCasts: [],
      plasmaFissionCasts: [],
      chargingGaleCasts: [],
      cullingBarrageChannels: [],
      cullingBarrageProjectiles: [],
      arcaneRiteModes: [],
      arcaneRiteExplosions: [],
      piercingArrowProjectiles: [],
      plasmaFissionProjectiles: [],
      flameChomperTraps: [],
      pulses: [],
      laserProjectiles: [],
      blinkingBoltProjectiles: [],
      chargingGaleProjectiles: [],
      hitsplats: []
    }
  };
}
export const GameState = createGameState();

  
