export function initSettingsPanel({
  app,
  sbHide,
  sbFab,
  submenuPairs,
  syncMenuMeasurements,
  playerRuntime
}){
  if(!app || typeof syncMenuMeasurements !== 'function'){
    return;
  }
  const MENU_STATES = ['expanded', 'collapsed', 'hidden'];
  function getMenuState(){
    if(app.getAttribute('data-hidden') === 'true') return 'hidden';
    return app.getAttribute('data-collapsed') === 'true' ? 'collapsed' : 'expanded';
  }
  function setMenuState(state){
    if(!MENU_STATES.includes(state)) return;
    const collapsed = state !== 'expanded';
    const hidden = state === 'hidden';
    app.setAttribute('data-collapsed', String(collapsed));
    app.setAttribute('data-hidden', String(hidden));
    if(sbHide){ sbHide.setAttribute('aria-expanded', hidden ? 'false' : 'true'); }
    syncMenuMeasurements();
    requestAnimationFrame(syncMenuMeasurements);
  }
  if(sbHide){ sbHide.addEventListener('click', () => setMenuState('hidden')); }
  if(sbFab){ sbFab.addEventListener('click', () => setMenuState('expanded')); }
  setMenuState(getMenuState());
  app.addEventListener('transitionend', (ev) => {
    if(ev.propertyName === 'grid-template-columns'){
      requestAnimationFrame(syncMenuMeasurements);
    }
  });

  function toggleSubmenu(pane){
    if(!pane) return;
    pane.classList.toggle('open');
    syncMenuMeasurements();
    requestAnimationFrame(syncMenuMeasurements);
  }

  (submenuPairs || []).forEach((entry) => {
    if(!entry) return;
    const { button, pane, onToggle } = entry;
    if(!button || !pane) return;
    button.addEventListener('click', () => {
      toggleSubmenu(pane);
      if(typeof onToggle === 'function'){
        requestAnimationFrame(() => onToggle({ playerRuntime }));
      }
    });
  });

  return { setMenuState, getMenuState };
}
