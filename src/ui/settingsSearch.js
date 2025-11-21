export function createSettingsSearch({
  settingsSearchOverlay,
  settingsSearchInput,
  settingsSearchResultsEl,
  settingsSearchEmptyEl,
  settingsSearchEmptyPrimary,
  settingsSearchEmptySecondary,
  settingsSearchStatusEl,
  settingsSearchFacetsEl,
  settingsSearchRecentsEl,
  settingsSearchHelpBtn,
  settingsSearchHelpEl,
  settingsSearchHelpClose,
  settingsSearchAskBtn,
  deriveSettingHelp,
  showSettingHelp,
  setMenuState
} = {}){
  const expandMenu = typeof setMenuState === 'function' ? setMenuState : null;

  const SETTINGS_SEARCH_FIELD_WEIGHTS = { title: 5, aliases: 4, tags: 3, path: 2, desc: 1 };
  const SETTINGS_SEARCH_DEBOUNCE_MS = 120;
  const SETTINGS_SEARCH_RECENT_LIMIT = 20;
  const SETTINGS_SEARCH_CACHE_LIMIT = 20;
  const SETTINGS_SEARCH_RESULT_LIMIT = 50;

  const settingsSearchState = {
    docs: [],
    docById: new Map(),
    invertedIndex: new Map(),
    tokenCatalog: new Set(),
    trigramIndex: new Map(),
    queryCache: new Map(),
    cacheOrder: [],
    resultElements: new Map(),
    controlSubscriptions: [],
    open: false,
    activeIndex: -1,
    requestId: 0,
    recentQueries: [],
    lastRenderQuery: '',
    results: [],
    tokens: []
  };

  function normalizeSearchString(str){
    if(typeof str !== 'string'){
      return '';
    }
    return str.normalize('NFKD').toLowerCase();
  }

  function tokenizeSearchText(text){
    const normalized = normalizeSearchString(text);
    if(!normalized){
      return [];
    }
    return normalized.split(/[^a-z0-9]+/).filter(Boolean);
  }

  function parseList(value){
    if(typeof value !== 'string'){
      return [];
    }
    return value.split(/[,;]/).map(part => part.trim()).filter(Boolean);
  }

  function escapeHtml(value){
    if(typeof value !== 'string'){
      return '';
    }
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function findAllOccurrences(haystack, needle){
    const ranges = [];
    if(!haystack || !needle){
      return ranges;
    }
    let index = haystack.indexOf(needle);
    while(index !== -1){
      ranges.push({ start: index, end: index + needle.length });
      index = haystack.indexOf(needle, index + needle.length);
    }
    return ranges;
  }

  function mergeRanges(ranges){
    if(!Array.isArray(ranges) || !ranges.length){
      return [];
    }
    const sorted = ranges.slice().sort((a, b)=> a.start - b.start || a.end - b.end);
    const merged = [];
    for(const range of sorted){
      if(!merged.length){
        merged.push({ start: range.start, end: range.end });
        continue;
      }
      const prev = merged[merged.length - 1];
      if(range.start <= prev.end){
        prev.end = Math.max(prev.end, range.end);
      } else {
        merged.push({ start: range.start, end: range.end });
      }
    }
    return merged;
  }

  function highlightText(text, ranges){
    if(!text){
      return '';
    }
    const merged = mergeRanges(ranges);
    if(!merged.length){
      return escapeHtml(text);
    }
    let cursor = 0;
    let output = '';
    for(const range of merged){
      const start = Math.max(0, range.start);
      const end = Math.min(text.length, range.end);
      if(start > cursor){
        output += escapeHtml(text.slice(cursor, start));
      }
      const slice = text.slice(start, end);
      output += `<span class="settingsSearchHighlight">${escapeHtml(slice)}</span>`;
      cursor = end;
    }
    if(cursor < text.length){
      output += escapeHtml(text.slice(cursor));
    }
    return output;
  }

  function clampNumericForControl(control, value){
    if(!control){
      return value;
    }
    let numeric = Number(value);
    if(!Number.isFinite(numeric)){
      numeric = Number(control.value);
    }
    const minAttr = control.getAttribute('min');
    const maxAttr = control.getAttribute('max');
    if(minAttr !== null){
      const min = Number(minAttr);
      if(Number.isFinite(min)){
        numeric = Math.max(min, numeric);
      }
    }
    if(maxAttr !== null){
      const max = Number(maxAttr);
      if(Number.isFinite(max)){
        numeric = Math.min(max, numeric);
      }
    }
    return numeric;
  }

  function formatSettingValue(doc, value){
    if(value === null || value === undefined){
      return 'â€”';
    }
    if(doc.valueTypeNormalized === 'number'){
      const numeric = Number(value);
      if(!Number.isFinite(numeric)){
        return String(value);
      }
      const step = doc.step;
      if(Number.isFinite(step) && step > 0 && step < 1){
        return numeric.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
      }
      if(Math.abs(numeric) >= 1000){
        return Math.round(numeric).toLocaleString();
      }
      return String(Math.round(numeric * 1000) / 1000);
    }
    return String(value);
  }

  function getControlValue(control, valueType){
    if(!control){
      return null;
    }
    const tag = control.tagName;
    if(valueType === 'boolean'){
      const ariaPressed = control.getAttribute('aria-pressed');
      if(ariaPressed === 'true'){ return true; }
      if(ariaPressed === 'false'){ return false; }
      if(control.dataset && typeof control.dataset.active === 'string'){
        return control.dataset.active === 'true';
      }
      return !!control.classList.contains('is-active');
    }
    if(tag === 'SELECT' || tag === 'TEXTAREA'){
      return control.value;
    }
    if(tag === 'INPUT'){
      const type = control.getAttribute('type') || 'text';
      if(type === 'number' || type === 'range'){
        const numeric = Number(control.value);
        return Number.isFinite(numeric) ? numeric : null;
      }
      if(type === 'text' || type === 'color'){
        return control.value;
      }
    }
    if(tag === 'BUTTON'){
      return control.textContent || '';
    }
    return control.value;
  }

  function setControlValue(control, value, valueType, { commit = false } = {}){
    if(!control){
      return;
    }
    if(valueType === 'number'){
      const clamped = clampNumericForControl(control, value);
      control.value = String(clamped);
      control.dispatchEvent(new Event('input', { bubbles: true }));
      if(commit){
        control.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
    if(valueType === 'boolean'){
      control.click();
      return;
    }
    control.value = String(value);
    control.dispatchEvent(new Event('input', { bubbles: true }));
    if(commit){
      control.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function deriveGroupTitle(pane){
    if(!pane){
      return 'Settings';
    }
    if(pane.dataset && pane.dataset.settingGroup){
      return pane.dataset.settingGroup;
    }
    let sibling = pane.previousElementSibling;
    while(sibling){
      if(sibling.classList && sibling.classList.contains('btn')){
        const help = deriveSettingHelp(sibling);
        if(help && help.title){
          return help.title;
        }
        const raw = sibling.textContent || '';
        if(raw.trim()){
          return raw.replace(/\s+/g, ' ').trim();
        }
      }
      sibling = sibling.previousElementSibling;
    }
    return 'Settings';
  }

  function sanitizeSettingId(id, fallbackIndex){
    if(id && typeof id === 'string'){
      const trimmed = id.trim();
      if(trimmed){
        return trimmed;
      }
    }
    return `setting.${fallbackIndex}`;
  }

  function registerDocToken(doc, token, field){
    if(!token){
      return;
    }
    if(!doc.tokenFieldMap){
      doc.tokenFieldMap = new Map();
    }
    if(!doc.tokenFieldMap.has(token)){
      doc.tokenFieldMap.set(token, new Set());
    }
    doc.tokenFieldMap.get(token).add(field);
    if(!doc.allTokens){
      doc.allTokens = new Set();
    }
    doc.allTokens.add(token);
  }

  function collectSettingsDocuments(){
    const documents = [];
    const panes = document.querySelectorAll('.submenu');
    panes.forEach((pane)=>{
      const groupTitle = deriveGroupTitle(pane);
      const scope = pane.dataset && pane.dataset.settingScope ? pane.dataset.settingScope : 'global';
      const rows = pane.querySelectorAll('.formrow');
      rows.forEach((row)=>{
        if(row.dataset && row.dataset.settingIgnore === 'true'){
          return;
        }
        const controlSelector = row.dataset && row.dataset.settingControl
          ? `#${CSS.escape(row.dataset.settingControl)}`
          : 'input:not([type="file"]):not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]), select, textarea';
        let control = null;
        if(row.dataset && row.dataset.settingControl){
          control = row.querySelector(controlSelector);
        }
        if(!control){
          const candidates = row.querySelectorAll(controlSelector);
          for(const candidate of candidates){
            if(candidate && candidate.id){
              control = candidate;
              break;
            }
            control = candidate;
          }
        }
        if(!control){
          return;
        }
        if(control.tagName === 'INPUT'){
          const type = control.getAttribute('type');
          if(type === 'file' || type === 'hidden' || type === 'radio' || type === 'checkbox' || type === 'button'){
            return;
          }
        }
        const rowId = row.dataset && row.dataset.settingId ? row.dataset.settingId : null;
        const controlId = control.dataset && control.dataset.settingId ? control.dataset.settingId : null;
        const rawId = rowId || controlId || control.id || row.id;
        const docId = sanitizeSettingId(rawId, documents.length);
        if(settingsSearchState.docById.has(docId)){
          return;
        }
        const help = deriveSettingHelp(row) || deriveSettingHelp(control) || deriveSettingHelp(pane);
        const title = (row.dataset && row.dataset.settingTitle) || (help && help.title) || (row.querySelector('label') ? (row.querySelector('label').textContent || '').trim() : docId);
        const desc = (row.dataset && row.dataset.settingDesc) || (help && help.text) || '';
        const section = row.dataset && row.dataset.settingSection ? row.dataset.settingSection : '';
        const basePath = pane.dataset && pane.dataset.settingPath ? pane.dataset.settingPath : groupTitle;
        const path = section ? `${basePath} â€º ${section}` : basePath;
        let valueType = (row.dataset && row.dataset.settingType) || (control.dataset && control.dataset.settingType) || '';
        valueType = valueType ? valueType.toLowerCase() : '';
        if(!valueType){
          const tagName = control.tagName;
          if(tagName === 'SELECT'){
            valueType = 'enum';
          } else if(tagName === 'TEXTAREA'){
            valueType = 'string';
          } else if(tagName === 'INPUT'){
            const typeAttr = control.getAttribute('type');
            if(typeAttr === 'number' || typeAttr === 'range'){
              valueType = 'number';
            } else if(typeAttr === 'color'){
              valueType = 'color';
            } else {
              valueType = 'string';
            }
          } else if(tagName === 'BUTTON'){
            valueType = 'action';
          } else {
            valueType = 'string';
          }
        }
        const tags = parseList((row.dataset && row.dataset.settingTags) || '');
        const aliases = parseList((row.dataset && row.dataset.settingAliases) || '');
        const defaultValueAttr = row.dataset && row.dataset.settingDefault ? row.dataset.settingDefault : control.getAttribute('data-default');
        let defaultValue = null;
        if(defaultValueAttr !== null && defaultValueAttr !== undefined){
          if(valueType === 'number'){
            const numeric = Number(defaultValueAttr);
            defaultValue = Number.isFinite(numeric) ? numeric : null;
          } else if(valueType === 'boolean'){
            defaultValue = defaultValueAttr === 'true' || defaultValueAttr === '1';
          } else {
            defaultValue = defaultValueAttr;
          }
        } else {
          defaultValue = getControlValue(control, valueType);
        }
        const doc = {
          id: docId,
          title: title && title.trim() ? title.trim() : docId,
          desc: desc && desc.trim() ? desc.trim() : '',
          path,
          valueType,
          tags: tags.map(tag => tag.toLowerCase()),
          aliases,
          default: defaultValue,
          scope: (row.dataset && row.dataset.settingScope) || scope,
          isExperimental: row.dataset && row.dataset.settingExperimental === 'true',
          element: row,
          control,
          min: control.getAttribute('min') !== null ? Number(control.getAttribute('min')) : null,
          max: control.getAttribute('max') !== null ? Number(control.getAttribute('max')) : null,
          step: control.getAttribute('step') !== null && control.getAttribute('step') !== 'any' ? Number(control.getAttribute('step')) : null,
          currentValue: getControlValue(control, valueType)
        };
        documents.push(doc);
      });
    });
    return documents;
  }

  function decorateSettingDoc(doc, index){
    doc.index = index;
    doc.valueTypeNormalized = doc.valueType ? doc.valueType.toLowerCase() : 'string';
    doc.scopeNormalized = doc.scope ? doc.scope.toLowerCase() : 'global';
    doc.titleNormalized = normalizeSearchString(doc.title);
    doc.descNormalized = normalizeSearchString(doc.desc);
    doc.pathNormalized = normalizeSearchString(doc.path);
    doc.aliasTokens = doc.aliases.flatMap(tokenizeSearchText);
    doc.tagTokens = doc.tags.map(tag => normalizeSearchString(tag));
    doc.idTokens = tokenizeSearchText(doc.id.replace(/\./g, ' '));
    doc.pathDepth = doc.path && doc.path.includes('â€º') ? doc.path.split('â€º').length : (doc.path ? 1 : 0);
    doc.tokenFieldMap = new Map();
    doc.allTokens = new Set();
    tokenizeSearchText(doc.title).forEach(token => registerDocToken(doc, token, 'title'));
    tokenizeSearchText(doc.desc).forEach(token => registerDocToken(doc, token, 'desc'));
    tokenizeSearchText(doc.path).forEach(token => registerDocToken(doc, token, 'path'));
    doc.aliasTokens.forEach(token => registerDocToken(doc, token, 'aliases'));
    doc.tagTokens.forEach(token => registerDocToken(doc, token, 'tags'));
    doc.idTokens.forEach(token => registerDocToken(doc, token, 'aliases'));
    doc.usageCount = doc.usageCount || 0;
    doc.lastUsedAt = doc.lastUsedAt || 0;
  }

  function registerTrigrams(token){
    if(!token){
      return;
    }
    const normalized = token.toLowerCase();
    if(normalized.length < 3){
      if(!settingsSearchState.trigramIndex.has(normalized)){
        settingsSearchState.trigramIndex.set(normalized, new Set());
      }
      settingsSearchState.trigramIndex.get(normalized).add(normalized);
      return;
    }
    for(let i = 0; i <= normalized.length - 3; i++){
      const tri = normalized.slice(i, i + 3);
      if(!settingsSearchState.trigramIndex.has(tri)){
        settingsSearchState.trigramIndex.set(tri, new Set());
      }
      settingsSearchState.trigramIndex.get(tri).add(normalized);
    }
  }

  function buildSettingsSearchIndex(){
    settingsSearchState.invertedIndex.clear();
    settingsSearchState.tokenCatalog.clear();
    settingsSearchState.trigramIndex.clear();
    settingsSearchState.docs.forEach((doc, index)=>{
      decorateSettingDoc(doc, index);
      doc.allTokens.forEach((token)=>{
        settingsSearchState.tokenCatalog.add(token);
        registerTrigrams(token);
        if(!settingsSearchState.invertedIndex.has(token)){
          settingsSearchState.invertedIndex.set(token, new Set());
        }
        settingsSearchState.invertedIndex.get(token).add(index);
      });
    });
  }

  function buildTrigramsForQuery(token){
    const normalized = token.toLowerCase();
    if(normalized.length < 3){
      return [normalized];
    }
    const trigrams = [];
    for(let i = 0; i <= normalized.length - 3; i++){
      trigrams.push(normalized.slice(i, i + 3));
    }
    return trigrams;
  }

  function findFuzzyTokens(token){
    const normalized = token.toLowerCase();
    if(normalized.length < 5){
      return [];
    }
    const candidates = new Set();
    const trigrams = buildTrigramsForQuery(normalized);
    trigrams.forEach((tri)=>{
      const bucket = settingsSearchState.trigramIndex.get(tri);
      if(bucket){
        bucket.forEach((candidate)=> candidates.add(candidate));
      }
    });
    if(!candidates.size || candidates.size > settingsSearchState.tokenCatalog.size){
      settingsSearchState.tokenCatalog.forEach(tokenValue => candidates.add(tokenValue));
    }
    const matches = [];
    candidates.forEach((candidate)=>{
      if(Math.abs(candidate.length - normalized.length) > 2){
        return;
      }
      let distance = 0;
      const dp = Array(normalized.length + 1);
      for(let i = 0; i <= normalized.length; i++){
        dp[i] = i;
      }
      for(let j = 1; j <= candidate.length; j++){
        let prev = dp[0];
        dp[0] = j;
        for(let i = 1; i <= normalized.length; i++){
          const temp = dp[i];
          if(normalized[i - 1] === candidate[j - 1]){
            dp[i] = prev;
          } else {
            dp[i] = Math.min(prev + 1, dp[i] + 1, dp[i - 1] + 1);
          }
          prev = temp;
        }
      }
      distance = dp[normalized.length];
      if(distance <= 1){
        matches.push({ token: candidate, distance });
      }
    });
    return matches;
  }

  function parseSearchQuery(query){
    const raw = typeof query === 'string' ? query : '';
    const parts = raw.trim().split(/\s+/).filter(Boolean);
    const filters = { type: '', scope: '', tags: [], experimental: null };
    const tokens = [];
    parts.forEach((part)=>{
      const idx = part.indexOf(':');
      if(idx > 0){
        const key = part.slice(0, idx).toLowerCase();
        const value = part.slice(idx + 1).toLowerCase();
        if(key === 'type' || key === 'value' || key === 'kind'){
          filters.type = value;
          return;
        }
        if(key === 'scope'){ filters.scope = value; return; }
        if(key === 'tag' || key === 'tags'){ filters.tags.push(value); return; }
        if(key === 'experimental'){
          filters.experimental = value === 'true' || value === '1';
          return;
        }
      }
      tokens.push(part);
    });
    const normalizedTokens = tokens.flatMap(tokenizeSearchText);
    return { raw, tokens: normalizedTokens, filters };
  }

  function gatherCandidateDocs(tokens){
    const indices = new Set();
    const fuzzyMatches = new Map();
    tokens.forEach((token)=>{
      const bucket = settingsSearchState.invertedIndex.get(token);
      if(bucket && bucket.size){
        bucket.forEach((index)=> indices.add(index));
        return;
      }
      const fuzzy = findFuzzyTokens(token);
      if(fuzzy.length){
        fuzzyMatches.set(token, fuzzy);
        fuzzy.forEach((entry)=>{
          const fuzzyBucket = settingsSearchState.invertedIndex.get(entry.token);
          if(fuzzyBucket){
            fuzzyBucket.forEach((index)=> indices.add(index));
          }
        });
      }
    });
    if(!indices.size){
      settingsSearchState.docs.forEach((_, index)=> indices.add(index));
    }
    return { indices: Array.from(indices), fuzzyMatches };
  }

  function passesFilters(doc, filters){
    if(!filters){
      return true;
    }
    if(filters.type){
      const type = filters.type.toLowerCase();
      if(doc.valueTypeNormalized !== type){
        if(type === 'boolean' && doc.valueTypeNormalized !== 'boolean'){ return false; }
        else if(type === 'number' && doc.valueTypeNormalized !== 'number'){ return false; }
        else if(type === 'string' && doc.valueTypeNormalized !== 'string'){ return false; }
        else if(type === 'enum' && doc.valueTypeNormalized !== 'enum'){ return false; }
      }
    }
    if(filters.scope){
      const scope = filters.scope.toLowerCase();
      if(doc.scopeNormalized !== scope){
        return false;
      }
    }
    if(filters.tags && filters.tags.length){
      for(const tag of filters.tags){
        if(!doc.tagTokens.includes(tag.toLowerCase())){
          return false;
        }
      }
    }
    if(filters.experimental !== null){
      if(Boolean(doc.isExperimental) !== Boolean(filters.experimental)){
        return false;
      }
    }
    return true;
  }

  function weightForFields(fieldSet){
    if(!fieldSet || !fieldSet.size){
      return 0;
    }
    let weight = 0;
    fieldSet.forEach((field)=>{
      const fieldWeight = SETTINGS_SEARCH_FIELD_WEIGHTS[field] || 0;
      if(fieldWeight > weight){
        weight = fieldWeight;
      }
    });
    return weight;
  }

  function computeUsageBoost(doc){
    if(!doc || !doc.usageCount){
      return 0;
    }
    return Math.min(6, Math.log2(doc.usageCount + 1) * 1.5);
  }

  function computeRecencyBoost(doc){
    if(!doc || !doc.lastUsedAt){
      return 0;
    }
    const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const seconds = Math.max(0, (now - doc.lastUsedAt) / 1000);
    if(seconds < 5){ return 6; }
    if(seconds < 30){ return 4; }
    if(seconds < 120){ return 2; }
    if(seconds < 600){ return 1; }
    return 0;
  }

  function scoreDoc(doc, tokens, fuzzyMatches){
    let score = 0;
    const titleRanges = [];
    const descRanges = [];
    let exactMatchCount = 0;
    const consideredTokens = tokens.length ? tokens : Array.from(doc.allTokens || []);
    for(const token of consideredTokens){
      const hasToken = doc.allTokens && doc.allTokens.has(token);
      if(hasToken){
        const fields = doc.tokenFieldMap.get(token) || new Set();
        const weight = weightForFields(fields);
        if(weight){
          score += weight;
        }
        if(fields.has('title')){
          titleRanges.push(...findAllOccurrences(doc.titleNormalized, token));
        }
        if(fields.has('desc')){
          descRanges.push(...findAllOccurrences(doc.descNormalized, token));
        }
        exactMatchCount += 1;
        continue;
      }
      const fuzzyForToken = fuzzyMatches.get(token);
      if(fuzzyForToken){
        for(const match of fuzzyForToken){
          if(doc.allTokens && doc.allTokens.has(match.token)){
            const fields = doc.tokenFieldMap.get(match.token) || new Set();
            const weight = weightForFields(fields);
            if(weight){
              score += weight * 0.65;
            }
            if(fields.has('title')){
              titleRanges.push(...findAllOccurrences(doc.titleNormalized, match.token));
            }
            if(fields.has('desc')){
              descRanges.push(...findAllOccurrences(doc.descNormalized, match.token));
            }
            break;
          }
        }
      }
    }
    score += computeUsageBoost(doc);
    score += computeRecencyBoost(doc);
    if(exactMatchCount){
      score += exactMatchCount * 0.5;
    }
    return { score, titleRanges: mergeRanges(titleRanges), descRanges: mergeRanges(descRanges) };
  }

  function buildFacetsFromDocs(documents){
    const facets = { tags: new Map(), types: new Map(), scopes: new Map() };
    documents.forEach((doc)=>{
      doc.tags.forEach((tag)=>{
        const key = tag.toLowerCase();
        facets.tags.set(key, (facets.tags.get(key) || 0) + 1);
      });
      const type = doc.valueTypeNormalized || 'string';
      facets.types.set(type, (facets.types.get(type) || 0) + 1);
      const scope = doc.scopeNormalized || 'global';
      facets.scopes.set(scope, (facets.scopes.get(scope) || 0) + 1);
    });
    const toArray = (map, labelTransform = (value)=> value) => Array.from(map.entries())
      .sort((a, b)=> b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([value, count])=> ({ value, label: labelTransform(value), count }));
    return {
      tags: toArray(facets.tags, (value)=> value.replace(/\b\w/g, (m)=> m.toUpperCase())),
      types: toArray(facets.types, (value)=> value.charAt(0).toUpperCase() + value.slice(1)),
      scopes: toArray(facets.scopes, (value)=> value.charAt(0).toUpperCase() + value.slice(1))
    };
  }

  function computeDidYouMean(parsed, fuzzyMatches){
    if(!parsed || !parsed.tokens.length){
      return null;
    }
    const suggestions = [];
    let changed = false;
    parsed.tokens.forEach((token)=>{
      const fuzzies = fuzzyMatches.get(token);
      if(fuzzies && fuzzies.length){
        const best = fuzzies.reduce((winner, entry)=>{
          if(!winner || entry.distance < winner.distance){
            return entry;
          }
          return winner;
        }, null);
        if(best && best.token){
          suggestions.push(best.token);
          if(best.token !== token){
            changed = true;
          }
          return;
        }
      }
      suggestions.push(token);
    });
    if(!changed){
      return null;
    }
    return suggestions.join(' ');
  }

  function searchSettings(query, opts = {}){
    const limit = Number.isFinite(opts.limit) ? opts.limit : SETTINGS_SEARCH_RESULT_LIMIT;
    const cacheKey = normalizeSearchString(query);
    let parsed = settingsSearchState.queryCache.get(cacheKey);
    if(!parsed){
      parsed = parseSearchQuery(query || '');
      settingsSearchState.queryCache.set(cacheKey, parsed);
      settingsSearchState.cacheOrder.unshift(cacheKey);
      if(settingsSearchState.cacheOrder.length > SETTINGS_SEARCH_CACHE_LIMIT){
        const staleKey = settingsSearchState.cacheOrder.pop();
        settingsSearchState.queryCache.delete(staleKey);
      }
    } else {
      const index = settingsSearchState.cacheOrder.indexOf(cacheKey);
      if(index >= 0){
        settingsSearchState.cacheOrder.splice(index, 1);
      }
      settingsSearchState.cacheOrder.unshift(cacheKey);
    }

    const t0 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const { indices, fuzzyMatches } = gatherCandidateDocs(parsed.tokens);
    const hits = [];
    indices.forEach((index)=>{
      const doc = settingsSearchState.docs[index];
      if(!doc){
        return;
      }
      if(!passesFilters(doc, parsed.filters)){
        return;
      }
      const { score, titleRanges, descRanges } = scoreDoc(doc, parsed.tokens, fuzzyMatches);
      if(parsed.tokens.length && score <= 0){
        return;
      }
      hits.push({
        doc,
        score,
        titleRanges,
        descRanges
      });
    });
    hits.sort((a, b)=>{
      if(b.score !== a.score){
        return b.score - a.score;
      }
      if(a.doc.pathDepth !== b.doc.pathDepth){
        return a.doc.pathDepth - b.doc.pathDepth;
      }
      return a.doc.title.localeCompare(b.doc.title);
    });
    const total = hits.length;
    const limited = hits.slice(0, Math.max(1, limit)).map((entry, rank)=> ({
      id: entry.doc.id,
      title: entry.doc.title,
      desc: entry.doc.desc,
      path: entry.doc.path,
      valueType: entry.doc.valueType,
      scope: entry.doc.scope,
      tags: entry.doc.tags.slice(),
      isExperimental: entry.doc.isExperimental,
      score: entry.score,
      highlight: { title: entry.titleRanges, desc: entry.descRanges },
      deepLink: `/settings#${encodeURIComponent(entry.doc.id)}`,
      rank: rank + 1,
      doc: entry.doc
    }));
    const facets = buildFacetsFromDocs(hits.map(hit => hit.doc));
    const elapsedMs = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - t0;
    const didYouMean = total === 0 ? computeDidYouMean(parsed, fuzzyMatches) : null;
    return { results: limited, total, facets, didYouMean, elapsedMs, tokens: parsed.tokens, filters: parsed.filters, raw: parsed.raw };
  }


  function disposeSettingsControlSubscriptions(){
    settingsSearchState.controlSubscriptions.forEach((sub)=>{
      if(sub.control){
        if(sub.input){ sub.control.removeEventListener('input', sub.input); }
        if(sub.change){ sub.control.removeEventListener('change', sub.change); }
      }
    });
    settingsSearchState.controlSubscriptions.length = 0;
  }

  function markSettingUsed(doc, { trackUsage = true } = {}){
    if(!doc){
      return;
    }
    if(trackUsage){
      doc.usageCount = (doc.usageCount || 0) + 1;
    }
    doc.lastUsedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  function attachSettingsControlSubscriptions(){
    disposeSettingsControlSubscriptions();
    settingsSearchState.docs.forEach((doc)=>{
      const control = doc.control;
      if(!control){
        return;
      }
      const handleInput = ()=>{
        doc.currentValue = getControlValue(control, doc.valueTypeNormalized);
        updateSearchResultValue(doc);
      };
      const handleChange = ()=>{
        doc.currentValue = getControlValue(control, doc.valueTypeNormalized);
        markSettingUsed(doc);
        updateSearchResultValue(doc);
      };
      control.addEventListener('input', handleInput);
      control.addEventListener('change', handleChange);
      settingsSearchState.controlSubscriptions.push({ control, input: handleInput, change: handleChange });
    });
  }

  function rebuildSettingsSearchIndex(){
    settingsSearchState.docs = collectSettingsDocuments();
    settingsSearchState.docById.clear();
    settingsSearchState.docs.forEach((doc)=>{
      settingsSearchState.docById.set(doc.id, doc);
    });
    buildSettingsSearchIndex();
    attachSettingsControlSubscriptions();
  }

  function ensureRecentQueriesContains(query){
    const trimmed = (query || '').trim();
    if(!trimmed){
      return;
    }
    const lower = trimmed.toLowerCase();
    const index = settingsSearchState.recentQueries.findIndex((entry)=> entry.toLowerCase() === lower);
    if(index >= 0){
      settingsSearchState.recentQueries.splice(index, 1);
    }
    settingsSearchState.recentQueries.unshift(trimmed);
    if(settingsSearchState.recentQueries.length > SETTINGS_SEARCH_RECENT_LIMIT){
      settingsSearchState.recentQueries.length = SETTINGS_SEARCH_RECENT_LIMIT;
    }
  }

  function updateSearchResultValue(doc){
    const entry = settingsSearchState.resultElements.get(doc.id);
    if(!entry){
      return;
    }
    if(entry.slider){
      const value = doc.currentValue;
      if(value !== null && value !== undefined){
        entry.slider.value = String(value);
      }
    }
    if(entry.number){
      const value = doc.currentValue;
      if(value !== null && value !== undefined){
        entry.number.value = String(value);
      }
    }
    if(entry.valueLabel){
      entry.valueLabel.textContent = formatSettingValue(doc, doc.currentValue);
    }
  }

  let settingsSearchDebounceHandle = null;
  let settingsSearchPreviousFocus = null;

  function renderSettingsFacets(facets){
    if(!settingsSearchFacetsEl){
      return;
    }
    settingsSearchFacetsEl.innerHTML = '';
    if(!facets){
      return;
    }
    const createChip = (label, kind, value, count)=>{
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'settingsSearchFacet';
      chip.dataset.kind = kind;
      chip.dataset.value = value;
      chip.innerHTML = `${escapeHtml(label)}<span aria-hidden="true"> Â· ${count}</span>`;
      chip.addEventListener('click', ()=> applyFacetFilter(kind, value));
      return chip;
    };
    const fragment = document.createDocumentFragment();
    (facets.tags || []).forEach(entry => fragment.appendChild(createChip(entry.label, 'tag', entry.value, entry.count)));
    (facets.types || []).forEach(entry => fragment.appendChild(createChip(entry.label, 'type', entry.value, entry.count)));
    (facets.scopes || []).forEach(entry => fragment.appendChild(createChip(entry.label, 'scope', entry.value, entry.count)));
    settingsSearchFacetsEl.appendChild(fragment);
  }

  function renderSettingsRecents(){
    if(!settingsSearchRecentsEl){
      return;
    }
    settingsSearchRecentsEl.innerHTML = '';
    if(!settingsSearchState.recentQueries.length){
      return;
    }
    const fragment = document.createDocumentFragment();
    settingsSearchState.recentQueries.slice(0, 6).forEach((query)=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'settingsSearchRecentQuery';
      btn.textContent = query;
      btn.addEventListener('click', ()=>{
        if(settingsSearchInput){
          settingsSearchInput.value = query;
          scheduleSettingsSearch(query);
          settingsSearchInput.focus();
        }
      });
      fragment.appendChild(btn);
    });
    settingsSearchRecentsEl.appendChild(fragment);
  }

  function renderSettingsSearchResults(payload){
    if(!settingsSearchResultsEl || !settingsSearchEmptyEl || !settingsSearchStatusEl){
      return;
    }
    settingsSearchState.results = payload.results || [];
    settingsSearchState.tokens = payload.tokens || [];
    settingsSearchState.resultElements.clear();
    settingsSearchResultsEl.innerHTML = '';
    const listFragment = document.createDocumentFragment();
    if(settingsSearchInput){
      settingsSearchInput.setAttribute('aria-expanded', settingsSearchState.results.length ? 'true' : 'false');
    }
    if(settingsSearchState.results.length){
      settingsSearchEmptyEl.hidden = true;
      settingsSearchResultsEl.removeAttribute('hidden');
      settingsSearchState.results.forEach((hit)=>{
        const doc = hit.doc;
        const option = document.createElement('div');
        option.className = 'settingsSearchResult';
        const optionId = `settingsSearchOption-${doc.id.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
        option.id = optionId;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        option.dataset.docId = doc.id;
        const main = document.createElement('div');
        main.className = 'settingsSearchResultMain';
        const title = document.createElement('div');
        title.className = 'settingsSearchResultTitle';
        title.innerHTML = highlightText(doc.title, hit.highlight && hit.highlight.title || []);
        const path = document.createElement('div');
        path.className = 'settingsSearchResultPath';
        path.textContent = doc.path;
        const desc = document.createElement('div');
        desc.className = 'settingsSearchResultDesc';
        const descText = doc.desc || '';
        desc.innerHTML = highlightText(descText.length > 240 ? `${descText.slice(0, 237)}â€¦` : descText, hit.highlight && hit.highlight.desc || []);
        main.appendChild(title);
        main.appendChild(path);
        if(descText){
          main.appendChild(desc);
        }
        const action = document.createElement('div');
        action.className = 'settingsSearchResultAction';
        const valueLabel = document.createElement('span');
        valueLabel.className = 'settingsSearchResultValue';
        valueLabel.textContent = formatSettingValue(doc, doc.currentValue);
        action.appendChild(valueLabel);
        let slider = null;
        let number = null;
        if(doc.valueTypeNormalized === 'number' && doc.min !== null && doc.max !== null){
          slider = document.createElement('input');
          slider.type = 'range';
          slider.className = 'settingsSearchResultSlider';
          slider.min = Number.isFinite(doc.min) ? String(doc.min) : '0';
          slider.max = Number.isFinite(doc.max) ? String(doc.max) : '100';
          if(Number.isFinite(doc.step) && doc.step > 0){
            slider.step = String(doc.step);
          }
          if(doc.currentValue !== null && doc.currentValue !== undefined){
            slider.value = String(doc.currentValue);
          }
          number = document.createElement('input');
          number.type = 'number';
          number.className = 'settingsSearchResultNumber';
          if(Number.isFinite(doc.min)) number.min = String(doc.min);
          if(Number.isFinite(doc.max)) number.max = String(doc.max);
          if(Number.isFinite(doc.step) && doc.step > 0) number.step = String(doc.step);
          if(doc.currentValue !== null && doc.currentValue !== undefined){
            number.value = String(doc.currentValue);
          }
          slider.addEventListener('input', ()=>{
            number.value = slider.value;
            setControlValue(doc.control, slider.value, 'number');
            doc.currentValue = getControlValue(doc.control, 'number');
            valueLabel.textContent = formatSettingValue(doc, doc.currentValue);
          });
          slider.addEventListener('change', ()=>{
            setControlValue(doc.control, slider.value, 'number', { commit: true });
            doc.currentValue = getControlValue(doc.control, 'number');
            markSettingUsed(doc);
            valueLabel.textContent = formatSettingValue(doc, doc.currentValue);
          });
          number.addEventListener('change', ()=>{
            const numeric = clampNumericForControl(doc.control, number.value);
            slider.value = String(numeric);
            number.value = String(numeric);
            setControlValue(doc.control, numeric, 'number', { commit: true });
            doc.currentValue = getControlValue(doc.control, 'number');
            markSettingUsed(doc);
            valueLabel.textContent = formatSettingValue(doc, doc.currentValue);
          });
          action.appendChild(slider);
          action.appendChild(number);
        } else if(doc.valueTypeNormalized === 'boolean'){
          const toggleBtn = document.createElement('button');
          toggleBtn.type = 'button';
          toggleBtn.className = 'settingsSearchResultToggle';
          const setLabel = ()=>{
            const current = getControlValue(doc.control, 'boolean');
            toggleBtn.textContent = current ? 'Turn off' : 'Turn on';
          };
          setLabel();
          toggleBtn.addEventListener('click', ()=>{
            setControlValue(doc.control, null, 'boolean', { commit: true });
            doc.currentValue = getControlValue(doc.control, 'boolean');
            markSettingUsed(doc);
            setLabel();
            valueLabel.textContent = formatSettingValue(doc, doc.currentValue);
          });
          action.appendChild(toggleBtn);
        } else {
          const openBtn = document.createElement('button');
          openBtn.type = 'button';
          openBtn.className = 'settingsSearchResultToggle';
          openBtn.textContent = 'Open';
          openBtn.addEventListener('click', ()=>{
            activateSettingsSearchResultByDocId(doc.id, { toggle: false });
          });
          action.appendChild(openBtn);
        }
        option.appendChild(main);
        option.appendChild(action);
        option.addEventListener('mouseenter', ()=>{
          const idx = settingsSearchState.results.findIndex(entry => entry.doc.id === doc.id);
          if(idx >= 0){
            setSettingsSearchActive(idx);
          }
        });
        option.addEventListener('click', (ev)=>{
          ev.preventDefault();
          const idx = settingsSearchState.results.findIndex(entry => entry.doc.id === doc.id);
          if(idx >= 0){
            activateSettingsSearchResult(idx, { toggle: ev.altKey });
          }
        });
        settingsSearchState.resultElements.set(doc.id, { element: option, slider, number, valueLabel });
        listFragment.appendChild(option);
      });
      settingsSearchResultsEl.appendChild(listFragment);
      setSettingsSearchActive(0);
    } else {
      settingsSearchResultsEl.setAttribute('hidden', 'true');
      settingsSearchEmptyEl.hidden = false;
      settingsSearchEmptyPrimary.textContent = 'No settings found.';
      settingsSearchEmptySecondary.innerHTML = '';
      if(payload.didYouMean){
        const span = document.createElement('span');
        span.textContent = 'Did you mean';
        const suggestion = document.createElement('button');
        suggestion.type = 'button';
        suggestion.className = 'settingsSearchResultToggle';
        suggestion.textContent = payload.didYouMean;
        suggestion.addEventListener('click', ()=>{
          if(settingsSearchInput){
            settingsSearchInput.value = payload.didYouMean;
            scheduleSettingsSearch(payload.didYouMean);
            settingsSearchInput.focus();
          }
        });
        settingsSearchEmptySecondary.appendChild(span);
        settingsSearchEmptySecondary.appendChild(document.createTextNode(' '));
        settingsSearchEmptySecondary.appendChild(suggestion);
        settingsSearchEmptySecondary.appendChild(document.createTextNode('?'));
      } else {
        settingsSearchEmptySecondary.textContent = 'Try a different keyword or add a filter such as tag:camera.';
      }
    }
    const summary = payload.total ? `${Math.min(payload.results.length, payload.total)} of ${payload.total} results` : '0 results';
    const timing = Number.isFinite(payload.elapsedMs) ? ` Â· ${Math.max(0, Math.round(payload.elapsedMs)).toLocaleString()}ms` : '';
    settingsSearchStatusEl.textContent = `${summary}${timing}`;
    settingsSearchState.lastRenderQuery = payload.raw || (settingsSearchInput ? settingsSearchInput.value : '');
    renderSettingsFacets(payload.facets);
    renderSettingsRecents();
  }

  function applyFacetFilter(kind, value){
    if(!settingsSearchInput){
      return;
    }
    let filter = '';
    if(kind === 'tag'){ filter = `tag:${value}`; }
    else if(kind === 'type'){ filter = `type:${value}`; }
    else if(kind === 'scope'){ filter = `scope:${value}`; }
    if(!filter){
      return;
    }
    const base = settingsSearchInput.value.trim();
    const next = base ? `${base} ${filter}` : filter;
    settingsSearchInput.value = next;
    scheduleSettingsSearch(next);
    settingsSearchInput.focus();
  }

  function setSettingsSearchActive(index){
    if(!settingsSearchState.results.length){
      settingsSearchState.activeIndex = -1;
      if(settingsSearchInput){
        settingsSearchInput.setAttribute('aria-activedescendant', '');
      }
      return;
    }
    const clamped = Math.max(0, Math.min(settingsSearchState.results.length - 1, index));
    settingsSearchState.activeIndex = clamped;
    settingsSearchState.results.forEach((hit, idx)=>{
      const entry = settingsSearchState.resultElements.get(hit.doc.id);
      if(entry && entry.element){
        if(idx === clamped){
          entry.element.setAttribute('aria-selected', 'true');
          if(settingsSearchInput){
            settingsSearchInput.setAttribute('aria-activedescendant', entry.element.id);
          }
          entry.element.scrollIntoView({ block: 'nearest' });
        } else {
          entry.element.setAttribute('aria-selected', 'false');
        }
      }
    });
  }

  function moveSettingsSearchActive(delta){
    if(!settingsSearchState.results.length){
      return;
    }
    const nextIndex = settingsSearchState.activeIndex + delta;
    if(nextIndex < 0){
      setSettingsSearchActive(settingsSearchState.results.length - 1);
    } else if(nextIndex >= settingsSearchState.results.length){
      setSettingsSearchActive(0);
    } else {
      setSettingsSearchActive(nextIndex);
    }
  }

  function activateSettingsSearchResultByDocId(docId, { toggle = false } = {}){
    const index = settingsSearchState.results.findIndex(hit => hit.doc.id === docId);
    if(index >= 0){
      activateSettingsSearchResult(index, { toggle });
    }
  }

  function activateSettingsSearchResult(index, { toggle = false } = {}){
    if(index < 0 || index >= settingsSearchState.results.length){
      return;
    }
    const hit = settingsSearchState.results[index];
    ensureRecentQueriesContains(settingsSearchInput ? settingsSearchInput.value : '');
    renderSettingsRecents();
    openSettingFromSearch(hit, { toggle });
  }

  function openSettingFromSearch(hit, { toggle = false } = {}){
    if(!hit || !hit.doc){
      return;
    }
    const doc = hit.doc;
    if(toggle && doc.valueTypeNormalized === 'boolean'){
      setControlValue(doc.control, null, 'boolean', { commit: true });
      doc.currentValue = getControlValue(doc.control, 'boolean');
      markSettingUsed(doc);
      updateSearchResultValue(doc);
      return;
    }
    if(expandMenu){ expandMenu('expanded'); }
    const pane = doc.element ? doc.element.closest('.submenu') : null;
    if(pane){
      pane.classList.add('open');
      const trigger = pane.previousElementSibling;
      if(trigger && trigger.classList && trigger.classList.contains('btn')){
        trigger.setAttribute('aria-expanded', 'true');
      }
    }
    if(doc.element && typeof doc.element.scrollIntoView === 'function'){
      doc.element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    if(doc.control && typeof doc.control.focus === 'function'){
      doc.control.focus({ preventScroll: true });
    }
    markSettingUsed(doc);
    const help = deriveSettingHelp(doc.element) || deriveSettingHelp(doc.control);
    if(help){
      showSettingHelp(help.title, help.text);
    }
    closeSettingsSearch({ restoreFocus: false });
  }

  function closeSettingsSearch({ restoreFocus = true } = {}){
    if(!settingsSearchOverlay){
      return;
    }
    if(settingsSearchDebounceHandle){
      clearTimeout(settingsSearchDebounceHandle);
      settingsSearchDebounceHandle = null;
    }
    settingsSearchOverlay.setAttribute('data-open', 'false');
    settingsSearchOverlay.setAttribute('aria-hidden', 'true');
    settingsSearchState.open = false;
    settingsSearchState.activeIndex = -1;
    settingsSearchState.resultElements.clear();
    if(settingsSearchInput){
      settingsSearchInput.setAttribute('aria-expanded', 'false');
      settingsSearchInput.setAttribute('aria-activedescendant', '');
    }
    toggleSettingsSearchHelp(false);
    if(restoreFocus && settingsSearchPreviousFocus && typeof settingsSearchPreviousFocus.focus === 'function'){
      settingsSearchPreviousFocus.focus();
    }
    settingsSearchPreviousFocus = null;
  }

  function openSettingsSearch({ query = '', focus = true } = {}){
    if(!settingsSearchOverlay || !settingsSearchInput){
      return;
    }
    rebuildSettingsSearchIndex();
    settingsSearchPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    settingsSearchOverlay.setAttribute('data-open', 'true');
    settingsSearchOverlay.setAttribute('aria-hidden', 'false');
    settingsSearchState.open = true;
    if(query !== undefined && query !== null){
      settingsSearchInput.value = query;
    }
    if(focus){
      settingsSearchInput.focus();
      settingsSearchInput.select();
    }
    scheduleSettingsSearch(settingsSearchInput.value);
  }

  function toggleSettingsSearchHelp(force){
    if(!settingsSearchHelpEl || !settingsSearchHelpBtn){
      return;
    }
    const shouldShow = typeof force === 'boolean' ? force : settingsSearchHelpEl.hasAttribute('hidden');
    if(shouldShow){
      settingsSearchHelpEl.removeAttribute('hidden');
      settingsSearchHelpBtn.setAttribute('aria-expanded', 'true');
    } else {
      settingsSearchHelpEl.setAttribute('hidden', 'true');
      settingsSearchHelpBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function scheduleSettingsSearch(query){
    if(settingsSearchDebounceHandle){
      clearTimeout(settingsSearchDebounceHandle);
    }
    const requestId = ++settingsSearchState.requestId;
    settingsSearchDebounceHandle = setTimeout(()=>{
      const payload = searchSettings(query || '', { limit: SETTINGS_SEARCH_RESULT_LIMIT });
      if(requestId === settingsSearchState.requestId){
        renderSettingsSearchResults(payload);
      }
    }, SETTINGS_SEARCH_DEBOUNCE_MS);
  }

  function handleSettingsSearchInput(){
    if(!settingsSearchInput){
      return;
    }
    scheduleSettingsSearch(settingsSearchInput.value);
  }

  function handleSettingsSearchInputKeydown(ev){
    if(ev.key === 'ArrowDown'){
      ev.preventDefault();
      moveSettingsSearchActive(1);
      return;
    }
    if(ev.key === 'ArrowUp'){
      ev.preventDefault();
      moveSettingsSearchActive(-1);
      return;
    }
    if(ev.key === 'Enter'){
      ev.preventDefault();
      if(settingsSearchState.activeIndex >= 0){
        activateSettingsSearchResult(settingsSearchState.activeIndex, { toggle: ev.altKey });
      } else if(settingsSearchState.results.length){
        activateSettingsSearchResult(0, { toggle: ev.altKey });
      }
      return;
    }
    if(ev.key === 'Escape'){
      ev.preventDefault();
      closeSettingsSearch();
      return;
    }
    if(ev.key === '?' && ev.shiftKey){
      ev.preventDefault();
      toggleSettingsSearchHelp();
      return;
    }
  }

  function handleGlobalSettingsSearchKeydown(ev){
    const key = ev.key ? ev.key.toLowerCase() : '';
    const meta = ev.metaKey || ev.ctrlKey;
    const target = ev.target;
    const isEditable = target && target instanceof HTMLElement && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
    if(meta && key === 'k'){
      ev.preventDefault();
      if(settingsSearchState.open){
        closeSettingsSearch();
      } else {
        openSettingsSearch({ query: settingsSearchInput ? settingsSearchInput.value : '', focus: true });
      }
      return;
    }
    if(settingsSearchState.open && key === 'escape'){
      ev.preventDefault();
      closeSettingsSearch();
      return;
    }
    if(!settingsSearchState.open && !meta && !isEditable && ev.key === '?' && ev.shiftKey){
      ev.preventDefault();
      openSettingsSearch({ query: '', focus: true });
      toggleSettingsSearchHelp(true);
    }
  }

  function initializeSettingsSearch(){
    if(!settingsSearchOverlay || !settingsSearchInput){
      return;
    }
    rebuildSettingsSearchIndex();
    document.addEventListener('keydown', handleGlobalSettingsSearchKeydown);
    settingsSearchOverlay.addEventListener('click', (ev)=>{
      if(ev.target === settingsSearchOverlay){
        closeSettingsSearch();
      }
    });
    settingsSearchInput.addEventListener('input', handleSettingsSearchInput);
    settingsSearchInput.addEventListener('keydown', handleSettingsSearchInputKeydown);
    if(settingsSearchHelpBtn){
      settingsSearchHelpBtn.addEventListener('click', ()=> toggleSettingsSearchHelp());
    }
    if(settingsSearchHelpClose){
      settingsSearchHelpClose.addEventListener('click', ()=> toggleSettingsSearchHelp(false));
    }
    if(settingsSearchAskBtn){
      settingsSearchAskBtn.addEventListener('click', ()=> toggleSettingsSearchHelp(true));
    }
  }


  return {
    searchSettings,
    initializeSettingsSearch,
    openSettingsSearch,
    closeSettingsSearch,
    renderSettingsSearchResults,
    rebuildSettingsSearchIndex
  };
}
