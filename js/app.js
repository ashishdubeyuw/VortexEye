/**
 * VortexEye - Main Application
 * Orchestrates all modules and handles UI interactions
 */

class VortexEyeApp {
    constructor() {
        // Services
        this.location = new LocationService();
        this.navigation = new OutdoorNavigation();
        this.vision = new IndoorVision();
        this.voice = new VoiceInterface();
        this.stepCounter = new StepCounter();
        this.stepCounter = new StepCounter();
        this.indoorPos = new IndoorPositioningService();
        this.bluetooth = new BluetoothService(); // New Service

        // State
        this.currentMode = 'indoor'; // Default to indoor mode
        this.currentTarget = null;
        this.sessionStartTime = Date.now();
        this.SESSION_DURATION = 5 * 60 * 1000; // 5 minutes
        this.isSessionExpired = false;
        this.isFromIndoor = true; // Assume starting indoors
        this.lastSpokenDetection = 0; // Timestamp of last spoken detection (for cooldown)
        this.indoorGridInitialized = false;

        // DOM Elements
        this.elements = {};

        // Initialize
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Cache DOM elements FIRST
            this.cacheElements();

            this.showLoading('Initializing VortexEye...');

            // Setup event listeners
            this.setupEventListeners();

            // Start session timer
            this.startSessionTimer();

            // Initialize map
            this.showLoading('Loading map...');
            await this.navigation.initMap('map');

            // Start location service
            this.showLoading('Getting your location...');
            this.location.start();

            // Setup location listener
            this.location.addListener((event, data) => {
                this.handleLocationEvent(event, data);
                this.handleLocationEvent(event, data);
            });

            // Start Bluetooth service
            this.bluetooth.start();
            this.bluetooth.addListener((event, data) => {
                if (event === 'position') {
                    // Fuse BLE position with Indoor Positioning
                    this.indoorPos.updateFromBluetooth(data);

                    // Update UI source indicator
                    if (this.elements.positionSource) {
                        this.elements.positionSource.innerText = '🔵 Bluetooth';
                    }
                }
            });

            // Initialize Debug Panel (hidden by default)
            this.debugPanel = new DebugPanel(this);

            // Setup voice listeners
            this.setupVoiceListeners();

            // Setup map click for start location picking
            this.navigation.onStartLocationPicked((lat, lng, address) => {
                this.elements.startInput.value = address;
                this.pickedStartCoords = { lat, lng };
            });

            // Setup step counter listener (start() happens on user gesture)
            this.stepCounter.addListener((data) => {
                this.updateStepCount(data.stepCount, data.distanceMeters);

                // Update indoor positioning via dead reckoning
                if (this.currentMode === 'indoor' && this.indoorGridInitialized) {
                    const heading = this.location.getHeading() || 0;
                    this.indoorPos.updatePosition(data, heading);

                    // Update UI Heading
                    if (this.elements.userHeading) {
                        this.elements.userHeading.textContent = `${Math.round(heading)}°`;
                    }

                    // Update quadrant highlight on mini-map
                    this.navigation.highlightCurrentQuadrant(this.indoorPos);
                }
            });

            // Setup indoor positioning listeners
            this.indoorPos.addListener((event, data) => {
                this.handleIndoorPositionEvent(event, data);
            });

            // Hide loading overlay
            this.hideLoading();

            console.log('🌀 VortexEye initialized');

            // Start in outdoor mode by default (Landing Page: Map Only)
            // Indoor mode will be activated when user selects an indoor target
            this.switchMode('outdoor');

            // Initialize camera just in case (permissions), but don't start processing
            try {
                await this.vision.initCamera();
                console.log('📷 Camera initialized (waiting for indoor mode)');
            } catch (error) {
                console.warn('Camera permission check failed:', error);
            }

            // Welcome message
            setTimeout(() => {
                this.voice.speak('Welcome to Vortex Eye. Select a destination to start.');
            }, 1000);

            // Update initial guidance
            this.updateGuidance('📸', 'Point camera to scan for objects');

        } catch (error) {
            console.error('Initialization error:', error);
            this.showLoading(`Error: ${error.message}`);
        }
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // Views
            mapView: document.getElementById('mapView'),
            cameraView: document.getElementById('cameraView'),

            // Mode indicator
            modeIndicator: document.getElementById('modeIndicator'),
            modeIcon: document.getElementById('modeIcon'),
            modeText: document.getElementById('modeText'),

            // Session timer
            timerDisplay: document.getElementById('timerDisplay'),
            timerProgress: document.getElementById('timerProgress'),

            // Direction (outdoor)
            directionCard: document.getElementById('directionCard'),
            directionIcon: document.getElementById('directionIcon'),
            directionText: document.getElementById('directionText'),

            // Indoor direction card (top center, like outdoor)
            indoorDirectionCard: document.getElementById('indoorDirectionCard'),
            indoorDirectionIcon: document.getElementById('indoorDirectionIcon'),
            indoorDirectionText: document.getElementById('indoorDirectionText'),

            // Indoor mini-map
            indoorMiniMap: document.getElementById('indoorMiniMap'),

            // Indoor guidance (legacy - for compatibility)
            guidanceIcon: document.getElementById('guidanceIcon'),
            guidanceText: document.getElementById('guidanceText'),

            // Status
            targetStatus: document.getElementById('targetStatus'),
            navStatus: document.getElementById('navStatus'),

            // Input
            startInput: document.getElementById('startInput'),
            clearStartBtn: document.getElementById('clearStartBtn'),
            destinationInput: document.getElementById('destinationInput'),
            goBtn: document.getElementById('goBtn'),
            micBtn: document.getElementById('micBtn'),
            voiceBtn: document.getElementById('voiceBtn'),
            quickBtns: document.querySelectorAll('.quick-btn'),

            // Route Preview (Start button)
            routePreview: document.getElementById('routePreview'),
            routeDestination: document.getElementById('routeDestination'),
            routeDistance: document.getElementById('routeDistance'),
            routeDuration: document.getElementById('routeDuration'),
            startNavBtn: document.getElementById('startNavBtn'),
            cancelRouteBtn: document.getElementById('cancelRouteBtn'),

            // Offline badge
            offlineBadge: document.getElementById('offlineBadge'),

            // Overlays
            loadingOverlay: document.getElementById('loadingOverlay'),
            loadingText: document.getElementById('loadingText'),
            expiredOverlay: document.getElementById('expiredOverlay'),
            restartBtn: document.getElementById('restartBtn'),

            // Autocomplete
            suggestionsDropdown: document.getElementById('suggestionsDropdown'),

            // Step counter
            stepCount: document.getElementById('stepCount'),
            userHeading: document.getElementById('userHeading'),

            // Position source indicator
            positionSource: document.getElementById('positionSource'),

            // Settings & About
            settingsBtn: document.getElementById('settingsBtn'),
            settingsOverlay: document.getElementById('settingsOverlay'),
            closeSettingsBtn: document.getElementById('closeSettingsBtn'),
            audioToggle: document.getElementById('audioToggle'),
            aboutBtn: document.getElementById('aboutBtn'),
            aboutOverlay: document.getElementById('aboutOverlay'),
            closeAboutBtn: document.getElementById('closeAboutBtn')
        };
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Go button
        this.elements.goBtn.addEventListener('click', () => {
            this.handleDestinationSubmit();
        });

        // Enter key on input
        this.elements.destinationInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleDestinationSubmit();
            }
        });

        // Mic button
        this.elements.micBtn.addEventListener('click', () => {
            this.voice.startListening();
        });

        // Voice button (header)
        this.elements.voiceBtn.addEventListener('click', () => {
            this.voice.startListening();
        });

        // Quick action buttons
        this.elements.quickBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                this.handleIndoorTarget(target);
            });
        });

        // Clear start location button
        this.elements.clearStartBtn.addEventListener('click', () => {
            this.elements.startInput.value = '';
            this.elements.startInput.placeholder = 'Current Location (tap to change)';
            this.pickedStartCoords = null;
            this.navigation.clearStartMarker();
        });

        // Autocomplete for start input
        let autocompleteTimeout = null;
        this.elements.startInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(autocompleteTimeout);

            // Clear picked coordinates when user types (they're overriding the pin)
            this.pickedStartCoords = null;
            this.navigation.clearStartMarker();

            if (query.length < 3) {
                this.hideSuggestions();
                return;
            }

            // Debounce: wait 400ms before searching
            autocompleteTimeout = setTimeout(async () => {
                try {
                    const suggestions = await this.fetchSuggestions(query);
                    this.showSuggestions(suggestions, 'start');
                } catch (err) {
                    console.warn('Autocomplete error:', err);
                }
            }, 400);
        });

        // Also add autocomplete for destination input
        this.elements.destinationInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(autocompleteTimeout);

            if (query.length < 3) {
                this.hideSuggestions();
                return;
            }

            autocompleteTimeout = setTimeout(async () => {
                try {
                    const suggestions = await this.fetchSuggestions(query);
                    this.showSuggestions(suggestions, 'destination');
                } catch (err) {
                    console.warn('Autocomplete error:', err);
                }
            }, 400);
        });

        // Restart session button
        this.elements.restartBtn.addEventListener('click', () => {
            this.restartSession();
        });

        // Start Navigation button
        this.elements.startNavBtn.addEventListener('click', () => {
            this.confirmStartNavigation();
        });

        // Cancel Route button
        this.elements.cancelRouteBtn.addEventListener('click', () => {
            this.cancelPendingRoute();
        });

        // Offline/Online detection
        window.addEventListener('online', () => {
            this.updateOfflineStatus(false);
        });

        window.addEventListener('offline', () => {
            this.updateOfflineStatus(true);
        });

        // Settings Modals
        if (this.elements.settingsBtn) {
            this.elements.settingsBtn.addEventListener('click', () => {
                this.elements.settingsOverlay.classList.remove('hidden');

                // Initialize toggle state from VoiceInterface
                if (this.elements.audioToggle) {
                    this.elements.audioToggle.checked = this.voice.audioEnabled;
                }
            });
        }

        if (this.elements.closeSettingsBtn) {
            this.elements.closeSettingsBtn.addEventListener('click', () => {
                this.elements.settingsOverlay.classList.add('hidden');
            });
        }

        if (this.elements.audioToggle) {
            this.elements.audioToggle.addEventListener('change', (e) => {
                this.voice.setAudioEnabled(e.target.checked);
            });
        }

        if (this.elements.aboutBtn) {
            this.elements.aboutBtn.addEventListener('click', () => {
                this.elements.settingsOverlay.classList.add('hidden');
                this.elements.aboutOverlay.classList.remove('hidden');
            });
        }

        if (this.elements.closeAboutBtn) {
            this.elements.closeAboutBtn.addEventListener('click', () => {
                this.elements.aboutOverlay.classList.add('hidden');
            });
        }

        // Check initial offline status
        this.updateOfflineStatus(!navigator.onLine);
    }

    /**
     * Setup voice interface listeners
     */
    setupVoiceListeners() {
        // Listening state change
        this.voice.onListeningChange((isListening) => {
            this.elements.micBtn.classList.toggle('listening', isListening);
        });

        // Voice result
        this.voice.onResult((transcript) => {
            this.elements.destinationInput.value = transcript;

            const intent = this.voice.parseIntent(transcript);
            this.handleVoiceIntent(intent);
        });
    }

    /**
     * Handle voice intent
     */
    handleVoiceIntent(intent) {
        console.log('Intent:', intent);

        switch (intent.type) {
            case 'indoor':
                this.handleIndoorTarget(intent.target);
                break;

            case 'outdoor':
                this.handleOutdoorNavigation(intent.destination);
                break;

            case 'combined':
                this.handleCombinedJourney(intent.origin, intent.destination);
                break;

            case 'stop':
                this.stopNavigation();
                break;

            default:
                this.voice.speak("I didn't understand. Try saying 'Take me to' followed by a destination.");
        }
    }

    /**
     * Handle destination form submit
     */
    handleDestinationSubmit() {
        const destination = this.elements.destinationInput.value.trim();
        if (!destination) return;

        const intent = this.voice.parseIntent(destination);
        this.handleVoiceIntent(intent);
    }

    /**
     * Handle indoor target search
     */
    async handleIndoorTarget(target) {
        this.currentTarget = target;
        this.updateStatus(target, 'Searching...');

        // Switch to indoor mode
        this.switchMode('indoor');

        // Initialize camera if not already
        if (!this.vision.isRunning) {
            try {
                await this.vision.initCamera();
                this.vision.start();
            } catch (error) {
                this.voice.speak('Camera access denied. Please allow camera access.');
                return;
            }
        }

        // Set detection target
        this.vision.setTarget(target);

        // Register vision detection for both routing modes (wifi-enhance and camera-only)
        this.vision.onDetection((detection) => {
            this.handleDetection(detection);
        });

        // Use indoor positioning to find optimal target via multi-exit routing
        if (this.indoorGridInitialized) {
            const result = this.indoorPos.selectOptimalTarget(target);
            if (result) {
                // Draw the A* route on the mini-map
                this.navigation.drawQuadrantRoute(result.route, this.indoorPos);

                // Show instruction
                const instruction = this.indoorPos.getNextInstruction();
                this.updateGuidance(instruction.icon, instruction.text);

                // Announce candidates
                const allCandidates = this.indoorPos.getAllCandidates();
                if (allCandidates.length > 1) {
                    this.voice.speak(`Found ${allCandidates.length} ${target}s. Best route is to ${result.label}, ${result.pathLength} quadrants away. Score ${result.score}.`);
                } else {
                    this.voice.speak(`Found ${target} at ${result.label}. ${result.pathLength} quadrants away.`);
                }

                this.updateStatus(target, `Route: ${result.pathLength} steps · Score ${result.score}`);
                return;
            }
        }

        this.voice.speak(`Scanning for ${target}. Please look around slowly.`);
        this.updateGuidance('🔍', `Scanning for ${target}...`);
    }

    /**
     * Handle detection result
     */
    handleDetection(detection) {
        // Handle Obstacle Warning (High Priority)
        if (detection.isObstacle) {
            this.updateGuidance('⚠️', 'Obstacle ahead! Please stop.');
            this.voice.speak('Obstacle ahead. Stop.');

            // Show red overlay warning
            const overlay = document.getElementById('detectionOverlay');
            if (overlay) {
                overlay.style.border = '4px solid #ef4444';
                overlay.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';

                // Clear after 2 seconds
                clearTimeout(this.obstacleTimeout);
                this.obstacleTimeout = setTimeout(() => {
                    overlay.style.border = 'none';
                    overlay.style.backgroundColor = 'transparent';
                    this.updateGuidance('✅', 'Path clear.');
                }, 2000);
            }
            return;
        }

        const guidance = this.vision.generateGuidance(detection);
        this.updateGuidance(guidance.icon, guidance.text);
        this.updateStatus(this.currentTarget, 'Found!');

        // Feed detection to indoor positioning for drift correction
        if (this.indoorGridInitialized) {
            this.indoorPos.correctWithDetection(detection);
            // Update quadrant highlight after correction
            this.navigation.highlightCurrentQuadrant(this.indoorPos);
        }

        // Draw predicted path on map from user position to detected object
        const heading = this.location.getHeading() || 0;
        this.navigation.drawIndoorPredictedPath(detection, heading);

        // Speak guidance only once every 10 seconds to avoid spam
        const now = Date.now();
        const SPEAK_COOLDOWN = 10000; // 10 seconds
        if (now - this.lastSpokenDetection > SPEAK_COOLDOWN) {
            this.voice.speak(guidance.text);
            this.lastSpokenDetection = now;
        }
    }

    /**
     * Handle outdoor navigation
     */
    async handleOutdoorNavigation(destination) {
        this.currentTarget = destination;
        this.updateStatus(destination, 'Finding nearby...');

        // Switch to outdoor mode
        this.switchMode('outdoor');

        try {
            // Determine origin: custom start location or current GPS
            let originCoords;
            const customStart = this.elements.startInput.value.trim();

            if (customStart) {
                // Geocode custom start location
                this.updateStatus(destination, 'Finding start location...');
                const startResult = await this.navigation.geocode(customStart);
                originCoords = { lat: startResult.lat, lng: startResult.lng };
            } else {
                // Use current GPS position
                const currentPos = this.location.getPosition();
                if (!currentPos) {
                    this.voice.speak('Waiting for GPS signal...');
                    this.updateStatus(destination, 'Waiting for GPS...');
                    return;
                }
                originCoords = { lat: currentPos.lat, lng: currentPos.lng };
            }

            // Geocode destination with location bias (finds nearest)
            this.updateStatus(destination, 'Finding nearest...');
            const destCoords = await this.navigation.geocode(destination, originCoords);

            // Calculate route
            const route = await this.navigation.getRoute(
                originCoords,
                destCoords
            );

            // Display route on map (with indoor segment if coming from inside or still detecting)
            const hasIndoorSegment = this.isFromIndoor ||
                this.location.getMode() === 'indoor' ||
                this.location.getMode() === 'detecting';
            this.navigation.displayRoute(destCoords, hasIndoorSegment);

            // Store pending route info for Start button
            this.pendingRoute = {
                destination,
                destCoords,
                route,
                hasIndoorSegment
            };

            // Show route preview card with Start button
            const distanceText = this.navigation.formatDistance(route.distance);
            const durationText = this.navigation.formatDuration(route.duration, route.distance);
            this.showRoutePreview(destCoords.displayName || destination, distanceText, durationText);

            // Update status
            this.updateStatus(destination, `${distanceText} • ${durationText}`);

            // Speak the route info
            this.voice.speak(`Route found. ${distanceText}, about ${durationText}. Press Start to begin navigation.`);

        } catch (error) {
            console.error('Navigation error:', error);
            this.voice.speak(`Sorry, couldn't find route to ${destination}`);
            this.updateStatus(destination, 'Route not found');
        }
    }

    /**
     * Show route preview card
     */
    showRoutePreview(destination, distance, duration) {
        this.elements.routeDestination.textContent = `📍 ${destination}`;
        this.elements.routeDistance.textContent = distance;
        this.elements.routeDuration.textContent = duration;
        this.elements.routePreview.classList.remove('hidden');
    }

    /**
     * Hide route preview card
     */
    hideRoutePreview() {
        this.elements.routePreview.classList.add('hidden');
    }

    /**
     * Confirm and start navigation (called when Start button pressed)
     */
    confirmStartNavigation() {
        if (!this.pendingRoute) return;

        // Hide the preview card
        this.hideRoutePreview();

        // Switch to indoor mode (Split Screen) for navigation as requested
        this.switchMode('indoor');

        // Start navigation
        this.navigation.startNavigation();

        // Get first instruction
        const instruction = this.navigation.getNextInstruction();
        if (instruction) {
            this.showDirection(
                this.navigation.getDirectionEmoji(instruction.maneuver),
                instruction.instruction
            );
        }

        // Speak first instruction
        this.voice.speak(`Navigation started. ${instruction?.instruction || 'Proceed to route.'}`);

        // Start step counter here to capture user gesture for sensor permissions
        this.stepCounter.start().then(started => {
            if (!started) console.warn('Step counter could not start. Ensure permissions are granted.');
        });

        // Automatically start looking for indoor targets
        let initialVisionTarget = 'navigation_default';
        if (this.pendingRoute.hasIndoorSegment) {
            // When navigating outside from inside, we should actively hunt for the exit/door first to get out securely.
            initialVisionTarget = 'door';
        }

        if (!this.vision.isRunning) {
            try {
                this.vision.initCamera().then(() => {
                    this.vision.start();
                    this.vision.setTarget(initialVisionTarget);
                });
            } catch (e) {
                console.warn('Camera failed to start:', e);
            }
        } else {
            this.vision.setTarget(initialVisionTarget);
        }

        // Ensure vision detections are handled
        this.vision.onDetection((detection) => {
            this.handleDetection(detection);
        });

        // Log it
        if (window.vxLog) {
            window.vxLog.navigation('Navigation started', {
                destination: this.pendingRoute.destination
            });
        }

        this.pendingRoute = null;
    }

    /**
     * Cancel pending route
     */
    cancelPendingRoute() {
        this.hideRoutePreview();
        this.navigation.stopNavigation();
        this.pendingRoute = null;
        this.currentTarget = null;

        this.updateStatus('None', 'Ready');
        this.voice.speak('Route cancelled.');

        if (window.vxLog) {
            window.vxLog.navigation('Route cancelled');
        }
    }

    /**
     * Update offline status indicator
     */
    updateOfflineStatus(isOffline) {
        if (isOffline) {
            this.elements.offlineBadge.classList.remove('hidden');
            if (window.vxLog) {
                window.vxLog.warn('Network', 'Device went offline');
            }
        } else {
            this.elements.offlineBadge.classList.add('hidden');
            if (window.vxLog) {
                window.vxLog.info('Network', 'Device is online');
            }
        }
    }

    /**
     * Handle combined indoor to outdoor journey
     */
    async handleCombinedJourney(origin, destination) {
        // First, find exit (indoor phase)
        this.voice.speak(`I'll help you get from ${origin} to ${destination}. First, let's find the exit.`);

        this.updateStatus(`${origin} → ${destination}`, 'Finding exit...');

        // Start indoor navigation to exit
        await this.handleIndoorTarget('exit');

        // The outdoor navigation will be triggered when GPS is restored
        // (detected in handleLocationEvent)
        this.pendingOutdoorDestination = destination;
    }

    /**
     * Stop current navigation
     */
    stopNavigation() {
        this.navigation.stopNavigation();
        this.vision.clearTarget();
        this.vision.stop();

        this.currentTarget = null;
        this.pendingOutdoorDestination = null;

        this.hideDirection();
        this.updateStatus('None', 'Ready');
        this.updateGuidance('🔍', 'Navigation stopped');

        this.voice.speak('Navigation stopped.');
    }

    /**
     * Handle location events
     */
    handleLocationEvent(event, data) {
        switch (event) {
            case 'position':
                // Pass speed and heading to enable dynamic mode switching (walking -> driving)
                this.navigation.updatePosition(data.lat, data.lng, data.speed, data.heading);
                // Update position source indicator
                if (this.elements.positionSource) {
                    const src = this.location.getPositionSource();
                    const labels = { 'gps': '🛰️ GPS', 'wifi-enhanced': '📶 WiFi-Enhanced', 'none': '❌ None' };
                    this.elements.positionSource.textContent = labels[src] || src;
                }
                // Update heading if available
                if (this.elements.userHeading && data.heading !== null && data.heading !== undefined) {
                    this.elements.userHeading.textContent = `${Math.round(data.heading)}°`;
                }
                break;

            case 'modeChange':
                // Automatic mode switching based on GPS signal quality (85%+ required for outdoor)
                const signalPercent = this.location.getSignalStrengthPercent();

                // STRICT LOCK: Never switch to outdoor if an indoor route requires reaching a transition point
                if (data.current === 'outdoor' && this.navigation.transitionPoint) {
                    const currentPos = this.location.getPosition();
                    if (currentPos) {
                        const dist = this.navigation.calculateDistance(
                            currentPos.lat, currentPos.lng,
                            this.navigation.transitionPoint[1], this.navigation.transitionPoint[0]
                        );
                        // If we are more than 15 meters away, STRICTLY stay indoor
                        if (dist > 0.015) {
                            console.log(`🔒 Strict Lock: Staying in indoor mode until orange marker is reached (${(dist * 1000).toFixed(0)}m away)`);
                            this.location.forceIndoorMode();
                            return; // Stop processing the mode change
                        } else {
                            // Reached transition point! Proceed with outdoor switch and clear transition point
                            this.navigation.transitionPoint = null;
                        }
                    } else {
                        // If we don't have a firm position yet, default to strict locking to be safe
                        this.location.forceIndoorMode();
                        return;
                    }
                }

                console.log(`🔄 Auto-switching to ${data.current} mode (GPS signal: ${signalPercent}%)`);

                if (data.current === 'indoor') {
                    // Switch to indoor mode
                    this.switchMode('indoor');
                    this.voice.speak(`GPS signal is ${signalPercent} percent. Using indoor camera mode.`);
                    this.updateGuidance('📸', `Indoor mode (GPS: ${signalPercent}%)`);

                    // Initialize camera if needed
                    if (!this.vision.isRunning) {
                        this.vision.initCamera().then(() => {
                            this.vision.start();

                            // Re-apply target and missing callbacks for the vision loop
                            if (this.currentTarget) {
                                this.vision.setTarget(this.currentTarget);
                            }
                            this.vision.onDetection((detection) => {
                                this.handleDetection(detection);
                            });
                        }).catch(err => {
                            console.warn('Failed to start camera for indoor mode:', err);
                        });
                    } else {
                        // Even if it is running, make sure callback and target are locked in
                        if (this.currentTarget) {
                            this.vision.setTarget(this.currentTarget);
                        }
                        this.vision.onDetection((detection) => {
                            this.handleDetection(detection);
                        });
                    }
                } else {
                    // Switch to outdoor mode (only happens when GPS > 85%)
                    this.switchMode('outdoor');
                    this.voice.speak(`Strong GPS signal at ${signalPercent} percent. Switching to outdoor navigation.`);

                    // If we had a pending destination, resume navigation
                    if (this.pendingOutdoorDestination) {
                        this.handleOutdoorNavigation(this.pendingOutdoorDestination);
                        this.pendingOutdoorDestination = null;
                    }
                }
                break;

            case 'error':
                console.warn('Location error:', data);
                break;
        }
    }

    /**
     * Handle indoor positioning events
     */
    handleIndoorPositionEvent(event, data) {
        switch (event) {
            case 'positionUpdate':
                // Update mini-map with current indoor position
                this.navigation.updateIndoorPosition(data.currentQuadrant, data.positionInQuadrant);
                break;
            case 'instruction':
                this.updateGuidance(data.icon, data.text);
                this.voice.speak(data.text);
                break;
            case 'targetReached':
                this.voice.speak(`You have reached ${data.target}.`);
                this.updateGuidance('✅', `Reached ${data.target}`);
                this.stopNavigation(); // Stop indoor navigation
                break;
            case 'error':
                console.error('Indoor positioning error:', data);
                this.voice.speak(`Indoor positioning error: ${data.message}`);
                break;
        }
    }

    /**
     * Switch between outdoor and indoor mode
     */
    switchMode(mode) {
        this.currentMode = mode;

        // Update UI
        if (mode === 'outdoor') {
            this.elements.mapView.classList.remove('hidden');
            this.elements.cameraView.classList.add('hidden');
            this.elements.modeIndicator.className = 'mode-indicator outdoor';
            this.elements.modeIcon.textContent = '📍';
            this.elements.modeText.textContent = 'Outdoor Navigation';
            // Clear indoor grid overlay
            this.navigation.clearQuadrantOverlay();
        } else {
            this.elements.mapView.classList.add('hidden');
            this.elements.cameraView.classList.remove('hidden');
            this.elements.modeIndicator.className = 'mode-indicator indoor';
            this.elements.modeIcon.textContent = '📸';

            // Set mode text with position source
            const source = this.location.getPositionSource();
            const sourceLabel = source === 'wifi-enhanced' ? 'WiFi-Enhanced' : 'GPS Anchor';
            this.elements.modeText.textContent = `Indoor Navigation (· ${sourceLabel})`;

            // Initialize the indoor mini-map (split-screen view)
            setTimeout(async () => {
                await this.navigation.initIndoorMiniMap('indoorMiniMap');
                this.navigation.replicateRouteToMiniMap();
                this.initIndoorQuadrantGrid();
            }, 100); // Small delay to ensure DOM is ready
        }
    }

    /**
     * Initialize the indoor quadrant grid on mode switch
     */
    initIndoorQuadrantGrid() {
        // Get anchor position from location service or use a default
        const anchor = this.location.getIndoorAnchor() || this.location.getPosition();
        if (anchor) {
            this.indoorPos.setAnchorPosition(anchor);
        } else {
            // No GPS fix yet — use default Seattle coords as anchor
            this.indoorPos.setAnchorPosition({ lat: 47.6553, lng: -122.3035, accuracy: 50 });
        }

        // Initialize quadrant grid with default building config
        const config = BuildingConfigs.getConfig('default');
        this.indoorPos.initQuadrantGrid(config);
        this.indoorGridInitialized = true;

        // Initialize Bluetooth Beacons if available in config
        if (config.beacons && this.bluetooth) {
            this.bluetooth.init(config.beacons);
        }

        // Draw content on the mini-map
        if (this.indoorPos.getCurrentRoute()) {
            // Case 1: Indoor Grid Navigation active - show grid route
            this.navigation.drawQuadrantRoute(this.indoorPos.getCurrentRoute(), this.indoorPos);
        } else if (this.navigation.isNavigating && this.navigation.currentRoute) {
            // Case 2: Outdoor/Mixed Navigation active - show OSRM route on mini-map
            this.navigation.drawOutdoorRouteOnMiniMap();
        } else {
            // Case 3: Just exploring - show grid POIs (but no grid lines as per UI polish)
            this.navigation.drawQuadrantGrid(this.indoorPos);
        }

        // Update position source in status
        if (this.elements.navStatus) {
            this.elements.navStatus.textContent = `Indoor Grid Active (· ${this.indoorPos.getAnchorPosition()?.source || 'anchor'})`;
        }
    }

    /**
     * Update status panel
     */
    updateStatus(target, status) {
        this.elements.targetStatus.textContent = target || 'None';
        this.elements.navStatus.textContent = status || 'Ready';
    }

    /**
     * Update indoor guidance (uses the new top-center direction card)
     */
    updateGuidance(icon, text) {
        // Update new indoor direction card (top center, like outdoor)
        if (this.elements.indoorDirectionIcon) {
            this.elements.indoorDirectionIcon.textContent = icon;
        }
        if (this.elements.indoorDirectionText) {
            this.elements.indoorDirectionText.textContent = text;
        }

        // Also update legacy elements if they exist (for compatibility)
        if (this.elements.guidanceIcon) {
            this.elements.guidanceIcon.textContent = icon;
        }
        if (this.elements.guidanceText) {
            this.elements.guidanceText.textContent = text;
        }
    }

    /**
     * Show direction card
     */
    showDirection(icon, text) {
        this.elements.directionIcon.textContent = icon;
        this.elements.directionText.textContent = text;
        this.elements.directionCard.style.display = 'flex';
    }

    /**
     * Hide direction card
     */
    hideDirection() {
        this.elements.directionCard.style.display = 'none';
    }

    /**
     * Show loading overlay
     */
    showLoading(message) {
        this.elements.loadingText.textContent = message;
        this.elements.loadingOverlay.classList.remove('hidden');
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        this.elements.loadingOverlay.classList.add('hidden');
    }

    /**
     * Start session timer (5 min limit for pilot testing)
     */
    startSessionTimer() {
        this.sessionStartTime = Date.now();

        const updateTimer = () => {
            if (this.isSessionExpired) return;

            const elapsed = Date.now() - this.sessionStartTime;
            const remaining = this.SESSION_DURATION - elapsed;

            if (remaining <= 0) {
                this.expireSession();
                return;
            }

            // Update timer display
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            this.elements.timerDisplay.textContent =
                `${minutes}:${seconds.toString().padStart(2, '0')}`;

            // Update progress bar
            const progress = (remaining / this.SESSION_DURATION) * 100;
            this.elements.timerProgress.style.width = `${progress}%`;

            requestAnimationFrame(updateTimer);
        };

        updateTimer();
    }

    /**
     * Expire session
     */
    expireSession() {
        this.isSessionExpired = true;

        // Stop all services
        this.location.stop();
        this.vision.stop();
        this.navigation.stopNavigation();

        // Show expired overlay
        this.elements.expiredOverlay.classList.remove('hidden');

        this.voice.speak('Pilot session expired. Thank you for testing Vortex Eye!');

        console.log('⏰ Session expired');

        // Auto-upload logs to server
        if (window.vxLog) {
            window.vxLog.uploadLogs();
        }
    }

    /**
     * Restart session
     */
    restartSession() {
        this.isSessionExpired = false;
        this.elements.expiredOverlay.classList.add('hidden');

        // Restart services
        this.location.start();
        this.startSessionTimer();

        this.voice.speak('New session started. Where would you like to go?');

        console.log('🔄 Session restarted');
    }

    /**
     * Fetch suggestions from Nominatim
     */
    async fetchSuggestions(query) {
        const currentPos = this.location.getPosition();
        const params = new URLSearchParams({
            q: query,
            format: 'json',
            limit: 5,
            addressdetails: 1
        });

        // Add location bias if available
        if (currentPos) {
            const delta = 0.5;
            const viewbox = [
                currentPos.lng - delta,
                currentPos.lat + delta,
                currentPos.lng + delta,
                currentPos.lat - delta
            ].join(',');
            params.append('viewbox', viewbox);
            params.append('bounded', '1');
        }

        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?${params}`,
            { headers: { 'User-Agent': 'VortexEye/1.0' } }
        );
        return await response.json();
    }

    /**
     * Show suggestions dropdown
     */
    showSuggestions(results, targetField) {
        const dropdown = this.elements.suggestionsDropdown;

        if (!results || results.length === 0) {
            this.hideSuggestions();
            return;
        }

        dropdown.innerHTML = results.map(r => {
            const parts = r.display_name.split(',');
            const shortName = parts.slice(0, 3).join(',').trim();
            return `<div class="suggestion-item" data-lat="${r.lat}" data-lng="${r.lon}" data-name="${shortName}" data-target="${targetField}">${shortName}</div>`;
        }).join('');

        // Add click handlers
        dropdown.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const target = item.dataset.target;
                const name = item.dataset.name;

                if (target === 'start') {
                    this.elements.startInput.value = name;
                    this.pickedStartCoords = {
                        lat: parseFloat(item.dataset.lat),
                        lng: parseFloat(item.dataset.lng)
                    };
                } else {
                    this.elements.destinationInput.value = name;
                }

                this.hideSuggestions();
            });
        });

        dropdown.classList.remove('hidden');
    }

    /**
     * Hide suggestions dropdown
     */
    hideSuggestions() {
        this.elements.suggestionsDropdown.classList.add('hidden');
        this.elements.suggestionsDropdown.innerHTML = '';
    }

    /**
     * Update step count display
     */
    updateStepCount(steps, distanceMeters) {
        if (this.elements.stepCount) {
            const distanceDisplay = distanceMeters > 0
                ? ` (${distanceMeters.toFixed(1)}m)`
                : '';
            this.elements.stepCount.textContent = `${steps}${distanceDisplay}`;
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new VortexEyeApp();
});
