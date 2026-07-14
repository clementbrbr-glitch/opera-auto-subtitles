// Service Worker pour l'extension
console.log('Background service worker loaded');

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installée');
    // Initialiser les paramètres par défaut
    chrome.storage.local.set({
      subtitlesEnabled: false,
      language: 'fr-FR',
      fontSize: '16',
      opacity: 100,
      subtitleBackground: false
    });
  }
});
