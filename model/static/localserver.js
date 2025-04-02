const video = document.getElementById('video');
const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d');
let liveDetectionInterval = null, currentImage = null, stream = null;

document.getElementById('startWebcam').addEventListener('click', async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        video.srcObject = stream;
        await video.play();
    } catch (err) {
        console.error("Error accessing webcam:", err);
        alert("Failed to access webcam. Please ensure you have granted camera permissions.");
    }
});

document.getElementById('stopWebcam').addEventListener('click', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        stream = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (liveDetectionInterval) {
            clearInterval(liveDetectionInterval);
            liveDetectionInterval = null;
        }
    }
});

document.getElementById('captureFrame').addEventListener('click', () => {
    if (!stream) {
        alert("Please start the webcam first.");
        return;
    }
    try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
        canvas.toBlob(sendImageForPrediction, 'image/jpeg');
    } catch (err) {
        console.error("Error capturing frame:", err);
        alert("Failed to capture frame.");
    }
});

document.getElementById('startLive').addEventListener('click', () => {
    if (!stream) {
        alert("Please start the webcam first.");
        return;
    }
    if (!liveDetectionInterval) {
        liveDetectionInterval = setInterval(() => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
            canvas.toBlob(sendImageForPrediction, 'image/jpeg');
        }, 1000);
    }
});

document.getElementById('stopLive').addEventListener('click', () => {
    if (liveDetectionInterval) {
        clearInterval(liveDetectionInterval);
        liveDetectionInterval = null;
    }
});

const drawDetections = (data) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (currentImage) ctx.putImageData(currentImage, 0, 0);
    data.predictions.forEach(pred => {
        const [x1, y1, x2, y2] = pred.bbox;
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'blue';
        ctx.font = '14px Arial';
        const text = `Confidence: ${(pred.confidence * 100).toFixed(1)}%`;
        ctx.strokeText(text, x1, y1 - 5);
        ctx.fillText(text, x1, y1 - 5);
        pred.keypoints.forEach((point, index) => {
            const [x, y, conf] = point;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = `rgba(255, 0, 0, ${Math.max(0.3, conf)})`;
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.font = '12px Arial';
            ctx.strokeText(index + 1, x + 6, y - 6);
            ctx.fillText(index + 1, x + 6, y - 6);
        });
    });
};

const formatPredictions = (data) => {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '';
    if (data.image_center) {
        resultDiv.innerHTML += `<h4>Image Center</h4><p>X: ${data.image_center.x}</p><p>Y: ${data.image_center.y}</p>`;
    }
    data.predictions.forEach((pred, index) => {
        resultDiv.innerHTML += `<h4>Detection ${index + 1}</h4><p><strong>Confidence:</strong> ${(pred.confidence * 100).toFixed(1)}%</p>
        <p><strong>Bounding Box:</strong> Top-left: (${pred.bbox[0].toFixed(1)}, ${pred.bbox[1].toFixed(1)}), Bottom-right: (${pred.bbox[2].toFixed(1)}, ${pred.bbox[3].toFixed(1)})</p>
        <p><strong>Keypoints:</strong></p>${pred.keypoints.map((point, i) => `<p>Point ${i + 1}: (${point[0].toFixed(1)}, ${point[1].toFixed(1)}) - Confidence: ${(point[2] * 100).toFixed(1)}%</p>`).join('')}`;
    });
};

const sendImageForPrediction = async (imageBlob) => {
    try {
        const formData = new FormData();
        formData.append('file', imageBlob);
        const response = await fetch('http://localhost:8000/predict', { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const results = await response.json();
        formatPredictions(results);
        drawDetections(results);
    } catch (error) {
        console.error("Error in sendImageForPrediction:", error);
        document.getElementById('result').textContent = 'Error: ' + error.message;
    }
};

document.getElementById('imageInput').addEventListener('change', async (e) => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        stream = null;
        if (liveDetectionInterval) {
            clearInterval(liveDetectionInterval);
            liveDetectionInterval = null;
        }
    }
    if (e.target.files.length > 0) {
        const file = e.target.files[0];
        const img = new Image();
        img.onload = function () {
            URL.revokeObjectURL(this.src);
            canvas.width = Math.min(this.width, 1920);
            canvas.height = Math.min(this.height, 1080);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(this, 0, 0, canvas.width, canvas.height);
            currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => blob && sendImageForPrediction(blob), 'image/jpeg', 0.95);
        };
        img.onerror = (error) => {
            console.error("Error loading image:", error);
            alert("Failed to load the selected image.");
        };
        try {
            img.src = URL.createObjectURL(file);
        } catch (error) {
            console.error("Error creating object URL:", error);
            alert("Failed to process the selected image.");
        }
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const ra = decodeURIComponent(urlParams.get('ra'));  // "06:45:09"
    const dec = decodeURIComponent(urlParams.get('dec')); // "-16:42:58"

    console.log("Raw RA:", ra);
    console.log("Raw Dec:", dec);

    let target_ra_h, target_ra_m, target_ra_s;
    let target_dec_d, target_dec_m, target_dec_s;

    if (ra) {
        let ra_parts = ra.split(':'); // Split by ":"
        if (ra_parts.length === 3) {
            target_ra_h = parseInt(ra_parts[0], 10);
            target_ra_m = parseInt(ra_parts[1], 10);
            target_ra_s = parseFloat(ra_parts[2]);
        }
    }

    if (dec) {
        let dec_parts = dec.split(':'); // Split by ":"
        if (dec_parts.length === 3) {
            target_dec_d = parseInt(dec_parts[0], 10);
            target_dec_m = parseInt(dec_parts[1], 10);
            target_dec_s = parseFloat(dec_parts[2]);
        }
    }

    console.log("Extracted RA:", target_ra_h, target_ra_m, target_ra_s);
    console.log("Extracted Dec:", target_dec_d, target_dec_m, target_dec_s);
});

// Add this to your localserver.js file

// 1. Function to extract the current RA/Dec from the plate solve results
function extractCurrentCoordinates() {
    const resultsElement = document.getElementById('plate_solve_results');
    if (!resultsElement) return null;
    
    const content = resultsElement.innerHTML;
    
    // Extract RA values using regex
    const raMatch = content.match(/RA: (\d+)h (\d+)m ([\d.]+)s/);
    if (!raMatch) return null;
    
    // Extract Dec values using regex
    const decMatch = content.match(/Dec: ([+-])(\d+)° (\d+)' ([\d.]+)"/);
    if (!decMatch) return null;
    
    return {
      ra_h: parseInt(raMatch[1], 10),
      ra_m: parseInt(raMatch[2], 10),
      ra_s: parseFloat(raMatch[3]),
      dec_sign: decMatch[1],
      dec_d: parseInt(decMatch[2], 10) * (decMatch[1] === '-' ? -1 : 1),
      dec_m: parseInt(decMatch[3], 10),
      dec_s: parseFloat(decMatch[4])
    };
  }
  
  // 2. Function to parse URL parameters for target coordinates
  function getTargetCoordinatesFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetRA = decodeURIComponent(urlParams.get('ra')); // "06:45:09"
    const targetDec = decodeURIComponent(urlParams.get('dec')); // "-16:42:58"
    
    if (!targetRA || !targetDec) return null;
    
    // Parse RA
    const ra_parts = targetRA.split(':');
    if (ra_parts.length !== 3) return null;
    
    // Parse Dec
    const dec_parts = targetDec.split(':');
    if (dec_parts.length !== 3) return null;
    
    // Get sign from Dec
    const dec_sign = dec_parts[0].startsWith('-') ? '-' : '+';
    const dec_d_abs = parseInt(dec_parts[0].replace('-', ''), 10);
    
    return {
      ra_h: parseInt(ra_parts[0], 10),
      ra_m: parseInt(ra_parts[1], 10),
      ra_s: parseFloat(ra_parts[2]),
      dec_sign: dec_sign,
      dec_d: dec_sign === '-' ? -dec_d_abs : dec_d_abs,
      dec_m: parseInt(dec_parts[1], 10),
      dec_s: parseFloat(dec_parts[2])
    };
  }
  
  // 3. Function to calculate and display offsets
  function updateOffsetCalculation() {
    const current = extractCurrentCoordinates();
    const target = getTargetCoordinatesFromURL();
    
    if (!current || !target) {
      console.log("Missing current or target coordinates");
      return;
    }
    
    console.log("Current coordinates:", current);
    console.log("Target coordinates:", target);
    
    // Calculate the offset using the imported function
    const offset = calculateOffset(
      current.ra_h, current.ra_m, current.ra_s,
      current.dec_d, current.dec_m, current.dec_s,
      target.ra_h, target.ra_m, target.ra_s,
      target.dec_d, target.dec_m, target.dec_s
    );
    
    // Display the results
    const resultsDiv = document.getElementById('offset-results') || document.createElement('div');
    resultsDiv.id = 'offset-results';
    
    resultsDiv.innerHTML = `
      <h3>Telescope Pointing Offset</h3>
      <p>RA Offset: ${offset.ra_offset.toFixed(4)}° (${(offset.ra_offset_time*60).toFixed(1)} minutes of time)</p>
      <p>Dec Offset: ${offset.dec_offset.toFixed(4)}° (${offset.dec_offset_arcmin.toFixed(1)} arcminutes)</p>
      <p>Angular Separation: ${offset.angular_separation.toFixed(4)}°</p>
    `;
    
    // Append to document if it doesn't exist yet
    if (!document.getElementById('offset-results')) {
      document.body.appendChild(resultsDiv);
    }
  }
  
  // 4. Set up observers to detect when plate solve results are updated
  function setupOffsetCalculation() {
    // Import the offset calculation function
    const scriptElement = document.createElement('script');
    scriptElement.src = 'offset_calc.js';
    document.head.appendChild(scriptElement);
    
    // Set up a MutationObserver to watch for changes to the plate_solve_results element
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          updateOffsetCalculation();
        }
      });
    });
    
    // Start observing the plate_solve_results element
    const targetNode = document.getElementById('plate_solve_results');
    if (targetNode) {
      observer.observe(targetNode, { childList: true, subtree: true });
      console.log("Observer set up for plate_solve_results");
    } else {
      console.log("plate_solve_results element not found, retrying in 1s");
      setTimeout(setupOffsetCalculation, 1000);
    }
    
    // Also try to calculate immediately in case results are already available
    updateOffsetCalculation();
  }
  
  // Initialize when the document is loaded
  document.addEventListener('DOMContentLoaded', function() {
    console.log("Document loaded, setting up offset calculation");
    setupOffsetCalculation();
  });


  // Add this to your localserver.js file to integrate the offset calculation properly

// Include the calculateOffset function directly to avoid loading issues
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

// 1. Function to extract the current RA/Dec from the plate solve results
function extractCurrentCoordinates() {
    const resultsElement = document.getElementById('plate_solve_results');
    if (!resultsElement) {
        console.log("plate_solve_results element not found");
        return null;
    }
    
    const content = resultsElement.innerHTML;
    console.log("Plate solve results content:", content);
    
    // Extract RA values using regex
    const raMatch = content.match(/RA: (\d+)h (\d+)m ([\d.]+)s/);
    if (!raMatch) {
        console.log("Failed to match RA pattern");
        return null;
    }
    
    // Extract Dec values using regex
    const decMatch = content.match(/Dec: ([+-])(\d+)° (\d+)' ([\d.]+)"/);
    if (!decMatch) {
        console.log("Failed to match Dec pattern");
        return null;
    }
    
    const result = {
        ra_h: parseInt(raMatch[1], 10),
        ra_m: parseInt(raMatch[2], 10),
        ra_s: parseFloat(raMatch[3]),
        dec_sign: decMatch[1],
        dec_d: parseInt(decMatch[2], 10) * (decMatch[1] === '-' ? -1 : 1),
        dec_m: parseInt(decMatch[3], 10),
        dec_s: parseFloat(decMatch[4])
    };
    
    console.log("Extracted current coordinates:", result);
    return result;
}

// 2. Function to parse URL parameters for target coordinates
function getTargetCoordinatesFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetRA = urlParams.get('ra');
    const targetDec = urlParams.get('dec');
    
    if (!targetRA || !targetDec) {
        console.log("Target coordinates not found in URL parameters");
        return null;
    }
    
    console.log("Raw target RA from URL:", targetRA);
    console.log("Raw target Dec from URL:", targetDec);
    
    // Parse RA
    const ra_parts = targetRA.split(':');
    if (ra_parts.length !== 3) {
        console.log("Invalid RA format");
        return null;
    }
    
    // Parse Dec
    const dec_parts = targetDec.split(':');
    if (dec_parts.length !== 3) {
        console.log("Invalid Dec format");
        return null;
    }
    
    // Get sign from Dec
    const dec_sign = dec_parts[0].startsWith('-') ? '-' : '+';
    const dec_d_abs = parseInt(dec_parts[0].replace('-', ''), 10);
    
    const result = {
        ra_h: parseInt(ra_parts[0], 10),
        ra_m: parseInt(ra_parts[1], 10),
        ra_s: parseFloat(ra_parts[2]),
        dec_sign: dec_sign,
        dec_d: dec_sign === '-' ? -dec_d_abs : dec_d_abs,
        dec_m: parseInt(dec_parts[1], 10),
        dec_s: parseFloat(dec_parts[2])
    };
    
    console.log("Parsed target coordinates:", result);
    return result;
}

// 3. Function to calculate and display offsets
function updateOffsetCalculation() {
    console.log("Running updateOffsetCalculation");
    
    const current = extractCurrentCoordinates();
    const target = getTargetCoordinatesFromURL();
    
    if (!current || !target) {
        console.log("Missing current or target coordinates");
        return;
    }
    
    // Calculate the offset
    const offset = calculateOffset(
        current.ra_h, current.ra_m, current.ra_s,
        current.dec_d, current.dec_m, current.dec_s,
        target.ra_h, target.ra_m, target.ra_s,
        target.dec_d, target.dec_m, target.dec_s
    );
    
    console.log("Calculated offset:", offset);
    
    // Create or get the results div
    let resultsDiv = document.getElementById('offset-results');
    if (!resultsDiv) {
        resultsDiv = document.createElement('div');
        resultsDiv.id = 'offset-results';
        resultsDiv.style.backgroundColor = '#f0f0f0';
        resultsDiv.style.padding = '10px';
        resultsDiv.style.margin = '10px 0';
        resultsDiv.style.border = '1px solid #ddd';
        resultsDiv.style.borderRadius = '5px';
        
        // Find a good place to append it
        const container = document.querySelector('.container') || document.body;
        container.appendChild(resultsDiv);
    }
    
    // Display the results
    resultsDiv.innerHTML = `
        <h3>Telescope Pointing Offset</h3>
        <p><strong>RA Offset:</strong> ${offset.ra_offset.toFixed(4)}° (${(offset.ra_offset_time*60).toFixed(1)} minutes of time)</p>
        <p><strong>Dec Offset:</strong> ${offset.dec_offset.toFixed(4)}° (${offset.dec_offset_arcmin.toFixed(1)} arcminutes)</p>
        <p><strong>Angular Separation:</strong> ${offset.angular_separation.toFixed(4)}°</p>
        <p><small>Current: RA ${current.ra_h}h ${current.ra_m}m ${current.ra_s.toFixed(1)}s, Dec ${current.dec_sign}${Math.abs(current.dec_d)}° ${current.dec_m}' ${current.dec_s.toFixed(1)}"</small></p>
        <p><small>Target: RA ${target.ra_h}h ${target.ra_m}m ${target.ra_s.toFixed(1)}s, Dec ${target.dec_sign}${Math.abs(target.dec_d)}° ${target.dec_m}' ${target.dec_s.toFixed(1)}"</small></p>
    `;
}

// 4. Set up methods to trigger the calculation
function setupOffsetCalculation() {
    console.log("Setting up offset calculation");
    
    // Create a manual calculation button if it doesn't exist
    let calcButton = document.getElementById('calculate-offset-btn');
    if (!calcButton) {
        calcButton = document.createElement('button');
        calcButton.id = 'calculate-offset-btn';
        calcButton.textContent = 'Calculate Telescope Offset';
        calcButton.style.margin = '10px 0';
        calcButton.style.padding = '8px 16px';
        calcButton.style.backgroundColor = '#4CAF50';
        calcButton.style.color = 'white';
        calcButton.style.border = 'none';
        calcButton.style.borderRadius = '4px';
        calcButton.style.cursor = 'pointer';
        
        // Find a good place to append it
        const container = document.querySelector('.container') || document.body;
        container.appendChild(calcButton);
        
        // Add click event
        calcButton.addEventListener('click', updateOffsetCalculation);
    }
    
    // Try to set up a MutationObserver to watch for changes to the plate_solve_results element
    const targetNode = document.getElementById('plate_solve_results');
    if (targetNode) {
        console.log("Found plate_solve_results element, setting up observer");
        const observer = new MutationObserver(function(mutations) {
            console.log("Detected mutation in plate_solve_results");
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    updateOffsetCalculation();
                }
            });
        });
        
        observer.observe(targetNode, { 
            childList: true, 
            subtree: true,
            characterData: true 
        });
    } else {
        console.log("plate_solve_results element not found, will use manual button only");
    }
    
    // Also try to calculate immediately in case results are already available
    setTimeout(updateOffsetCalculation, 1000);
}

// Initialize when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("Document loaded, setting up offset calculation");
    setupOffsetCalculation();
});

// Also try to set up after window is fully loaded (backup)
window.addEventListener('load', function() {
    console.log("Window loaded, ensuring offset calculation is set up");
    setupOffsetCalculation();
});