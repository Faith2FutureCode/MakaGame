export function createSettingHelp({ settingHelpEl, settingHelpTitle, settingHelpBody, sidebarEl }) {
  const DEFAULT_SETTING_HELP = {
    title: 'Settings',
    text: 'Hover a control to learn what it does.'
  };
  let activeSettingHelpSource = null;

  function showSettingHelp(title, text) {
    if (!settingHelpEl) {
      return;
    }
    const finalTitle = title && title.trim() ? title : DEFAULT_SETTING_HELP.title;
    const finalText = text && text.trim() ? text : DEFAULT_SETTING_HELP.text;
    if (settingHelpTitle) {
      settingHelpTitle.textContent = finalTitle;
    }
    if (settingHelpBody) {
      settingHelpBody.textContent = finalText;
    }
    settingHelpEl.classList.add('show');
  }

  function hideSettingHelp(source) {
    if (source && activeSettingHelpSource && source !== activeSettingHelpSource) {
      return;
    }
    activeSettingHelpSource = null;
    if (!settingHelpEl) {
      return;
    }
    settingHelpEl.classList.remove('show');
    if (settingHelpTitle) {
      settingHelpTitle.textContent = DEFAULT_SETTING_HELP.title;
    }
    if (settingHelpBody) {
      settingHelpBody.textContent = DEFAULT_SETTING_HELP.text;
    }
  }

  function deriveSettingHelp(el) {
    if (!el || el === settingHelpEl) {
      return null;
    }
    let title = el.getAttribute('data-help-title');
    let text = el.getAttribute('data-help-text');
    if (!title) {
      if (el.classList.contains('btn') || el.classList.contains('subbtn')) {
        const hint = el.querySelector('.hint');
        const raw = el.textContent || '';
        title = raw && hint ? raw.replace(hint.textContent || '', '') : raw;
      } else if (el.classList.contains('formrow')) {
        const labelEl = el.querySelector('label');
        if (labelEl) {
          title = labelEl.textContent || '';
        }
      } else if (el.classList.contains('subhint')) {
        title = el.getAttribute('data-help-title') || 'Tip';
      }
    }
    if (!text) {
      if (el.classList.contains('btn') || el.classList.contains('subbtn')) {
        const hint = el.querySelector('.hint');
        if (hint && hint.textContent && hint.textContent.trim()) {
          text = hint.textContent;
        } else if (el.getAttribute('title')) {
          text = el.getAttribute('title');
        }
      } else if (el.classList.contains('formrow')) {
        const labelEl = el.querySelector('label');
        if (labelEl && labelEl.getAttribute('data-help-text')) {
          text = labelEl.getAttribute('data-help-text');
        } else if (labelEl && labelEl.textContent) {
          text = `Adjust ${labelEl.textContent.trim().toLowerCase()}.`;
        }
      } else if (el.classList.contains('subhint')) {
        text = el.textContent || '';
      }
    }
    title = title ? title.replace(/\s+/g, ' ').trim() : '';
    text = text ? text.replace(/\s+/g, ' ').trim() : '';
    if (!title && !text) {
      return null;
    }
    if (!text) {
      text = title;
    }
    return { title, text };
  }

  function attachSettingHelp(el) {
    const data = deriveSettingHelp(el);
    if (!data) {
      return;
    }
    const show = () => {
      activeSettingHelpSource = el;
      showSettingHelp(data.title, data.text);
    };
    const hide = () => hideSettingHelp(el);
    el.addEventListener('mouseenter', show);
    el.addEventListener('focusin', show);
    el.addEventListener('mouseleave', hide);
    el.addEventListener('focusout', hide);
  }

  function initializeSettingHelp() {
    if (!settingHelpEl) {
      return;
    }
    if (settingHelpTitle) {
      settingHelpTitle.textContent = DEFAULT_SETTING_HELP.title;
    }
    if (settingHelpBody) {
      settingHelpBody.textContent = DEFAULT_SETTING_HELP.text;
    }
    if (sidebarEl) {
      const targets = sidebarEl.querySelectorAll('.btn, .subbtn, .formrow, .subhint');
      targets.forEach((el) => attachSettingHelp(el));
      sidebarEl.addEventListener('mouseleave', () => hideSettingHelp());
    }
  }

  function setActiveSettingHelpSource(source) {
    activeSettingHelpSource = source || null;
  }

  function getActiveSettingHelpSource() {
    return activeSettingHelpSource;
  }

  return {
    showSettingHelp,
    hideSettingHelp,
    deriveSettingHelp,
    attachSettingHelp,
    initializeSettingHelp,
    setActiveSettingHelpSource,
    getActiveSettingHelpSource
  };
}
