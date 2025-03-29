const video = document.getElementById('video');
const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d');
let liveDetectionInterval = null;
let currentImage = null;
let stream = null;

// Start webcam with error handling
document.getElementById('startWebcam').addEventListener('click', async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 640,
                height: 480
            }
        });
        video.srcObject = stream;
        await video.play();
    } catch (err) {
        console.error("Error accessing webcam:", err);
        alert("Failed to access webcam. Please ensure you have granted camera permissions.");
    }
});

// Stop webcam with proper cleanup
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

// Capture frame with error handling
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

// Start live detection with proper checks
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

// Stop live detection
document.getElementById('stopLive').addEventListener('click', () => {
    if (liveDetectionInterval) {
        clearInterval(liveDetectionInterval);
        liveDetectionInterval = null;
    }
});

// Draw detections with fixed template literals
const drawDetections = (data) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (currentImage) {
        ctx.putImageData(currentImage, 0, 0);
    }

    data.predictions.forEach(pred => {
        const [x1, y1, x2, y2] = pred.bbox;
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 3;
        ctx.font = '14px Arial';
        const text = `Confidence: ${(pred.confidence * 100).toFixed(1)}%`;
        ctx.strokeText(text, x1, y1 - 5);
        ctx.fillText(text, x1, y1 - 5);

        pred.keypoints.forEach((point, index) => {
            const [x, y, conf] = point;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            const alpha = Math.max(0.3, conf);
            ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.font = '12px Arial';
            ctx.strokeText(index + 1, x + 6, y - 6);
            ctx.fillText(index + 1, x + 6, y - 6);
        });
    });
};

const formatPredictions = (data) => {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '';

    // Add image center information
    if (data.image_center) {
        const centerDiv = document.createElement('div');
        centerDiv.style.marginBottom = '20px';
        centerDiv.innerHTML = `
            <h4>Image Center</h4>
            <div style="margin-left: 10px">
                <p>X: ${data.image_center.x}</p>
                <p>Y: ${data.image_center.y}</p>
            </div>
        `;
        resultDiv.appendChild(centerDiv);
    }

    data.predictions.forEach((pred, index) => {
        const predDiv = document.createElement('div');
        predDiv.style.marginBottom = '20px';
        predDiv.innerHTML = `
                <h4>Detection ${index + 1}</h4>
                <div style="margin-left: 10px">
                    <p><strong>Confidence:</strong> ${(pred.confidence * 100).toFixed(1)}%</p>
                    <p><strong>Bounding Box:</strong></p>
                    <ul style="margin: 5px 0">
                        <li>Top-left: (${pred.bbox[0].toFixed(1)}, ${pred.bbox[1].toFixed(1)})</li>
                        <li>Bottom-right: (${pred.bbox[2].toFixed(1)}, ${pred.bbox[3].toFixed(1)})</li>
                    </ul>
                    <p><strong>Keypoints:</strong></p>
                    <div style="margin-left: 10px">
                        ${pred.keypoints.map((point, i) => `
                            <p>Point ${i + 1}: (${point[0].toFixed(1)}, ${point[1].toFixed(1)}) - 
                               Confidence: ${(point[2] * 100).toFixed(1)}%</p>
                        `).join('')}
                    </div>
                </div>
            `;
        resultDiv.appendChild(predDiv);
    });
};

const sendImageForPrediction = async (imageBlob) => {
    try {
        const formData = new FormData();
        formData.append('file', imageBlob);

        const response = await fetch('http://localhost:8000/predict', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

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

            canvas.toBlob((blob) => {
                if (blob) {
                    sendImageForPrediction(blob);
                }
            }, 'image/jpeg', 0.95);
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
