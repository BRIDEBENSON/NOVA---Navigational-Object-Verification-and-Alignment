
/**
 * Calculate the offset from current position to target position in degrees.
 * Returns the offset in RA and Dec, accounting for spherical distortion.
 */
function calculateOffset(
    current_ra_h, current_ra_m, current_ra_s, 
    current_dec_d, current_dec_m, current_dec_s,
    target_ra_h, target_ra_m, target_ra_s, 
    target_dec_d, target_dec_m, target_dec_s
) {
    // Convert everything to decimal degrees
    const current_ra = (current_ra_h + current_ra_m/60 + current_ra_s/3600) * 15;
    const current_dec = current_dec_d + current_dec_m/60 + current_dec_s/3600;
    const target_ra = (target_ra_h + target_ra_m/60 + target_ra_s/3600) * 15;
    const target_dec = target_dec_d + target_dec_m/60 + target_dec_s/3600;

    // Calculate RA difference, handling wraparound at 360 degrees
    let ra_diff = target_ra - current_ra;
    if (ra_diff > 180) {
        ra_diff -= 360;
    } else if (ra_diff < -180) {
        ra_diff += 360;
    }

    // Scale RA difference by cos(dec) to account for spherical distortion
    // Use the average declination for the scaling
    const avg_dec = ((current_dec + target_dec) / 2) * Math.PI / 180; // Convert to radians
    const ra_offset = ra_diff * Math.cos(avg_dec);

    // Calculate Dec difference
    const dec_offset = target_dec - current_dec;

    // Calculate true angular separation
    const current_dec_rad = current_dec * Math.PI / 180;
    const target_dec_rad = target_dec * Math.PI / 180;
    const ra_diff_rad = ra_diff * Math.PI / 180;
    
    const angular_sep = Math.acos(
        Math.sin(current_dec_rad) * Math.sin(target_dec_rad) +
        Math.cos(current_dec_rad) * Math.cos(target_dec_rad) *
        Math.cos(ra_diff_rad)
    ) * 180 / Math.PI;

    return {
        ra_offset: ra_offset,  // degrees, negative means move west
        dec_offset: dec_offset,  // degrees, negative means move south
        angular_separation: angular_sep,  // degrees
        ra_offset_time: ra_diff/15,  // hours
        dec_offset_arcmin: dec_offset * 60  // arcminutes
    };
}

// Get references to form inputs
function getInputValues() {
    return {
        current_ra_h: parseFloat(document.getElementById('current-ra-h').value),
        current_ra_m: parseFloat(document.getElementById('current-ra-m').value),
        current_ra_s: parseFloat(document.getElementById('current-ra-s').value),
        current_dec_d: parseFloat(document.getElementById('current-dec-d').value),
        current_dec_m: parseFloat(document.getElementById('current-dec-m').value),
        current_dec_s: parseFloat(document.getElementById('current-dec-s').value),
        target_ra_h: parseFloat(document.getElementById('target-ra-h').value),
        target_ra_m: parseFloat(document.getElementById('target-ra-m').value),
        target_ra_s: parseFloat(document.getElementById('target-ra-s').value),
        target_dec_d: parseFloat(document.getElementById('target-dec-d').value),
        target_dec_m: parseFloat(document.getElementById('target-dec-m').value),
        target_dec_s: parseFloat(document.getElementById('target-dec-s').value)
    };
}

// Display results
function displayResults(results) {
    document.getElementById('ra-offset').textContent = `${results.ra_offset.toFixed(4)}°`;
    document.getElementById('ra-offset-time').textContent = 
        `(${(results.ra_offset_time*60).toFixed(1)} minutes of time)`;
    
    document.getElementById('dec-offset').textContent = `${results.dec_offset.toFixed(4)}°`;
    document.getElementById('dec-offset-arcmin').textContent = 
        `(${results.dec_offset_arcmin.toFixed(1)} arcminutes)`;
    
    document.getElementById('angular-separation').textContent = 
        `${results.angular_separation.toFixed(4)}°`;
    
    document.getElementById('results').style.display = 'block';
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('calculate-btn').addEventListener('click', function() {
        const values = getInputValues();
        const results = calculateOffset(
            values.current_ra_h, values.current_ra_m, values.current_ra_s,
            values.current_dec_d, values.current_dec_m, values.current_dec_s,
            values.target_ra_h, values.target_ra_m, values.target_ra_s,
            values.target_dec_d, values.target_dec_m, values.target_dec_s
        );
        displayResults(results);
    });

    // Load example values
    document.getElementById('load-example').addEventListener('click', function() {
        document.getElementById('current-ra-h').value = 5;
        document.getElementById('current-ra-m').value = 26;
        document.getElementById('current-ra-s').value = 32.8;
        document.getElementById('current-dec-d').value = 7;
        document.getElementById('current-dec-m').value = 24;
        document.getElementById('current-dec-s').value = 43.5;
        document.getElementById('target-ra-h').value = 6;
        document.getElementById('target-ra-m').value = 46;
        document.getElementById('target-ra-s').value = 16.5;
        document.getElementById('target-dec-d').value = -16;
        document.getElementById('target-dec-m').value = 45;
        document.getElementById('target-dec-s').value = 2.6;
    });
});
