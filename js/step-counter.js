/**
 * VortexEye - Step Counter Module
 * Uses DeviceMotion API (accelerometer) for step detection
 * Enables indoor dead reckoning when GPS is unavailable
 */

class StepCounter {
    constructor() {
        this.isSupported = false;
        this.isRunning = false;
        this.stepCount = 0;
        this.listeners = [];

        // Step detection parameters
        this.lastAccelMagnitude = 0;
        this.threshold = 1.2; // Acceleration threshold to detect step (g)
        this.debounceMs = 300; // Minimum time between steps
        this.lastStepTime = 0;

        // Sensor data
        this.accelerometer = null;
        this.gyroscope = null;

        // History for smoothing
        this.accelHistory = [];
        this.historySize = 5;

        // Stride length for distance estimation (meters)
        this.strideLength = 0.75; // Average adult stride

        // Check sensor availability
        this.checkSensorAvailability();
    }

    /**
     * Check if motion sensors are available
     */
    async checkSensorAvailability() {
        const sensors = {
            accelerometer: false,
            gyroscope: false,
            deviceMotion: false,
            deviceOrientation: false,
            permissionRequired: false
        };

        // Check DeviceMotionEvent (most compatible)
        if ('DeviceMotionEvent' in window) {
            sensors.deviceMotion = true;

            // iOS 13+ requires permission
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                sensors.permissionRequired = true;
            }
        }

        // Check DeviceOrientationEvent
        if ('DeviceOrientationEvent' in window) {
            sensors.deviceOrientation = true;
        }

        // Check Accelerometer API (newer, less supported)
        if ('Accelerometer' in window) {
            sensors.accelerometer = true;
        }

        // Check Gyroscope API (newer, less supported)
        if ('Gyroscope' in window) {
            sensors.gyroscope = true;
        }

        this.isSupported = sensors.deviceMotion;
        this.sensors = sensors;

        console.log('📱 Sensor availability:', sensors);
        return sensors;
    }

    /**
     * Request permission for motion sensors (required on iOS 13+)
     */
    async requestPermission() {
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission === 'granted') {
                    console.log('✅ Motion sensor permission granted');
                    return true;
                } else {
                    console.warn('❌ Motion sensor permission denied');
                    return false;
                }
            } catch (error) {
                console.error('Permission request error:', error);
                return false;
            }
        }
        // No permission needed (Android or older iOS)
        return true;
    }

    /**
     * Start step counting
     */
    async start() {
        if (this.isRunning) return true;

        const hasPermission = this.isSupported ? await this.requestPermission() : false;

        if (!hasPermission || !this.isSupported) {
            console.warn('⚠️ DeviceMotion not available or permitted. Falling back to GPS distance for step estimation.');
            // Add GPS fallback listener via window.app.location if available
            if (window.app && window.app.location) {
                this.lastGpsPosition = window.app.location.getPosition();
                this.gpsListener = (event, data) => {
                    if (event === 'position' && this.isRunning) {
                        this.handleGpsFallback(data);
                    }
                };
                window.app.location.addListener(this.gpsListener);
            }
        } else {
            // Add motion event listener
            window.addEventListener('devicemotion', this.handleMotion.bind(this));
        }

        this.isRunning = true;
        this.stepCount = 0;
        this.lastStepTime = Date.now();

        console.log('🚶 Step counter started');
        return true;
    }

    /**
     * Stop step counting
     */
    stop() {
        if (!this.isRunning) return;

        window.removeEventListener('devicemotion', this.handleMotion.bind(this));

        if (this.gpsListener && window.app && window.app.location) {
            // Can't easily remove specific anonymous listeners in this architecture 
            // without a dedicated removeListener method, but we have `isRunning` check
            this.gpsListener = null;
        }

        this.isRunning = false;

        console.log(`🚶 Step counter stopped. Total steps: ${this.stepCount}`);
    }

    /**
     * Handle GPS position updates to estimate steps when accelerometer is unavailable
     */
    handleGpsFallback(position) {
        if (!this.lastGpsPosition) {
            this.lastGpsPosition = position;
            return;
        }

        // Calculate distance since last update
        if (window.app && window.app.navigation) {
            const distanceKm = window.app.navigation.calculateDistance(
                this.lastGpsPosition.lat, this.lastGpsPosition.lng,
                position.lat, position.lng
            );

            const distanceMeters = distanceKm * 1000;

            // Only count if moved more than 1 meter (to filter GPS jitter)
            if (distanceMeters > 1.0) {
                // Estimate steps based on stride length
                const estimatedSteps = Math.round(distanceMeters / this.strideLength);

                if (estimatedSteps > 0) {
                    this.stepCount += estimatedSteps;
                    this.lastGpsPosition = position;
                    this.notifyListeners();
                }
            }
        }
    }

    /**
     * Handle motion event from accelerometer
     */
    handleMotion(event) {
        const accel = event.accelerationIncludingGravity;

        if (!accel || accel.x === null) return;

        // Calculate magnitude of acceleration vector
        const magnitude = Math.sqrt(
            accel.x * accel.x +
            accel.y * accel.y +
            accel.z * accel.z
        );

        // Add to history for smoothing
        this.accelHistory.push(magnitude);
        if (this.accelHistory.length > this.historySize) {
            this.accelHistory.shift();
        }

        // Calculate smoothed magnitude
        const smoothed = this.accelHistory.reduce((a, b) => a + b, 0) / this.accelHistory.length;

        // Detect step using peak detection
        // Step occurs when acceleration crosses threshold going up, then down
        const now = Date.now();
        const timeSinceLastStep = now - this.lastStepTime;

        // Normalize to g (gravity = 9.81 m/s²)
        const normalizedMagnitude = smoothed / 9.81;

        // Detect peak (step) - magnitude exceeds threshold and debounce period passed
        if (normalizedMagnitude > this.threshold &&
            this.lastAccelMagnitude <= this.threshold &&
            timeSinceLastStep > this.debounceMs) {

            this.stepCount++;
            this.lastStepTime = now;

            // Notify listeners
            this.notifyListeners({
                stepCount: this.stepCount,
                timestamp: now,
                distanceMeters: this.getDistanceWalked()
            });

            console.log(`👟 Step ${this.stepCount} detected`);
        }

        this.lastAccelMagnitude = normalizedMagnitude;
    }

    /**
     * Get current step count
     */
    getStepCount() {
        return this.stepCount;
    }

    /**
     * Get estimated distance walked (meters)
     */
    getDistanceWalked() {
        return this.stepCount * this.strideLength;
    }

    /**
     * Reset step counter
     */
    reset() {
        this.stepCount = 0;
        this.accelHistory = [];
        this.lastStepTime = Date.now();
        console.log('🔄 Step counter reset');
    }

    /**
     * Set stride length for more accurate distance
     */
    setStrideLength(meters) {
        this.strideLength = meters;
    }

    /**
     * Add listener for step events
     */
    addListener(callback) {
        this.listeners.push(callback);
    }

    /**
     * Remove listener
     */
    removeListener(callback) {
        this.listeners = this.listeners.filter(l => l !== callback);
    }

    /**
     * Notify all listeners
     */
    notifyListeners(data) {
        this.listeners.forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                console.error('Step listener error:', e);
            }
        });
    }

    /**
     * Get sensor status for UI display
     */
    getSensorStatus() {
        return {
            isSupported: this.isSupported,
            isRunning: this.isRunning,
            sensors: this.sensors,
            stepCount: this.stepCount,
            distanceMeters: this.getDistanceWalked()
        };
    }
}

// Export global instance
window.StepCounter = StepCounter;
