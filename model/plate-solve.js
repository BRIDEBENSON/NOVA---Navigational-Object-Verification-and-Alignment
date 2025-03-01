// Utility functions for coordinate conversions
function hmsToDeg(h, m, s) {
    return (h + m/60 + s/3600) * 15;
}

function dmsToDeg(d, m, s) {
    const sign = d < 0 ? -1 : 1;
    return sign * (Math.abs(d) + m/60 + s/3600);
}

function degToHms(deg) {
    deg = deg % 360;
    if (deg < 0) deg += 360; // Handle negative values
    const h = Math.floor(deg / 15);
    const remainder = (deg / 15 - h) * 60;
    const m = Math.floor(remainder);
    const s = (remainder - m) * 60;
    return [h, m, s];
}

function degToDms(deg) {
    const sign = deg < 0 ? "-" : "+";
    deg = Math.abs(deg);
    const d = Math.floor(deg);
    const remainder = (deg - d) * 60;
    const m = Math.floor(remainder);
    const s = (remainder - m) * 60;
    return [sign + d, m, s];
}

// Radians conversion functions
function degToRad(deg) {
    return deg * Math.PI / 180;
}

function radToDeg(rad) {
    return rad * 180 / Math.PI;
}

function radToHMS(rad) {
    const deg = radToDeg(rad);
    const [h, m, s] = degToHms(deg);
    return { h, m, s };
}

function radToDMS(rad) {
    const deg = radToDeg(rad);
    const [signD, m, s] = degToDms(deg);
    return { 
        sign: signD.charAt(0),
        d: parseInt(signD.substring(1)),
        m,
        s
    };
}

// Calculate standard coordinates from RA/Dec (all inputs in degrees)
function calculateStandardCoords(raDeg, decDeg, raCenterDeg, decCenterDeg) {
    const raRad = degToRad(raDeg);
    const decRad = degToRad(decDeg);
    const ra0Rad = degToRad(raCenterDeg);
    const dec0Rad = degToRad(decCenterDeg);

    const denom = Math.sin(decRad) * Math.sin(dec0Rad) + 
                 Math.cos(decRad) * Math.cos(dec0Rad) * Math.cos(raRad - ra0Rad);
    
    const xi = Math.cos(decRad) * Math.sin(raRad - ra0Rad) / denom;
    const eta = (Math.sin(decRad) * Math.cos(dec0Rad) - 
                Math.cos(decRad) * Math.sin(dec0Rad) * Math.cos(raRad - ra0Rad)) / denom;

    return [xi, eta];
}

// Solve the linear system using least squares
function solveLinearSystem(A, b) {
    const AT = A[0].map((_, colIndex) => A.map(row => row[colIndex]));
    const ATA = AT.map(row => A[0].map((_, j) => 
        row.reduce((sum, val, k) => sum + val * A[k][j], 0)));
    const ATb = AT.map(row => 
        row.reduce((sum, val, k) => sum + val * b[k], 0));
    
    const n = ATA.length;
    const x = new Array(n).fill(0);
    
    // Pivoted Gaussian elimination for stability
    for(let i = 0; i < n; i++) {
        let maxEl = Math.abs(ATA[i][i]);
        let maxRow = i;
        for(let k = i + 1; k < n; k++) {
            if(Math.abs(ATA[k][i]) > maxEl) {
                maxEl = Math.abs(ATA[k][i]);
                maxRow = k;
            }
        }

        for(let k = i; k < n; k++) {
            const tmp = ATA[maxRow][k];
            ATA[maxRow][k] = ATA[i][k];
            ATA[i][k] = tmp;
        }
        const tmp = ATb[maxRow];
        ATb[maxRow] = ATb[i];
        ATb[i] = tmp;

        for(let k = i + 1; k < n; k++) {
            const c = -ATA[k][i] / ATA[i][i];
            for(let j = i; j < n; j++) {
                if(i === j) {
                    ATA[k][j] = 0;
                } else {
                    ATA[k][j] += c * ATA[i][j];
                }
            }
            ATb[k] += c * ATb[i];
        }
    }

    // Back substitution
    for(let i = n - 1; i >= 0; i--) {
        x[i] = ATb[i];
        for(let k = i + 1; k < n; k++) {
            x[i] -= ATA[i][k] * x[k];
        }
        x[i] /= ATA[i][i];
    }

    return x;
}

// Fit a linear plate solution
function fitPlateSolution(referenceStars) {
    // Extract coordinates from reference stars
    const xCoords = referenceStars.map(star => star.x);
    const yCoords = referenceStars.map(star => star.y);
    
    // Ensure RA/Dec are in degrees
    const raCoords = referenceStars.map(star => star.ra);
    const decCoords = referenceStars.map(star => star.dec);

    // Calculate center of reference field
    const raCenter = raCoords.reduce((a, b) => a + b) / raCoords.length;
    const decCenter = decCoords.reduce((a, b) => a + b) / decCoords.length;

    // Calculate standard coordinates for each reference star
    const standardCoords = raCoords.map((ra, i) => 
        calculateStandardCoords(ra, decCoords[i], raCenter, decCenter));
    
    const xiCoords = standardCoords.map(coord => coord[0]);
    const etaCoords = standardCoords.map(coord => coord[1]);

    // Set up the linear system: [x, y, 1] -> [xi, eta]
    const A = referenceStars.map(star => [star.x, star.y, 1]);
    
    // Solve for coefficients
    const xiConstants = solveLinearSystem(A, xiCoords);
    const etaConstants = solveLinearSystem(A, etaCoords);

    return {
        xiConstants,
        etaConstants,
        raCenter,
        decCenter
    };
}

// Calculate RA/Dec from x,y using plate constants
function calculatePosition(x, y, plateConstants) {
    // Calculate standard coordinates
    const coords = [x, y, 1];
    const xi = plateConstants.xiConstants.reduce((sum, val, i) => sum + val * coords[i], 0);
    const eta = plateConstants.etaConstants.reduce((sum, val, i) => sum + val * coords[i], 0);

    // Get plate center coordinates
    const ra0 = plateConstants.raCenter;
    const dec0 = plateConstants.decCenter;
    
    // Convert to radians
    const ra0Rad = degToRad(ra0);
    const dec0Rad = degToRad(dec0);

    // Calculate distance from tangential point
    const r = Math.sqrt(xi**2 + eta**2);

    // Handle special case for center point
    if (r < 1e-10) {
        return { 
            ra: ra0, 
            dec: dec0 
        };
    }

    const theta = Math.atan(r);

    // Calculate declination
    const decRad = Math.asin(Math.cos(theta) * Math.sin(dec0Rad) +
                          (eta * Math.sin(theta) * Math.cos(dec0Rad)) / r);

    // Calculate right ascension
    const raAdjustment = Math.atan2(xi * Math.sin(theta),
                          r * Math.cos(theta) * Math.cos(dec0Rad) -
                          eta * Math.sin(theta) * Math.sin(dec0Rad));
    const raRad = raAdjustment + ra0Rad;

    // Convert back to degrees
    const raDeg = radToDeg(raRad);
    const decDeg = radToDeg(decRad);

    return { 
        ra: raDeg, 
        dec: decDeg 
    };
}

// Main function to solve the plate
function solvePlate(referenceStars, targetX, targetY) {
    if (!referenceStars || !Array.isArray(referenceStars) || referenceStars.length < 3) {
        throw new Error('Need at least 3 reference stars');
    }
    
    try {
        // Ensure all reference stars have x, y, ra, and dec in degrees
        const processedStars = referenceStars.map(star => ({
            x: star.x,
            y: star.y,
            ra: star.ra,
            dec: star.dec
        }));
        
        // Calculate plate solution
        const plateConstants = fitPlateSolution(processedStars);
        
        // Calculate target position
        const { ra, dec } = calculatePosition(targetX, targetY, plateConstants);
        
        // Convert to HMS/DMS format
        const [raH, raM, raS] = degToHms(ra);
        const [decSign, decM, decS] = degToDms(dec);
        const decD = parseInt(decSign.substring(1));
        const decSignChar = decSign.charAt(0);
        
        return {
            ra: { h: raH, m: raM, s: raS },
            dec: { sign: decSignChar, d: decD, m: decM, s: decS },
            raDeg: ra,
            decDeg: dec
        };
    } catch (error) {
        throw new Error(`Plate solving error: ${error.message}`);
    }
}

// Format RA/Dec to string
function formatRADec(result) {
    if (!result || !result.ra || !result.dec) return "Invalid result";
    
    const ra = result.ra;
    const dec = result.dec;
    
    return `RA: ${ra.h}h ${ra.m}m ${ra.s.toFixed(3)}s, Dec: ${dec.sign}${dec.d}° ${dec.m}' ${dec.s.toFixed(3)}"`;
}

export { 
    solvePlate, 
    hmsToDeg, 
    dmsToDeg, 
    degToHms,
    degToDms,
    radToHMS, 
    radToDMS, 
    formatRADec 
};