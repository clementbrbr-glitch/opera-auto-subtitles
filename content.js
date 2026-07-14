// Store transcriber instance
let currentTranscriber = null;
let isListening = false;
let subtitlesContainer = null;
let audioContext = null;
let mediaStreamAudioSourceNode = null;
let analyser = null;

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

// Capture audio système
async function captureAudioSystem() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false
    });
    
    return stream;
  } catch (err) {
    console.error('Erreur capture audio système:', err);
    if (err.name === 'NotAllowedError') {
      displaySubtitle('❌ Permission d\'accès à l\'audio refusée', 5000);
    } else if (err.name === 'NotFoundError') {
      displaySubtitle('❌ Aucun flux audio trouvé', 5000);
    }
    return null;
  }
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
  displaySubtitle('⏳ Sélectionnez la source audio...', 0);
  
  // D'abord essayer de capturer l'audio système
  captureAudioSystem().then(stream => {
    if (!stream) {
      isListening = false;
      return;
    }
    
    // Créer AudioContext
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    mediaStreamAudioSourceNode = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    mediaStreamAudioSourceNode.connect(analyser);
    
    // Initialiser la reconnaissance vocale
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = currentSettings.language;
    
    // Créer un processeur pour router l'audio
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    analyser.connect(processor);
    processor.connect(audioContext.destination);
    
    recognition.onstart = () => {
      console.log('Transcription démarrée');
      displaySubtitle('🎤 Écoute de l\'audio système...', 0);
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
  });
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
  
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  
  isListening = false;
  
  if (subtitlesContainer) {
    subtitlesContainer.style.display = 'none';
  }
}

// Auto-detect and start on page load
window.addEventListener('load', () => {
  if (currentSettings.enabled) {
    startTranscription();
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
