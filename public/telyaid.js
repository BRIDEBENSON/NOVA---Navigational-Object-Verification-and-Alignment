
function getUserLocation() {
    const locationSelect = document.getElementById('location');
    const latInput = document.getElementById('latitude');
    const longInput = document.getElementById('longitude');

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                latInput.value = position.coords.latitude.toFixed(6);
                longInput.value = position.coords.longitude.toFixed(6);
                if (locationSelect.querySelector('option[value="custom"]')) {
                    locationSelect.value = "custom";
                }
            },
            (error) => {
                console.error('Error fetching location:', error.message);
                handleLocationError(error);
            }
        );
    } else {
        alert("Geolocation is not supported by your browser. Please enter your location manually.");
    }
}
function handleLocationError(error) {
    let errorMessage = "An error occurred while getting your location. "; // Start with a general message

    switch (error.code) {
        case error.PERMISSION_DENIED:
            errorMessage += "You denied the request for Geolocation.";
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage += "Location information is unavailable.";
            break;
        case error.TIMEOUT:
            errorMessage += "The request to get user location timed out.";
            break;
        case error.UNKNOWN_ERROR:
            errorMessage += "An unknown error occurred.";
            break;
    }

    errorMessage += " Please enter your location manually."; // Add the manual entry prompt

    alert(errorMessage); // Display the single, complete message
}
// Event listener for location select changes (for predefined locations)
document.getElementById('location').addEventListener('change', function () {
    const selectedOption = this.selectedOptions[0];
    if (selectedOption && selectedOption.value !== "custom") {
        document.getElementById('latitude').value = selectedOption.getAttribute('data-lat') || "";
        document.getElementById('longitude').value = selectedOption.getAttribute('data-long') || "";
    } else if (selectedOption && selectedOption.value === "custom") {
        document.getElementById('latitude').value = "";
        document.getElementById('longitude').value = "";
    }
});

// Call getUserLocation on page load
window.addEventListener('load', getUserLocation);

document.getElementById("checkButton").addEventListener("click", checkVisibility);

function updateRAandDec() {
    const selectedOption = document.getElementById('celestialObject').selectedOptions[0];
    document.getElementById('ra').value = selectedOption.getAttribute('data-ra');
    document.getElementById('dec').value = selectedOption.getAttribute('data-dec');
}

function updateLatAndLong() {
    const selectedOption = document.getElementById('location').selectedOptions[0];
    document.getElementById('latitude').value = selectedOption.getAttribute('data-lat');
    document.getElementById('longitude').value = selectedOption.getAttribute('data-long');
}

function parseTimeString(timeString) {
    const [h, m, s] = timeString.split(':').map(parseFloat);
    return { h: h || 0, m: m || 0, s: s || 0 };
}

function parseDegreeString(degreeString) {
    const [d, m, s] = degreeString.split(':').map(parseFloat);
    return { d: d || 0, m: m || 0, s: s || 0 };
}

function hmsToHours(h, m, s) {
    return h + m / 60 + s / 3600;
}

function dmsToDegrees(d, m, s) {
    return d + m / 60 + s / 3600;
}

function calculateJD(date) {
    return (date.getTime() / 86400000) + 2440587.5;
}

function calculateGST(jd) {
    const jd2000 = 2451545.0;
    const t = (jd - jd2000) / 36525;
    let gst = 280.46061837 + 360.98564736629 * (jd - jd2000) + 0.000387933 * t * t - t * t * t / 38710000;
    return (gst % 360 + 360) % 360;
}

function calculateLST(longitude, dateTime) {
    const jd = calculateJD(dateTime);
    const gst = calculateGST(jd);
    const lst = (gst + longitude) % 360;
    return lst;
}

function calculateVisibilityTimes(raDeg, decDeg, latitude, longitude, dateTime) {
    const latRad = latitude * Math.PI / 180;
    const decRad = decDeg * Math.PI / 180;
    const cosHA = (Math.sin(-0.5667 * Math.PI / 180) - Math.sin(latRad) * Math.sin(decRad)) / (Math.cos(latRad) * Math.cos(decRad));

    if (cosHA > 1) return { riseTime: null, setTime: null, alwaysVisible: false, neverVisible: true };
    if (cosHA < -1) return { riseTime: null, setTime: null, alwaysVisible: true, neverVisible: false };

    const haRiseSet = Math.acos(cosHA) * 180 / Math.PI;
    const haRiseSetHours = haRiseSet / 15;
    const lstNow = calculateLST(longitude, dateTime) / 15;
    const raHours = raDeg / 15;

    const riseLST = (raHours - haRiseSetHours + 24) % 24;
    const setLST = (raHours + haRiseSetHours) % 24;

    const riseTime = new Date(dateTime);
    const setTime = new Date(dateTime);

    const siderealToSolarFactor = 0.99726957;
    const riseOffset = ((riseLST - lstNow + 24) % 24) * siderealToSolarFactor;
    const setOffset = ((setLST - lstNow + 24) % 24) * siderealToSolarFactor;

    riseTime.setUTCHours(riseTime.getUTCHours() + Math.floor(riseOffset));
    riseTime.setUTCMinutes(riseTime.getUTCMinutes() + Math.round((riseOffset % 1) * 60));

    setTime.setUTCHours(setTime.getUTCHours() + Math.floor(setOffset));
    setTime.setUTCMinutes(setTime.getUTCMinutes() + Math.round((setOffset % 1) * 60));

    if (riseTime < dateTime) riseTime.setDate(riseTime.getDate() + 1);
    if (setTime < dateTime) setTime.setDate(setTime.getDate() + 1);

    return { riseTime, setTime, alwaysVisible: false, neverVisible: false };
}

function altitude(decDeg, latDeg, hAngleDeg) {
    const decRad = decDeg * Math.PI / 180;
    const latRad = latDeg * Math.PI / 180;
    const hRad = hAngleDeg * Math.PI / 180;
    const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(hRad);
    return Math.asin(sinAlt) * 180 / Math.PI;
}
function azimuth(decDeg, latDeg, hAngleDeg) {
    const decRad = decDeg * Math.PI / 180;
    const latRad = latDeg * Math.PI / 180;
    const hRad = hAngleDeg * Math.PI / 180;

    const sinDec = Math.sin(decRad);
    const cosDec = Math.cos(decRad);
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const sinH = Math.sin(hRad);
    const cosH = Math.cos(hRad);

    const sinAltitude = sinLat * sinDec + cosLat * cosDec * cosH;
    const altitude = Math.asin(sinAltitude);

    // More robust azimuth calculation
    let azimuth;
    if (Math.abs(Math.cos(altitude)) < 1e-10) { // Check for near-zero cos(altitude)
        // Special case: Altitude near 90 or -90 degrees
        if (altitude > 0) {
            azimuth = 0; // Zenith
        } else {
            azimuth = 180; // Nadir
        }
    } else {
        const sinAz = -sinH * cosDec / Math.cos(altitude);
        const cosAz = (cosLat * sinDec - sinLat * cosDec * cosH) / Math.cos(altitude);
        azimuth = Math.atan2(sinAz, cosAz) * 180 / Math.PI;
    }

    if (azimuth < 0) {
        azimuth += 360;
    }
    return azimuth;
}
function checkVisibility() {
    const ra = document.getElementById('ra').value;
    const dec = document.getElementById('dec').value;
    const latitude = parseFloat(document.getElementById('latitude').value);
    const longitude = parseFloat(document.getElementById('longitude').value);
    const dateTime = new Date();
    const cameraButton = document.getElementById('camera-feed-btn');
    const visibilityLabel = document.getElementById('visibility-status-label');

    if (!ra || !dec || isNaN(latitude) || isNaN(longitude)) {
        alert("Please enter all fields correctly.");
        cameraButton.style.display = "none";
        visibilityLabel.textContent = "";
        return;
    }

    const { h: raH, m: raM, s: raS } = parseTimeString(ra);
    const { d: decD, m: decM, s: decS } = parseDegreeString(dec);
    const raDeg = hmsToHours(raH, raM, raS) * 15;
    const decDeg = dmsToDegrees(decD, decM, decS);

    const lst = calculateLST(longitude, dateTime);
    const hAngle = ((lst - raDeg + 360) % 360);
    const altNow = altitude(decDeg, latitude, hAngle);
    const azNow = azimuth(decDeg, latitude, hAngle);

    const visibility = calculateVisibilityTimes(raDeg, decDeg, latitude, longitude, dateTime);

    if (altNow > 0) {
        visibilityLabel.textContent = "Visibility Status: Visible";
        cameraButton.style.display = "block";
    } else {
        visibilityLabel.textContent = "Visibility Status: Not Visible";
        cameraButton.style.display = "none";
    }
}

document.getElementById("checkButton").addEventListener("click", function () {
    // Get RA and Dec values
    let ra = document.getElementById("ra").value.trim();
    let dec = document.getElementById("dec").value.trim();

    // Check if both fields are filled
    if (ra && dec) {
        // Construct the URL with query parameters
        let cameraFeedUrl = `http://127.0.0.1:8000?ra=${encodeURIComponent(ra)}&dec=${encodeURIComponent(dec)}`;

        // Update Camera Feed button href
        let cameraFeedBtn = document.getElementById("camera-feed-btn");
        cameraFeedBtn.href = cameraFeedUrl;
        cameraFeedBtn.style.display = "inline"; // Make it visible
    } else {
        alert("Please enter both Right Ascension (RA) and Declination (Dec).");
    }
});
