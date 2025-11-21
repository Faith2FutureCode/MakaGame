export function initMobaSettingsMenu({ sbContent, settingsGenreSelect, syncMenuMeasurements } = {}) {
  const settingsMenuSections = (() => {
    if (!sbContent) {
      return [];
    }
    const buttons = Array.from(sbContent.children || []).filter((node) => {
      return node && node.classList && node.classList.contains('btn');
    });
    return buttons.map((btn) => {
      const nodes = [btn];
      let sibling = btn.nextElementSibling;
      while (sibling && !sibling.classList.contains('btn')) {
        nodes.push(sibling);
        sibling = sibling.nextElementSibling;
      }
      return { genre: btn.dataset.settingsGenre || 'core', nodes };
    });
  })();

  function applySettingsGenreFilter(value) {
    if (!settingsMenuSections.length) {
      return;
    }
    const selected = value || 'core';
    settingsMenuSections.forEach((section) => {
      const visible = section.genre === selected;
      section.nodes.forEach((node) => {
        if (!node) return;
        if (!visible && node.classList && node.classList.contains('submenu')) {
          node.classList.remove('open');
        }
        node.classList.toggle('genre-hidden', !visible);
      });
    });
    if (typeof requestAnimationFrame === 'function' && typeof syncMenuMeasurements === 'function') {
      requestAnimationFrame(syncMenuMeasurements);
    }
  }

  if (settingsGenreSelect) {
    settingsGenreSelect.addEventListener('change', () => {
      applySettingsGenreFilter(settingsGenreSelect.value);
    });
    applySettingsGenreFilter(settingsGenreSelect.value || 'core');
  } else {
    applySettingsGenreFilter('core');
  }

  return { applySettingsGenreFilter, settingsMenuSections };
}
