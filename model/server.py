# server.py
from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware
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

# Let's add a simple test endpoint
@app.get("/test")
async def test():
    return {"message": "Server is working!"}

# Make sure your .pt file path is correct
MODEL_PATH = 'yolov8.pt'  # Update this path

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
            return {"error": "Model not loaded"}
            
        results = model(img)
        predictions = []
        
        # Process each detection
        for box, kps in zip(results[0].boxes, results[0].keypoints):
            pred = {
                "bbox": box.xyxy[0].tolist(),  # [x_min, y_min, x_max, y_max]
                "confidence": float(box.conf[0]),
                "class_id": int(box.cls[0]),
                "keypoints": kps.data[0].tolist()  # [[x1, y1, conf1], [x2, y2, conf2], ...]
            }
            predictions.append(pred)
            
        return {"predictions": predictions}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)