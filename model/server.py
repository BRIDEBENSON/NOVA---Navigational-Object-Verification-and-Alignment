from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn
from ultralytics import YOLO
import cv2
import numpy as np

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variable to store latest predictions and image info
latest_data = {
    "predictions": [],
    "image_center": None
}

# Serve the localserver.html file at root
@app.get("/")
async def root():
    return FileResponse("localserver.html")

# Serve the sample.html file
@app.get("/sample")
async def sample():
    return FileResponse("sample.html")

# Updated endpoint to get latest predictions and image center
@app.get("/get-predictions")
async def get_predictions():
    return latest_data

# Load YOLO model
MODEL_PATH = 'yolov8.pt'
try:
    model = YOLO(MODEL_PATH)
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

@app.post("/predict")
async def predict(file: UploadFile):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if model is None:
            raise HTTPException(status_code=500, detail="Model not loaded")
        
        # Get image dimensions and calculate center
        height, width = img.shape[:2]
        center_x = width // 2
        center_y = height // 2
            
        results = model(img)
        predictions = []
        
        for box, kps in zip(results[0].boxes, results[0].keypoints):
            # Get all keypoints with their confidence scores
            all_keypoints = kps.data[0].tolist()  # [[x1, y1, conf1], ...]
            
            # Create list of (index, confidence) pairs
            indexed_confidences = list(enumerate(point[2] for point in all_keypoints))
            
            # Sort by confidence but keep all points
            sorted_indices = sorted(indexed_confidences, key=lambda x: x[1], reverse=True)
            
            pred = {
                "bbox": box.xyxy[0].tolist(),
                "confidence": float(box.conf[0]),
                "class_id": int(box.cls[0]),
                "keypoints": all_keypoints,
                "sorted_confidence_indices": [idx for idx, _ in sorted_indices]
            }
            predictions.append(pred)
            
        # Update the latest data with both predictions and image center
        global latest_data
        latest_data = {
            "predictions": predictions,
            "image_center": {
                "x": center_x,
                "y": center_y
            }
        }
            
        return latest_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)