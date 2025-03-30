import { solvePlate, hmsToDeg, dmsToDeg } from './plate-solve.js';

let referenceStars = null;
let lastPredictions = null;

function log(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
}

async function loadReferenceStars() {
    try {
        log('Fetching reference stars data...');
        const response = await fetch('/reference-stars');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (!data.reference_stars || !Array.isArray(data.reference_stars)) {
            throw new Error('Invalid reference stars data format');
        }

        log(`Loaded ${data.reference_stars.length} reference stars`, 'success');

        // Convert HMS/DMS to decimal degrees
        return data.reference_stars.map(star => ({
            id: star.id,
            ra: hmsToDeg(star.ra_hours, star.ra_minutes, star.ra_seconds),
            dec: dmsToDeg(star.dec_degrees, star.dec_minutes, star.dec_seconds)
        }));
    } catch (error) {
        log(`Failed to load reference stars: ${error.message}`, 'error');
        throw error;
    }
}

function matchPredictionsWithReferences(predictions, referenceStars) {
    log('Starting matchPredictionsWithReferences function');
    
    // Validate predictions
    if (!predictions || !Array.isArray(predictions) || predictions.length === 0) {
        log('Invalid predictions data: empty or not an array', 'error');
        return [];
    }
    
    log(`Predictions length: ${predictions.length}`);
    
    // Get the first prediction
    const prediction = predictions[0];
    if (!prediction || typeof prediction !== 'object') {
        log('First prediction is invalid', 'error');
        return [];
    }
    
    // Validate keypoints exist and are an array
    if (!prediction.keypoints || !Array.isArray(prediction.keypoints)) {
        log('Keypoints are missing or not an array', 'error');
        return [];
    }
    
    log(`Keypoints length: ${prediction.keypoints.length}`);
    
    // Validate reference stars
    if (!Array.isArray(referenceStars) || referenceStars.length < 6) {
        log('Invalid or insufficient reference stars', 'error');
        return [];
    }
    log(`Reference stars length: ${referenceStars.length}`);

    // Specific indices we want to use (1,2,3,4,7,8)
    const desiredIndices = [0, 1, 2, 3, 6, 7];
    log(`Desired indices: ${desiredIndices.join(', ')}`);
    
    // Validate we have enough keypoints
    const maxIndex = Math.max(...desiredIndices);
    if (prediction.keypoints.length <= maxIndex) {
        log(`Not enough keypoints. Need at least ${maxIndex + 1}, but got ${prediction.keypoints.length}`, 'error');
        return [];
    }

    const matchedStars = [];
    
    // Match stars with keypoints
    for (let i = 0; i < Math.min(desiredIndices.length, referenceStars.length); i++) {
        const keypointIndex = desiredIndices[i];
        log(`Processing index ${i}, keypoint index ${keypointIndex}`);
        
        // Get keypoint and validate its structure
        const keypoint = prediction.keypoints[keypointIndex];
        if (!keypoint || !Array.isArray(keypoint) || keypoint.length < 2) {
            log(`Invalid keypoint at index ${keypointIndex}`, 'error');
            continue;
        }
        
        // Access keypoint coordinates safely
        const x = typeof keypoint[0] === 'number' ? keypoint[0] : 0;
        const y = typeof keypoint[1] === 'number' ? keypoint[1] : 0;
        
        // Access reference star safely
        const refStar = referenceStars[i];
        if (!refStar || typeof refStar.ra !== 'number' || typeof refStar.dec !== 'number') {
            log(`Invalid reference star at index ${i}`, 'error');
            continue;
        }
        
        log(`Matching keypoint (${x}, ${y}) with star RA:${refStar.ra.toFixed(6)}, Dec:${refStar.dec.toFixed(6)}`);
        
        // Add to matched stars - ensure RA/Dec are in degrees
        matchedStars.push({
            x: x,
            y: y,
            ra: refStar.ra,
            dec: refStar.dec
        });
    }

    log(`Final matched stars count: ${matchedStars.length}`);
    if (matchedStars.length < 6) {
        log(`Failed to match all stars. Only matched ${matchedStars.length}/6`, 'error');
        return [];
    }

    log(`Matched ${matchedStars.length} stars with reference data`, 'success');
    return matchedStars;
}

async function updatePredictions() {
    try {
        if (!referenceStars) {
            log('No reference stars loaded, initializing...');
            await initializeReferenceStars();
        }

        log('Fetching predictions...');
        const response = await fetch('/get-predictions');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Check if predictions have changed
        if (JSON.stringify(data) === JSON.stringify(lastPredictions)) {
            log('No new predictions available', 'info');
            return;
        }
        lastPredictions = data;

        if (!data.predictions || !data.image_center) {
            log('No predictions or image center data available yet', 'warning');
            return;
        }

        const matchedStars = matchPredictionsWithReferences(data.predictions, referenceStars);
        
        if (matchedStars.length < 6) {
            log(`Not enough matched stars (${matchedStars.length}) for plate solving`, 'warning');
            return;
        }

        const { x: centerX, y: centerY } = data.image_center;
        log(`Using image center: (${centerX}, ${centerY})`);

        try {
            const solution = solvePlate(matchedStars, centerX, centerY);
            log('Plate solving completed successfully', 'success');

            document.getElementById('plate_solve_results').innerHTML = `
                <h3>Image Center Position:</h3>
                <p>RA: ${solution.ra.h}h ${solution.ra.m}m ${solution.ra.s.toFixed(3)}s</p>
                <p>Dec: ${solution.dec.sign}${solution.dec.d}° ${solution.dec.m}' ${solution.dec.s.toFixed(3)}"</p>
                <p>RA (decimal): ${solution.raDeg.toFixed(6)}°</p>
                <p>Dec (decimal): ${solution.decDeg.toFixed(6)}°</p>
                <h4>Using ${matchedStars.length} reference stars</h4>
                <p>Debug: Center at (${centerX}, ${centerY})</p>
            `;

            // Log matched stars data
            matchedStars.forEach((star, index) => {
                log(`Star ${index + 1}: x=${star.x.toFixed(2)}, y=${star.y.toFixed(2)}, RA=${star.ra.toFixed(6)}, Dec=${star.dec.toFixed(6)}`, 'info');
            });
        } catch (error) {
            log(`Plate solving error: ${error.message}`, 'error');
            document.getElementById('plate_solve_results').innerHTML = `
                <p class="error">Error during plate solving: ${error.message}</p>
                <p>Please check the debug log for more information.</p>
            `;
        }
    } catch (error) {
        log(`Update predictions error: ${error.message}`, 'error');
    }
}

async function initializeReferenceStars() {
    try {
        referenceStars = await loadReferenceStars();
        if (!referenceStars || referenceStars.length === 0) {
            throw new Error('Failed to load reference stars');
        }
        log(`Initialized ${referenceStars.length} reference stars`, 'success');
    } catch (error) {
        log(`Failed to initialize reference stars: ${error.message}`, 'error');
        throw error;
    }
}

// Start the system
log('Starting plate solving system...');
await initializeReferenceStars();
setInterval(updatePredictions, 5000);