// React example
const sendImageForPrediction = async (imageFile) => {
    try {
        const formData = new FormData();
        formData.append('file', imageFile);

        const response = await fetch('http://localhost:8000/predict', {
            method: 'POST',
            body: formData,
        });

        const results = await response.json();
        console.log('Prediction results:', results);
        // Handle the results here
        
    } catch (error) {
        console.error('Error getting prediction:', error);
    }
};

// Use it with file input
<input 
    type="file" 
    accept="image/*" 
    onChange={(e) => sendImageForPrediction(e.target.files[0])} 
/>

// Or with webcam capture
const captureAndSend = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    
    // Set up video
    video.srcObject = stream;
    await video.play();
    
    // Capture frame
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    // Convert to file and send
    canvas.toBlob((blob) => {
        sendImageForPrediction(blob);
    }, 'image/jpeg');
    
    // Clean up
    stream.getTracks().forEach(track => track.stop());
};