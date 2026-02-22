/**
 * VortexEye - Voice Interface Module
 * Speech recognition and synthesis using Web Speech API
 */

class VoiceInterface {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.onResultCallback = null;
        this.onListeningChangeCallback = null;

        // Load audio preference from localStorage or default to true
        this.audioEnabled = localStorage.getItem('vortex_audio_enabled') !== 'false';

        this.initRecognition();
    }

    /**
     * Update audio enabled state
     */
    setAudioEnabled(enabled) {
        this.audioEnabled = enabled;
        localStorage.setItem('vortex_audio_enabled', enabled);
        if (enabled) {
            this.speak('Voice audio enabled');
        } else {
            // Cancel any ongoing speech immediately
            if (this.synthesis) {
                this.synthesis.cancel();
            }
        }
    }

    /**
     * Initialize speech recognition
     */
    initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('Speech recognition not supported');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            this.isListening = true;
            if (this.onListeningChangeCallback) {
                this.onListeningChangeCallback(true);
            }
            console.log('🎤 Listening...');
        };

        this.recognition.onend = () => {
            this.isListening = false;
            if (this.onListeningChangeCallback) {
                this.onListeningChangeCallback(false);
            }
            console.log('🎤 Stopped listening');
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            console.log('🎤 Heard:', transcript);

            if (this.onResultCallback) {
                this.onResultCallback(transcript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;

            // Handle specific errors
            if (event.error === 'not-allowed') {
                // Determine if it's a permission issue
                const msg = 'Microphone access denied. Please check your browser permissions.';
                console.warn(msg);
                // Try to speak the error if synthesis is available
                if (this.synthesis && this.audioEnabled) {
                    const utterance = new SpeechSynthesisUtterance(msg);
                    this.synthesis.speak(utterance);
                }
            } else if (event.error === 'no-speech') {
                // No speech detected, just stop listening silently
            } else {
                // Other errors
                if (this.synthesis && this.audioEnabled) {
                    const utterance = new SpeechSynthesisUtterance('Voice error. Please try again.');
                    this.synthesis.speak(utterance);
                }
            }

            if (this.onListeningChangeCallback) {
                this.onListeningChangeCallback(false);
            }
        };
    }

    /**
     * Start listening for voice input
     */
    startListening() {
        if (!this.recognition) {
            console.warn('Speech recognition not available');
            return false;
        }

        if (this.isListening) {
            this.stopListening();
            return false;
        }

        try {
            this.recognition.start();
            return true;
        } catch (error) {
            console.error('Failed to start recognition:', error);
            return false;
        }
    }

    /**
     * Stop listening
     */
    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    /**
     * Speak text using speech synthesis
     */
    speak(text, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.audioEnabled) {
                console.log('🔇 Audio disabled, not speaking:', text);
                resolve();
                return;
            }

            if (!this.synthesis) {
                console.warn('Speech synthesis not available');
                reject('Not supported');
                return;
            }

            // Cancel any ongoing speech
            this.synthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = options.rate || 1.0;
            utterance.pitch = options.pitch || 1.0;
            utterance.volume = options.volume || 1.0;
            utterance.lang = options.lang || 'en-US';

            // Try to use a more natural voice
            const voices = this.synthesis.getVoices();
            const preferredVoice = voices.find(v =>
                v.lang.startsWith('en') && v.name.includes('Samantha') ||
                v.lang.startsWith('en') && v.name.includes('Google')
            ) || voices.find(v => v.lang.startsWith('en'));

            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }

            utterance.onend = () => resolve();
            utterance.onerror = (e) => reject(e);

            this.synthesis.speak(utterance);
            console.log('🔊 Speaking:', text);
        });
    }

    /**
     * Parse natural language for navigation intent
     */
    parseIntent(transcript) {
        const text = transcript.toLowerCase().trim();

        // Common navigation patterns
        const patterns = {
            navigate: /(?:take me to|go to|navigate to|find|where is|how do i get to)\s+(.+)/i,
            indoor: /(?:find the|where is the|take me to the)\s+(exit|elevator|lift|stairs|restroom|bathroom|door)/i,
            stop: /(?:stop|cancel|never mind|quit)/i,
            // Enhanced: "from X to Y" patterns (must check BEFORE navigate)
            combined: /(?:from\s+)(.+?)(?:\s+to\s+)(.+)/i
        };

        // Check for stop command
        if (patterns.stop.test(text)) {
            return { type: 'stop' };
        }

        // Check for indoor target FIRST
        const indoorMatch = text.match(patterns.indoor);
        if (indoorMatch) {
            return {
                type: 'indoor',
                target: this.normalizeTarget(indoorMatch[1])
            };
        }

        // Check for combined journey (from X to Y) - BEFORE navigate pattern
        const combinedMatch = text.match(patterns.combined);
        if (combinedMatch) {
            const origin = combinedMatch[1].trim();
            const destination = combinedMatch[2].trim();

            // If origin is "my location" or similar, treat as simple outdoor navigation
            if (/^(my location|here|current location|my current location)$/i.test(origin)) {
                return {
                    type: 'outdoor',
                    destination: destination
                };
            }

            return {
                type: 'combined',
                origin: origin,
                destination: destination
            };
        }

        // Check for general navigation
        const navMatch = text.match(patterns.navigate);
        if (navMatch) {
            const destination = navMatch[1];

            // Check if destination is an indoor target
            const indoorTargets = ['exit', 'elevator', 'lift', 'stairs', 'restroom', 'bathroom', 'door'];
            const isIndoor = indoorTargets.some(t => destination.includes(t));

            if (isIndoor) {
                return {
                    type: 'indoor',
                    target: this.normalizeTarget(destination)
                };
            }

            return {
                type: 'outdoor',
                destination: destination
            };
        }

        // Default: treat as destination
        if (text.length > 0) {
            return {
                type: 'outdoor',
                destination: text
            };
        }

        return { type: 'unknown' };
    }

    /**
     * Normalize indoor targets
     */
    normalizeTarget(target) {
        const mapping = {
            'lift': 'elevator',
            'bathroom': 'restroom',
            'toilet': 'restroom',
            'way out': 'exit',
            'emergency': 'emergency_exit'
        };

        target = target.toLowerCase().trim();
        return mapping[target] || target;
    }

    /**
     * Set callback for speech results
     */
    onResult(callback) {
        this.onResultCallback = callback;
    }

    /**
     * Set callback for listening state changes
     */
    onListeningChange(callback) {
        this.onListeningChangeCallback = callback;
    }

    /**
     * Check if speech recognition is supported
     */
    isSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    /**
     * Check if speech synthesis is supported
     */
    isSynthesisSupported() {
        return !!window.speechSynthesis;
    }
}

// Export global instance
window.VoiceInterface = VoiceInterface;
