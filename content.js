// Store transcriber instance
let currentTranscriber = null;
let isListening = false;
let subtitlesContainer = null;
let audioContext = null;
let mediaElementAudioSourceNode = null;
let analyser = null;
let splitter = null;
let processor = null;

let currentSettings = {
  enabled: false,
  language: 'fr-FR',
  fontSize: '16',
  opacity: 1,
  background: false
};

// Initialize
chrome.storage.local.get(['subtitlesEnabled', 'language', 'fontSize', 'opacity', 'subtitleBackground'], (settings) => {
  currentSettings.enabled = settings.subtitlesEnabled || false;
  currentSettings.language = settings.language || 'fr-FR';
  currentSettings.fontSize = settings.fontSize || '16';
  currentSettings.opacity = (settings.opacity || 100) / 100;
  currentSettings.background = settings.subtitleBackground || false;
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch(request.action) {
    case 'toggleSubtitles':
      currentSettings.enabled = request.enabled;
      if (request.enabled) {
        startTranscription();
      } else {
        stopTranscription();
      }
      break;
      
    case 'setLanguage':
      currentSettings.language = request.language;
      if (isListening) {
        stopTranscription();
        setTimeout(startTranscription, 500);
      }
      break;
      
    case 'updateFontSize':
      currentSettings.fontSize = request.size;
      updateSubtitleStyle();
      break;
      
    case 'updateOpacity':
      currentSettings.opacity = request.opacity;
      updateSubtitleStyle();
      break;
      
    case 'updateBackground':
      currentSettings.background = request.background;
      updateSubtitleStyle();
      break;
      
    case 'test':
      displaySubtitle('Ceci est un test des sous-titres 🎬', 3000);
      break;
      
    case 'reset':
      location.reload();
      break;
  }
  sendResponse({success: true});
});

// Create subtitle container
function createSubtitleContainer() {
  if (subtitlesContainer) return subtitlesContainer;
  
  const container = document.createElement('div');
  container.id = 'auto-subtitles-container';
  container.style.cssText = `
    position: fixed;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    background: ${currentSettings.background ? 'rgba(0, 0, 0, 0.8)' : 'transparent'};
    color: white;
    padding: ${currentSettings.background ? '12px 20px' : '0'};
    border-radius: 6px;
    font-size: ${currentSettings.fontSize}px;
    font-weight: 500;
    max-width: 80%;
    text-align: center;
    z-index: 999999;
    opacity: ${currentSettings.opacity};
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
    font-family: Arial, sans-serif;
    white-space: pre-wrap;
    word-wrap: break-word;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;
  
  document.body.appendChild(container);
  subtitlesContainer = container;
  return container;
}

function updateSubtitleStyle() {
  if (!subtitlesContainer) return;
  
  subtitlesContainer.style.fontSize = currentSettings.fontSize + 'px';
  subtitlesContainer.style.opacity = currentSettings.opacity;
  subtitlesContainer.style.background = currentSettings.background ? 'rgba(0, 0, 0, 0.8)' : 'transparent';
  subtitlesContainer.style.padding = currentSettings.background ? '12px 20px' : '0';
}

function displaySubtitle(text, duration = 3000) {
  const container = createSubtitleContainer();
  container.textContent = text;
  container.style.display = 'block';
  
  if (duration > 0) {
    setTimeout(() => {
      container.style.display = 'none';
    }, duration);
  }
}

// Trouver les éléments audio/vidéo sur la page
function findAudioElements() {
  const elements = [];
  
  // Chercher les éléments <video>
  document.querySelectorAll('video').forEach(video => {
    if (video.readyState > 0) {
      elements.push(video);
    }
  });
  
  // Chercher les éléments <audio>
  document.querySelectorAll('audio').forEach(audio => {
    if (audio.readyState > 0) {
      elements.push(audio);
    }
  });
  
  // Chercher les iframes avec contenu média
  document.querySelectorAll('iframe').forEach(iframe => {
    try {
      if (iframe.src && (iframe.src.includes('youtube') || iframe.src.includes('netflix') || iframe.src.includes('twitch'))) {
        elements.push(iframe);
      }
    } catch (e) {
      console.log('Cannot access iframe:', e);
    }
  });
  
  return elements;
}

// Web Speech API Transcription
function startTranscription() {
  if (isListening) return;
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    displaySubtitle('❌ Web Speech API non disponible', 5000);
    return;
  }
  
  createSubtitleContainer();
  isListening = true;
  
  // Chercher les éléments audio/vidéo
  const audioElements = findAudioElements();
  
  if (audioElements.length === 0) {
    displaySubtitle('⏳ En attente d\'audio...', 0);
  } else {
    displaySubtitle('🎤 Capture de l\'audio...', 0);
  }
  
  // Créer AudioContext
  const audioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!audioContext) {
    audioContext = new audioContextClass();
  }
  
  // Essayer de connecter les éléments audio trouvés
  let audioConnected = false;
  
  audioElements.forEach(element => {
    try {
      if (element.tagName === 'VIDEO' || element.tagName === 'AUDIO') {
        mediaElementAudioSourceNode = audioContext.createMediaElementAudioSource(element);
        analyser = audioContext.createAnalyser();
        mediaElementAudioSourceNode.connect(analyser);
        analyser.connect(audioContext.destination);
        audioConnected = true;
        console.log('Audio connecté depuis', element.tagName);
      }
    } catch (e) {
      console.error('Erreur connexion audio:', e);
    }
  });
  
  // Initialiser la reconnaissance vocale
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = currentSettings.language;
  
  recognition.onstart = () => {
    console.log('Transcription démarrée');
    if (audioConnected) {
      displaySubtitle('🎤 Écoute de l\'audio en cours...', 0);
    } else {
      displaySubtitle('🎤 Écoute (en attente d\'audio)...', 0);
    }
  };
  
  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript += transcript;
      }
    }
    
    const displayText = finalTranscript || interimTranscript;
    if (displayText) {
      displaySubtitle(displayText, 0);
    }
  };
  
  recognition.onerror = (event) => {
    console.error('Erreur:', event.error);
    if (event.error !== 'no-speech') {
      displaySubtitle(`⚠️ Erreur: ${event.error}`, 3000);
    }
  };
  
  recognition.onend = () => {
    console.log('Transcription terminée');
    if (isListening && currentSettings.enabled) {
      setTimeout(startTranscription, 1000);
    }
  };
  
  try {
    recognition.start();
    currentTranscriber = recognition;
  } catch (e) {
    console.error('Erreur démarrage:', e);
    isListening = false;
  }
}

function stopTranscription() {
  if (currentTranscriber) {
    try {
      currentTranscriber.abort();
    } catch (e) {
      console.log('Error stopping transcriber:', e);
    }
    currentTranscriber = null;
  }
  
  if (audioContext && audioContext.state !== 'closed') {
    try {
      if (analyser) analyser.disconnect();
      if (mediaElementAudioSourceNode) mediaElementAudioSourceNode.disconnect();
    } catch (e) {
      console.log('Error disconnecting audio:', e);
    }
  }
  
  isListening = false;
  
  if (subtitlesContainer) {
    subtitlesContainer.style.display = 'none';
  }
}

// Observer pour détecter quand des vidéos sont ajoutées à la page
const observer = new MutationObserver(() => {
  if (isListening && currentSettings.enabled) {
    // Vérifier si new audio elements are added
    const elements = findAudioElements();
    if (elements.length > 0 && !mediaElementAudioSourceNode) {
      console.log('Nouveaux éléments audio détectés, redémarrage...');
      stopTranscription();
      setTimeout(startTranscription, 500);
    }
  }
});

// Démarrer l'observation quand l'extension est activée
function startObserver() {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false
  });
}

// Auto-detect and start on page load
window.addEventListener('load', () => {
  startObserver();
  if (currentSettings.enabled) {
    setTimeout(startTranscription, 500);
  }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  stopTranscription();
  observer.disconnect();
});

// Handle when tab becomes active
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopTranscription();
  } else if (currentSettings.enabled) {
    setTimeout(startTranscription, 1000);
  }
});

console.log('Auto Subtitles content script loaded');
