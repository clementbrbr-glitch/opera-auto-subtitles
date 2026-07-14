// Store transcriber instance
let currentTranscriber = null;
let isListening = false;
let subtitlesContainer = null;
let audioContext = null;
let mediaElementAudioSourceNode = null;
let analyser = null;
let lastTranscription = '';

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

// Trouver l'élément vidéo
function findVideoElement() {
  const videos = document.querySelectorAll('video');
  for (let video of videos) {
    if (video.src || (video.currentSrc && video.currentSrc.length > 0)) {
      return video;
    }
  }
  return null;
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
  
  // Chercher la vidéo
  const videoElement = findVideoElement();
  
  if (!videoElement) {
    displaySubtitle('❌ Aucune vidéo trouvée', 5000);
    return;
  }
  
  console.log('Vidéo trouvée:', videoElement);
  
  isListening = true;
  displaySubtitle('⏳ Initialisation de l\'audio...', 0);
  
  // Créer AudioContext si nécessaire
  const audioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!audioContext) {
    audioContext = new audioContextClass();
  }
  
  // Vérifier que le contexte audio n'est pas fermé
  if (audioContext.state === 'closed') {
    audioContext = new audioContextClass();
  }
  
  try {
    // Connecter la vidéo à la Web Audio API
    if (!mediaElementAudioSourceNode) {
      mediaElementAudioSourceNode = audioContext.createMediaElementSource(videoElement);
      analyser = audioContext.createAnalyser();
      
      // Connecter: vidéo -> analyser -> destination (haut-parleurs)
      mediaElementAudioSourceNode.connect(analyser);
      analyser.connect(audioContext.destination);
      
      console.log('Audio connecté avec succès');
    }
    
    // Créer un flux audio pour le Web Speech API
    const dest = audioContext.createMediaStreamDestination();
    analyser.connect(dest);
    
    // Initialiser la reconnaissance vocale
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = currentSettings.language;
    
    // Essayer de connecter directement le flux audio
    try {
      const stream = dest.stream;
      // Alternative: utiliser le microphone du système pour capturer l'audio
    } catch (e) {
      console.log('Cannot use media stream for speech recognition, using default microphone');
    }
    
    recognition.onstart = () => {
      console.log('Transcription démarrée');
      displaySubtitle('🎤 Écoute en cours...', 0);
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
      if (displayText && displayText !== lastTranscription) {
        lastTranscription = displayText;
        displaySubtitle(displayText, 0);
        console.log('Transcription:', displayText);
      }
    };
    
    recognition.onerror = (event) => {
      console.error('Erreur de reconnaissance:', event.error);
      if (event.error !== 'no-speech') {
        displaySubtitle(`⚠️ Erreur: ${event.error}`, 2000);
      }
    };
    
    recognition.onend = () => {
      console.log('Reconnaissance terminée');
      if (isListening && currentSettings.enabled) {
        // Redémarrer automatiquement
        setTimeout(startTranscription, 1000);
      }
    };
    
    // Démarrer la reconnaissance
    recognition.start();
    currentTranscriber = recognition;
    
  } catch (e) {
    console.error('Erreur lors de la connexion audio:', e);
    displaySubtitle(`❌ Erreur: ${e.message}`, 5000);
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
  
  isListening = false;
  
  if (subtitlesContainer) {
    subtitlesContainer.style.display = 'none';
  }
}

// Auto-detect and start on page load
window.addEventListener('load', () => {
  if (currentSettings.enabled) {
    setTimeout(startTranscription, 1000);
  }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  stopTranscription();
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
