// app.js - Main Application Logic
class DrishtiAI {
    constructor() {
        this.isListening = false;
        this.currentLanguage = 'hi-IN';
        this.azureServices = {
            vision: null,
            speech: null,
            openai: null
        };
        this.userPreferences = {};
        this.initializeApp();
    }

    async initializeApp() {
        // Initialize Azure Services
        await this.initializeAzureServices();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Check for PWA installation
        this.setupPWA();
        
        // Initialize accessibility features
        this.initializeAccessibility();
        
        // Welcome message
        this.speakWelcome();
    }

    async initializeAzureServices() {
        try {
            // Initialize Azure Speech Services
            const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
                "YOUR_SPEECH_KEY",
                "YOUR_SPEECH_REGION"
            );
            speechConfig.speechSynthesisLanguage = this.currentLanguage;
            this.azureServices.speech = speechConfig;
            
            // Announce connection status
            this.announceToScreenReader("Azure services initialized successfully");
            
        } catch (error) {
            console.error("Azure initialization failed:", error);
            this.announceToScreenReader("Unable to connect to Azure services. Please check your internet connection.");
        }
    }

    setupEventListeners() {
        // Microphone button
        const micButton = document.getElementById('mic-button');
        micButton.addEventListener('click', () => this.toggleListening());
        micButton.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                this.toggleListening();
            }
        });

        // Quick action buttons
        document.getElementById('scan-environment').addEventListener('click', () => this.scanEnvironment());
        document.getElementById('read-text').addEventListener('click', () => this.readTextMode());
        document.getElementById('navigate').addEventListener('click', () => this.startNavigation());
        document.getElementById('emergency').addEventListener('click', () => this.triggerEmergency());

        // Camera modal
        document.getElementById('close-camera').addEventListener('click', () => this.closeCamera());
        document.getElementById('capture-btn').addEventListener('click', () => this.captureImage());
    }

    async toggleListening() {
        if (!this.isListening) {
            await this.startVoiceRecognition();
        } else {
            this.stopVoiceRecognition();
        }
    }

    async startVoiceRecognition() {
        this.isListening = true;
        const micButton = document.getElementById('mic-button');
        const micStatus = document.getElementById('mic-status');
        
        micButton.style.boxShadow = '0 0 60px rgba(0, 120, 212, 0.8)';
        micStatus.textContent = 'सुन रहा हूं...';
        
        this.announceToScreenReader('Listening for command');
        
        try {
            const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
            const recognizer = new SpeechSDK.SpeechRecognizer(this.azureServices.speech, audioConfig);
            
            recognizer.recognizeOnceAsync(
                (result) => {
                    if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
                        this.processVoiceCommand(result.text);
                    }
                    this.stopVoiceRecognition();
                },
                (error) => {
                    console.error("Speech recognition error:", error);
                    this.stopVoiceRecognition();
                }
            );
            
            this.currentRecognizer = recognizer;
            
        } catch (error) {
            console.error("Failed to start voice recognition:", error);
            this.stopVoiceRecognition();
        }
    }

    stopVoiceRecognition() {
        this.isListening = false;
        const micButton = document.getElementById('mic-button');
        const micStatus = document.getElementById('mic-status');
        
        micButton.style.boxShadow = '0 0 40px rgba(0, 120, 212, 0.4)';
        micStatus.textContent = 'कमांड के लिए बोलें';
        
        if (this.currentRecognizer) {
            this.currentRecognizer.close();
        }
    }

    async processVoiceCommand(command) {
        console.log("Command received:", command);
        document.getElementById('last-command').textContent = command;
        
        // Process command in Hindi or English
        const commandLower = command.toLowerCase();
        
        if (commandLower.includes('क्या है') || commandLower.includes('what is')) {
            await this.scanEnvironment();
        } else if (commandLower.includes('पढ़ो') || commandLower.includes('read')) {
            await this.readTextMode();
        } else if (commandLower.includes('रास्ता') || commandLower.includes('navigate')) {
            await this.startNavigation();
        } else if (commandLower.includes('मदद') || commandLower.includes('help')) {
            await this.triggerEmergency();
        } else {
            this.speakResponse(`मैंने आपकी कमांड समझी: ${command}. कृपया स्पष्ट रूप से बताएं कि आप क्या चाहते हैं।`);
        }
    }

    async scanEnvironment() {
        this.announceToScreenReader('Opening camera to scan environment');
        
        // Open camera
        const modal = document.getElementById('camera-modal');
        modal.hidden = false;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            
            const video = document.getElementById('camera-feed');
            video.srcObject = stream;
            
        } catch (error) {
            console.error("Camera access failed:", error);
            this.speakResponse("कैमरा एक्सेस अनुमति दें। कृपया सेटिंग्स में कैमरा एक्सेस अनुमति दें।");
            modal.hidden = true;
        }
    }

    async captureImage() {
        const video = document.getElementById('camera-feed');
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        canvas.toBlob(async (blob) => {
            this.announceToScreenReader('Processing image with Azure AI');
            await this.processImageWithAzure(blob);
        }, 'image/jpeg', 0.8);
        
        // Stop camera
        const stream = video.srcObject;
        stream.getTracks().forEach(track => track.stop());
        
        // Close modal
        document.getElementById('camera-modal').hidden = true;
    }

    async processImageWithAzure(imageBlob) {
        try {
            // Step 1: Azure Computer Vision Analysis
            const visionResult = await this.analyzeWithComputerVision(imageBlob);
            
            // Step 2: Generate human-friendly description with Azure OpenAI
            const description = await this.generateDescription(visionResult);
            
            // Step 3: Speak the description
            await this.speakDescription(description);
            
            // Step 4: Update UI
            this.updateSceneDescription(description);
            
            // Step 5: Check for hazards
            this.checkForHazards(visionResult);
            
        } catch (error) {
            console.error("Image processing failed:", error);
            this.speakResponse("तस्वीर प्रोसेसिंग में समस्या आई। कृपया फिर से कोशिश करें।");
        }
    }

    async analyzeWithComputerVision(imageBlob) {
        const endpoint = "https://YOUR_REGION.api.cognitive.microsoft.com/";
        
        const response = await fetch(`${endpoint}/vision/v3.2/analyze?visualFeatures=Categories,Description,Objects,Tags,Text&language=hi`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'Ocp-Apim-Subscription-Key': 'YOUR_VISION_KEY'
            },
            body: imageBlob
        });
        
        if (!response.ok) {
            throw new Error(`Vision API error: ${response.status}`);
        }
        
        return await response.json();
    }

    async generateDescription(visionData) {
        // Prepare prompt for Azure OpenAI
        const prompt = this.createPromptFromVisionData(visionData);
        
        const response = await fetch('https://YOUR_RESOURCE.openai.azure.com/openai/deployments/gpt-4/chat/completions?api-version=2023-12-01-preview', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': 'YOUR_OPENAI_KEY'
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: "system",
                        content: "You are Drishti AI, a helpful assistant for blind users in India. Provide clear, concise safety-first descriptions in Hindi. Focus on immediate environment, hazards, and actionable guidance."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 200,
                temperature: 0.7
            })
        });
        
        const data = await response.json();
        return data.choices[0].message.content;
    }

    createPromptFromVisionData(visionData) {
        const objects = visionData.objects?.map(obj => obj.object) || [];
        const tags = visionData.tags?.map(tag => tag.name) || [];
        const text = visionData.text?.lines?.map(line => line.text) || [];
        
        return `Based on this scene analysis: 
        Objects detected: ${objects.join(', ')}
        Tags: ${tags.join(', ')}
        Text found: ${text.join(', ')}
        
        Provide a Hindi audio description for a blind user. Include:
        1. Main objects in the scene
        2. Any potential hazards
        3. Distance estimates if available
        4. Navigation guidance
        5. Important text that should be read
        
        Keep it under 3 sentences. Speak naturally.`;
    }

    async speakDescription(text) {
        return new Promise((resolve, reject) => {
            const synthesizer = new SpeechSDK.SpeechSynthesizer(this.azureServices.speech);
            
            synthesizer.speakTextAsync(
                text,
                (result) => {
                    if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                        resolve();
                    }
                    synthesizer.close();
                },
                (error) => {
                    console.error("Speech synthesis failed:", error);
                    // Fallback to browser TTS
                    this.fallbackTTS(text);
                    resolve();
                }
            );
        });
    }

    fallbackTTS(text) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.currentLanguage;
        utterance.rate = 0.9;
        utterance.pitch = 1;
        speechSynthesis.speak(utterance);
    }

    updateSceneDescription(description) {
        const sceneElement = document.getElementById('scene-description');
        sceneElement.textContent = description;
        this.announceToScreenReader(description);
    }

    checkForHazards(visionData) {
        const hazards = this.detectHazards(visionData);
        
        if (hazards.length > 0) {
            const alertElement = document.getElementById('hazard-alert');
            const alertText = document.getElementById('alert-text');
            
            const hazardMessage = hazards.join(', ');
            alertText.textContent = `सावधानी: ${hazardMessage}`;
            alertElement.hidden = false;
            
            // Speak hazard warning
            this.speakResponse(`सावधान! ${hazardMessage}`);
            
            // Trigger haptic feedback if available
            this.triggerHapticFeedback();
        }
    }

    detectHazards(visionData) {
        const hazards = [];
        const hazardKeywords = [
            'vehicle', 'car', 'bus', 'motorcycle', 'bicycle', 'traffic',
            'stairs', 'step', 'staircase',
            'hole', 'ditch', 'drain',
            'water', 'puddle',
            'animal', 'dog', 'crowd'
        ];
        
        const objects = visionData.objects?.map(obj => obj.object.toLowerCase()) || [];
        const tags = visionData.tags?.map(tag => tag.name.toLowerCase()) || [];
        
        const allDetections = [...objects, ...tags];
        
        hazardKeywords.forEach(keyword => {
            if (allDetections.some(detection => detection.includes(keyword))) {
                hazards.push(this.getHindiTranslation(keyword));
            }
        });
        
        return hazards;
    }

    getHindiTranslation(englishWord) {
        const translations = {
            'vehicle': 'वाहन',
            'car': 'कार',
            'bus': 'बस',
            'traffic': 'ट्रैफिक',
            'stairs': 'सीढ़ियां',
            'step': 'कदम',
            'hole': 'गड्ढा',
            'water': 'पानी',
            'animal': 'जानवर',
            'crowd': 'भीड़'
        };
        
        return translations[englishWord] || englishWord;
    }

    triggerHapticFeedback() {
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }
    }

    async readTextMode() {
        this.speakResponse("टेक्स्ट रीडिंग मोड। कैमरा खोल रहा हूं। कृपया टेक्स्ट को कैमरे के सामने रखें।");
        await this.scanEnvironment();
    }

    async startNavigation() {
        this.speakResponse("नेविगेशन मोड शुरू। कृपया अपना गंतव्य बताएं।");
        // In full implementation, this would integrate with Azure Maps
        // and use spatial audio for directional guidance
    }

    async triggerEmergency() {
        this.speakResponse("आपातकालीन सहायता एक्टिवेट की गई। आपके ट्रस्टेड कॉन्टैक्ट्स को अलर्ट भेजा जा रहा है।");
        
        // Send emergency notification
        await this.sendEmergencyNotification();
        
        // Start continuous environment monitoring
        this.startEmergencyMonitoring();
    }

    async sendEmergencyNotification() {
        // Implementation would send notification to trusted contacts
        // using Azure Communication Services or similar
        console.log("Emergency notification sent");
    }

    startEmergencyMonitoring() {
        // Start periodic environment scanning
        this.emergencyInterval = setInterval(() => {
            this.scanEnvironment();
        }, 10000); // Scan every 10 seconds
        
        // Speak status updates
        this.speakResponse("आपातकालीन मोनिटरिंग शुरू। आपके आसपास के वातावरण की नियमित जांच की जा रही है।");
    }

    initializeAccessibility() {
        // Set up screen reader announcements
        this.announceToScreenReader("डृष्टि एआई एप्लिकेशन लोड हो गया है। मुख्य स्क्रीन।");
        
        // Set appropriate ARIA attributes
        document.querySelectorAll('[aria-label]').forEach(element => {
            if (!element.getAttribute('role')) {
                if (element.tagName === 'BUTTON') {
                    element.setAttribute('role', 'button');
                } else if (element.tagName === 'IMG') {
                    element.setAttribute('role', 'img');
                }
            }
        });
        
        // Set up focus management
        document.addEventListener('focus', (event) => {
            const target = event.target;
            if (target.getAttribute('aria-label')) {
                this.announceToScreenReader(target.getAttribute('aria-label'));
            }
        }, true);
    }

    announceToScreenReader(message) {
        const announcer = document.getElementById('sr-announcer');
        announcer.textContent = '';
        setTimeout(() => {
            announcer.textContent = message;
        }, 100);
    }

    speakWelcome() {
        const welcomeMessage = "नमस्ते! मैं डृष्टि एआई हूं, आपका दृष्टिहीन सहायक। मैं आपके आसपास के वातावरण को समझने और बताने में मदद करूंगा। माइक्रोफोन बटन दबाकर बोलें या क्विक एक्शन बटन का उपयोग करें।";
        this.speakResponse(welcomeMessage);
    }

    speakResponse(text) {
        // For MVP, use browser TTS
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.currentLanguage;
        utterance.rate = 0.9;
        speechSynthesis.speak(utterance);
    }

    setupPWA() {
        // Register service worker for offline functionality
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(registration => {
                        console.log('ServiceWorker registered');
                    })
                    .catch(error => {
                        console.log('ServiceWorker registration failed:', error);
                    });
            });
        }
        
        // Add to home screen prompt
        let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            // Show install button (simplified for MVP)
            setTimeout(() => {
                this.showInstallPrompt();
            }, 5000);
        });
    }

    showInstallPrompt() {
        this.speakResponse("आप डृष्टि एआई को अपने होम स्क्रीन पर इंस्टॉल कर सकते हैं ताकि इसे ऐप की तरह उपयोग कर सकें।");
    }
}

// Service Worker for offline functionality
const serviceWorkerCode = `
// service-worker.js
const CACHE_NAME = 'drishti-ai-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
`;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.drishtiApp = new DrishtiAI();
});

// Handle offline/online status
window.addEventListener('online', () => {
    document.getElementById('connection-status').textContent = 'Azure: Connected';
    if (window.drishtiApp) {
        window.drishtiApp.announceToScreenReader('इंटरनेट कनेक्शन रिस्टोर हो गया है');
    }
});

window.addEventListener('offline', () => {
    document.getElementById('connection-status').textContent = 'Azure: Offline';
    if (window.drishtiApp) {
        window.drishtiApp.announceToScreenReader('इंटरनेट कनेक्शन खो गया है। कुछ सुविधाएं सीमित हो सकती हैं');
    }
});
