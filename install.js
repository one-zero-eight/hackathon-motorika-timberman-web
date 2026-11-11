(() => {
  'use strict';
  const enabled = Boolean(GODOT_CONFIG.serviceWorker) && window.self === window.top;
  const standalone = window.matchMedia('(display-mode: standalone)');
  let installed = standalone.matches || navigator.standalone === true;
  let deferredPrompt = null;
  let prompting = false;
  const dialog = document.getElementById('install-help');
  const message = document.getElementById('install-help-text');
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  window.addEventListener('beforeinstallprompt', (event) => {
    if (!enabled || installed) return;
    event.preventDefault();
    deferredPrompt = event;
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    if (dialog.open) dialog.close();
  });
  standalone.addEventListener('change', (event) => {
    installed = event.matches || navigator.standalone === true;
    if (installed) deferredPrompt = null;
  });

  function showHelp() {
    message.textContent = ios
      ? 'На iPhone системного install prompt нет. Откройте игру в Safari, нажмите «Поделиться» → «На экран „Домой“» → «Добавить».'
      : 'Если браузер не показал окно установки, откройте его меню и выберите «Установить приложение» или «Добавить на главный экран». В некоторых браузерах установка PWA недоступна.';
    if (!dialog.open) dialog.showModal();
  }

  window.lesorubInstall = {
    isAvailable: () => enabled && !installed,
    canPrompt: () => enabled && !installed && deferredPrompt !== null,
    async request() {
      if (!enabled || installed || prompting) return;
      if (!deferredPrompt) { showHelp(); return; }
      const event = deferredPrompt;
      // Each browser event may be used only once. Call prompt synchronously in
      // the button's user-activation window, before the first await.
      deferredPrompt = null;
      prompting = true;
      try {
        const result = event.prompt();
        await result;
        const choice = await event.userChoice;
        if (choice?.outcome === 'accepted') installed = true;
      } catch (error) {
        console.warn('Окно установки недоступно:', error);
        showHelp();
      } finally {
        prompting = false;
      }
    },
  };

  document.getElementById('install-help-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  dialog.addEventListener('close', () => document.getElementById('canvas').focus({ preventScroll: true }));
})();
