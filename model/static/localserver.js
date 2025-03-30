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
