document.addEventListener('DOMContentLoaded', loadSettings);

const toggleSubtitles = document.getElementById('toggleSubtitles');
const languageSelect = document.getElementById('languageSelect');
const fontSize = document.getElementById('fontSize');
const opacity = document.getElementById('opacity');
const toggleBackground = document.getElementById('toggleBackground');
const resetBtn = document.getElementById('resetBtn');
const testBtn = document.getElementById('testBtn');
const status = document.getElementById('status');
const sizeValue = document.getElementById('sizeValue');
const opacityValue = document.getElementById('opacityValue');

// Toggle subtitles
toggleSubtitles.addEventListener('click', function() {
  this.classList.toggle('active');
  const isActive = this.classList.contains('active');
  
  chrome.storage.local.set({ subtitlesEnabled: isActive });
  updateStatus();
  
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'toggleSubtitles',
      enabled: isActive
    }).catch(err => console.log('Tab not ready'));
  });
});

// Toggle background
toggleBackground.addEventListener('click', function() {
  this.classList.toggle('active');
  const hasBackground = this.classList.contains('active');
  
  chrome.storage.local.set({ subtitleBackground: hasBackground });
  
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'updateBackground',
      background: hasBackground
    }).catch(err => console.log('Tab not ready'));
  });
});

// Language selection
languageSelect.addEventListener('change', function() {
  chrome.storage.local.set({ language: this.value });
  
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'setLanguage',
      language: this.value
    }).catch(err => console.log('Tab not ready'));
  });
});

// Font size
fontSize.addEventListener('input', function() {
  sizeValue.textContent = this.value + 'px';
  chrome.storage.local.set({ fontSize: this.value });
  
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'updateFontSize',
      size: this.value
    }).catch(err => console.log('Tab not ready'));
  });
});

// Opacity
opacity.addEventListener('input', function() {
  opacityValue.textContent = this.value + '%';
  chrome.storage.local.set({ opacity: this.value });
  
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'updateOpacity',
      opacity: this.value / 100
    }).catch(err => console.log('Tab not ready'));
  });
});

// Reset button
resetBtn.addEventListener('click', function() {
  chrome.storage.local.clear(() => {
    loadSettings();
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'reset'
      }).catch(err => console.log('Tab not ready'));
    });
  });
});

// Test button
testBtn.addEventListener('click', function() {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'test'
    }).catch(err => console.log('Tab not ready'));
  });
});

function loadSettings() {
  chrome.storage.local.get([
    'subtitlesEnabled',
    'language',
    'fontSize',
    'opacity',
    'subtitleBackground'
  ], (settings) => {
    if (settings.subtitlesEnabled) {
      toggleSubtitles.classList.add('active');
    }
    
    if (settings.language) {
      languageSelect.value = settings.language;
    }
    
    if (settings.fontSize) {
      fontSize.value = settings.fontSize;
      sizeValue.textContent = settings.fontSize + 'px';
    }
    
    if (settings.opacity) {
      opacity.value = settings.opacity;
      opacityValue.textContent = settings.opacity + '%';
    }
    
    if (settings.subtitleBackground) {
      toggleBackground.classList.add('active');
    }
    
    updateStatus();
  });
}

function updateStatus() {
  chrome.storage.local.get(['subtitlesEnabled'], (settings) => {
    if (settings.subtitlesEnabled) {
      status.textContent = '✓ Actif';
      status.classList.add('active');
    } else {
      status.textContent = '✗ Inactif';
      status.classList.remove('active');
    }
  });
}
