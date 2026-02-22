/**
 * VortexEye - Indoor Vision Module
 * Camera-based object detection with OCR for sign reading
 * Uses YOLOv8 concepts (simulated for MVP, real model in Phase 2)
 */

class IndoorVision {
    constructor() {
        this.videoElement = null;
        this.canvasElement = null;
        this.ctx = null;
        this.stream = null;
        this.isRunning = false;
        this.currentTarget = null;
        this.detections = [];
        this.onDetectionCallback = null;

        // Sequence parameters for navigation_default
        this.navSequence = ['door', 'exit_sign', 'signboard', 'elevator'];
        this.currentSequenceIndex = 0;
        this.detectionCount = 0;
        this.requiredDetectionsToAdvance = 5;

        // Detection classes for indoor navigation
        this.CLASSES = {
            0: { name: 'exit_sign', emoji: '🚪', label: 'Exit' },
            1: { name: 'door', emoji: '🚪', label: 'Door' },
            2: { name: 'elevator', emoji: '🛗', label: 'Elevator' },
            3: { name: 'stairs', emoji: '🪜', label: 'Stairs' },
            4: { name: 'emergency_exit', emoji: '🆘', label: 'Emergency Exit' },
            5: { name: 'restroom', emoji: '🚻', label: 'Restroom' },
            6: { name: 'signboard', emoji: '🪧', label: 'Sign' }
        };

        // Simulated detection areas (for MVP demo)
        // In Phase 2, this will be replaced with real YOLOv8 inference
        this.simulatedDetections = [];

        // Average stride length in meters (adjustable for different users)
        this.STRIDE_LENGTH_METERS = 0.75; // ~2.5 feet per step
    }

    /**
     * Convert meters to approximate walking steps
     * Uses average stride length of 0.75m
     */
    metersToSteps(meters) {
        return Math.round(meters / this.STRIDE_LENGTH_METERS);
    }

    /**
     * Initialize camera
     */
    async initCamera() {
        this.videoElement = document.getElementById('cameraFeed');
        this.canvasElement = document.getElementById('detectionCanvas');

        if (!this.videoElement || !this.canvasElement) {
            throw new Error('Video or canvas element not found');
        }

        this.ctx = this.canvasElement.getContext('2d');

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Rear camera
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            this.videoElement.srcObject = this.stream;

            // Wait for video to be ready
            await new Promise(resolve => {
                this.videoElement.onloadedmetadata = () => {
                    this.canvasElement.width = this.videoElement.videoWidth;
                    this.canvasElement.height = this.videoElement.videoHeight;
                    resolve();
                };
            });

            console.log('📸 Camera initialized');
            return true;
        } catch (error) {
            console.error('Camera error:', error);
            throw error;
        }
    }

    /**
     * Start detection loop
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.detectionLoop();
        console.log('🔍 Indoor vision started');
    }

    /**
     * Stop detection loop
     */
    stop() {
        this.isRunning = false;

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        console.log('🔍 Indoor vision stopped');
    }

    /**
     * Main detection loop
     */
    detectionLoop() {
        if (!this.isRunning) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

        // Run detection (simulated for MVP)
        this.detectObjects();

        // Draw detections
        this.drawDetections();

        // Continue loop
        requestAnimationFrame(() => this.detectionLoop());
    }

    /**
     * Detect objects in current frame
     * MVP: Simulated detection, Phase 2: Real YOLOv8
     */
    detectObjects() {
        // For MVP demo, we'll simulate detections based on current target
        // In Phase 2, this will use ONNX Runtime with YOLOv8 model

        if (!this.currentTarget && !this.simulatedObstacle) {
            this.detections = [];
            return;
        }

        // Check for simulated obstacle (Highest Priority)
        if (this.simulatedObstacle) {
            // Keep triggering it every few frames to persist warning
            if (Math.random() < 0.2) {
                this.triggerObstacleWarning();
                return;
            }
        }

        // Simulate detection appearance
        if (Math.random() < 0.05) { // 5% chance per frame (slightly higher for testing sequencing)
            let classInfo;
            if (this.currentTarget === 'navigation_default') {
                // Fetch the current object we're looking for in the sequence
                const currentSequenceTarget = this.navSequence[this.currentSequenceIndex];
                classInfo = this.getClassByTargetName(currentSequenceTarget);
            } else {
                classInfo = this.getClassByTargetName(this.currentTarget);
            }

            if (classInfo) {
                // Simulate detection appearing in frame
                const width = this.canvasElement.width;
                const height = this.canvasElement.height;

                // Random position for bbox
                const bboxX = width * (0.2 + Math.random() * 0.3);
                const bboxWidth = width * (0.2 + Math.random() * 0.1);
                const objectCenterX = bboxX + bboxWidth / 2;

                // Calculate direction with degrees
                const directionInfo = this.calculateDirection(objectCenterX);

                this.detections = [{
                    classId: classInfo.id,
                    className: classInfo.name,
                    label: classInfo.label,
                    emoji: classInfo.emoji,
                    confidence: 0.85 + Math.random() * 0.1,
                    bbox: {
                        x: bboxX,
                        y: height * (0.2 + Math.random() * 0.3),
                        width: bboxWidth,
                        height: height * (0.2 + Math.random() * 0.1)
                    },
                    direction: directionInfo.direction,
                    directionInfo: directionInfo, // Full info with degrees
                    distanceMeters: Math.floor(3 + Math.random() * 8), // 3-10 meters
                    distance: this.metersToSteps(Math.floor(3 + Math.random() * 8)) // Convert to steps
                }];

                // Handle Sequence Advancement if using navigation_default
                if (this.currentTarget === 'navigation_default') {
                    this.detectionCount++;
                    if (this.detectionCount >= this.requiredDetectionsToAdvance) {
                        this.detectionCount = 0; // reset

                        // Advance to the next item in sequence
                        if (this.currentSequenceIndex < this.navSequence.length - 1) {
                            this.currentSequenceIndex++;
                        } else {
                            // Loop back to the start of the sequence
                            this.currentSequenceIndex = 0;
                            console.log(`🧭 Reached final target in sequence, resetting circuit.`);
                        }

                        const nextTarget = this.navSequence[this.currentSequenceIndex];
                        console.log(`🧭 Sequence Advanced: Now looking for ${nextTarget}`);
                    }
                }

                // Notify callback
                if (this.onDetectionCallback && this.detections.length > 0) {
                    this.onDetectionCallback(this.detections[0]);
                }
            }
        }
    }

    /**
     * Get class info by target name
     */
    getClassByTargetName(targetName) {
        const target = targetName.toLowerCase();

        for (const [id, classInfo] of Object.entries(this.CLASSES)) {
            if (classInfo.name.includes(target) ||
                classInfo.label.toLowerCase().includes(target) ||
                target.includes(classInfo.label.toLowerCase())) {
                return { id: parseInt(id), ...classInfo };
            }
        }

        // Default to exit sign for unknown targets
        return { id: 0, ...this.CLASSES[0] };
    }

    /**
     * Calculate direction and degrees based on object position in frame
     * Uses camera FOV to determine actual turning angle
     */
    calculateDirection(objectCenterX) {
        const frameCenter = this.canvasElement.width / 2;
        const frameWidth = this.canvasElement.width;

        // Assume ~60° horizontal FOV for typical phone camera
        const HORIZONTAL_FOV = 60;

        // Calculate offset from center (-0.5 to 0.5)
        const offsetRatio = (objectCenterX - frameCenter) / frameWidth;

        // Convert to degrees (-30° to +30° for 60° FOV)
        const angleDegrees = Math.round(offsetRatio * HORIZONTAL_FOV);

        // Determine direction category
        let direction;
        let instruction;

        if (Math.abs(angleDegrees) <= 10) {
            direction = 'ahead';
            instruction = 'Go straight ahead';
        } else if (angleDegrees < -10 && angleDegrees >= -30) {
            direction = 'slight_left';
            instruction = `Turn ${Math.abs(angleDegrees)}° left`;
        } else if (angleDegrees > 10 && angleDegrees <= 30) {
            direction = 'slight_right';
            instruction = `Turn ${angleDegrees}° right`;
        } else if (angleDegrees < -30) {
            direction = 'left';
            instruction = `Turn ${Math.abs(angleDegrees)}° left`;
        } else {
            direction = 'right';
            instruction = `Turn ${angleDegrees}° right`;
        }

        return {
            direction,
            angleDegrees,
            instruction
        };
    }

    /**
     * Calculate turn instruction when target is NOT in frame
     * Called when user needs to scan/rotate to find target
     */
    getScanInstruction(lastKnownDirection) {
        const instructions = {
            'left': 'Turn 90° left and scan',
            'right': 'Turn 90° right and scan',
            'behind': 'Turn around (180°) and scan',
            'unknown': 'Rotate slowly to scan surroundings'
        };
        return instructions[lastKnownDirection] || instructions['unknown'];
    }

    /**
     * Draw detection boxes and labels
     */
    drawDetections() {
        this.detections.forEach(det => {
            const { bbox, label, confidence, direction, distance } = det;

            // Draw bounding box with glow effect
            this.ctx.strokeStyle = '#6366f1';
            this.ctx.lineWidth = 3;
            this.ctx.shadowColor = '#6366f1';
            this.ctx.shadowBlur = 15;
            this.ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);
            this.ctx.shadowBlur = 0;

            // Draw corner accents
            const cornerLength = 20;
            this.ctx.strokeStyle = '#10b981';
            this.ctx.lineWidth = 4;

            // Top-left corner
            this.ctx.beginPath();
            this.ctx.moveTo(bbox.x, bbox.y + cornerLength);
            this.ctx.lineTo(bbox.x, bbox.y);
            this.ctx.lineTo(bbox.x + cornerLength, bbox.y);
            this.ctx.stroke();

            // Top-right corner
            this.ctx.beginPath();
            this.ctx.moveTo(bbox.x + bbox.width - cornerLength, bbox.y);
            this.ctx.lineTo(bbox.x + bbox.width, bbox.y);
            this.ctx.lineTo(bbox.x + bbox.width, bbox.y + cornerLength);
            this.ctx.stroke();

            // Bottom-left corner
            this.ctx.beginPath();
            this.ctx.moveTo(bbox.x, bbox.y + bbox.height - cornerLength);
            this.ctx.lineTo(bbox.x, bbox.y + bbox.height);
            this.ctx.lineTo(bbox.x + cornerLength, bbox.y + bbox.height);
            this.ctx.stroke();

            // Bottom-right corner
            this.ctx.beginPath();
            this.ctx.moveTo(bbox.x + bbox.width - cornerLength, bbox.y + bbox.height);
            this.ctx.lineTo(bbox.x + bbox.width, bbox.y + bbox.height);
            this.ctx.lineTo(bbox.x + bbox.width, bbox.y + bbox.height - cornerLength);
            this.ctx.stroke();

            // Draw label background
            const labelText = `${label} • ${(confidence * 100).toFixed(0)}% • ${distance}m ${direction}`;
            this.ctx.font = 'bold 16px Inter, sans-serif';
            const textWidth = this.ctx.measureText(labelText).width;

            this.ctx.fillStyle = 'rgba(99, 102, 241, 0.9)';
            this.ctx.fillRect(bbox.x, bbox.y - 30, textWidth + 16, 26);

            // Draw label text
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(labelText, bbox.x + 8, bbox.y - 10);
        });
    }

    /**
     * Set target to search for
     */
    setTarget(target) {
        this.currentTarget = target;
        this.detections = [];
        console.log(`🎯 Target set: ${target}`);

        // Reset sequence state when a new target is set
        if (target === 'navigation_default') {
            this.currentSequenceIndex = 0;
            this.detectionCount = 0;
            console.log(`🧭 Starting generic indoor navigation sequence: ${this.navSequence[0]}`);
        }
    }

    /**
     * Clear current target
     */
    clearTarget() {
        this.currentTarget = null;
        this.detections = [];
    }

    /**
     * Set simulated obstacle state (from Debug Panel)
     */
    setSimulatedObstacle(active) {
        this.simulatedObstacle = active;
        if (active) {
            this.triggerObstacleWarning();
        }
    }

    /**
     * Trigger an immediate obstacle warning
     */
    triggerObstacleWarning() {
        // Create a fake "Wall" detection
        const wallDetection = {
            label: 'Obstacle',
            confidence: 0.99,
            distance: 1.0, // 1 meter away
            direction: 'ahead',
            emoji: '🧱',
            isObstacle: true,
            bbox: { x: this.canvasElement.width * 0.1, y: this.canvasElement.height * 0.1, width: this.canvasElement.width * 0.8, height: this.canvasElement.height * 0.8 }
        };

        if (this.onDetectionCallback) {
            this.onDetectionCallback(wallDetection);
        }
    }

    /**
     * Set detection callback
     */
    onDetection(callback) {
        this.onDetectionCallback = callback;
    }

    /**
     * Get current detections
     */
    getDetections() {
        return this.detections;
    }

    /**
     * Generate guidance text based on detection with degree-based turning
     */
    generateGuidance(detection) {
        if (!detection) {
            return {
                icon: '🔍',
                text: `Scanning for ${this.currentTarget || 'targets'}...`,
                instruction: this.getScanInstruction('unknown')
            };
        }

        // Get direction info with degrees
        const dirInfo = detection.directionInfo || {
            direction: detection.direction,
            angleDegrees: 0,
            instruction: 'Go straight ahead'
        };

        // Build detailed guidance
        let guidance = dirInfo.instruction;
        if (detection.distance) {
            guidance += `, ${detection.distance} steps`;
        }

        // Add emoji based on direction
        let icon = detection.emoji || '🎯';
        if (dirInfo.direction.includes('left')) {
            icon = '↩️';
        } else if (dirInfo.direction.includes('right')) {
            icon = '↪️';
        } else if (dirInfo.direction === 'ahead') {
            icon = '⬆️';
        }

        return {
            icon,
            text: `${detection.label} detected: ${guidance}`,
            degrees: dirInfo.angleDegrees,
            direction: dirInfo.direction
        };
    }
}

// Export global instance
window.IndoorVision = IndoorVision;
