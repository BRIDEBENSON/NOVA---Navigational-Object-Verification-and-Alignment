from fastapi import FastAPI, UploadFile, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import serial
import json
import uvicorn
from ultralytics import YOLO
import cv2
import numpy as np
from typing import Dict, Any
import time

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

# Arduino serial connection settings
ARDUINO_PORT = '/dev/ttyACM0'  # Change this to match your system (COM3 on Windows)
ARDUINO_BAUD_RATE = 9600
arduino_serial = None

def initialize_arduino():
    global arduino_serial
    try:
        arduino_serial = serial.Serial(ARDUINO_PORT, ARDUINO_BAUD_RATE, timeout=1)
        time.sleep(2)  # Give Arduino time to reset after connection
        return True
    except Exception as e:
        print(f"Error connecting to Arduino: {e}")
        return False

# Try to initialize Arduino connection at startup
arduino_connected = initialize_arduino()
if arduino_connected:
    print(f"Connected to Arduino on {ARDUINO_PORT}")
else:
    print("Arduino not connected. Telescope control will not be available.")

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

# New endpoint to send telescope alignment commands to Arduino
@app.post("/send-to-arduino")
async def send_to_arduino(data: Dict[Any, Any] = Body(...)):
    global arduino_serial, arduino_connected
    
    # Check if Arduino is connected
    if not arduino_connected or arduino_serial is None:
        # Try to reconnect
        arduino_connected = initialize_arduino()
        if not arduino_connected:
            return JSONResponse(
                status_code=503,
                content={"success": False, "message": "Arduino not connected"}
            )
    
    try:
        # Extract RA and DEC offset values
        ra_offset = data.get("raOffset")
        dec_offset = data.get("decOffset")
        
        if ra_offset is None or dec_offset is None:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Missing RA or DEC offset values"}
            )
        
        # Format command for Arduino
        command = f"MOVE RA:{ra_offset:.4f} DEC:{dec_offset:.4f}\n"
        
        # Send command to Arduino
        arduino_serial.write(command.encode())
        
        # Wait for response (optional)
        time.sleep(0.1)
        response = ""
        while arduino_serial.in_waiting > 0:
            response += arduino_serial.readline().decode('utf-8').strip() + "\n"
        
        print(f"Command sent to Arduino: {command.strip()}")
        if response:
            print(f"Arduino response: {response}")
        
        return {"success": True, "message": "Command sent to telescope", "response": response}
    
    except Exception as e:
        print(f"Error communicating with Arduino: {e}")
        # If there was an error, mark Arduino as disconnected
        arduino_connected = False
        if arduino_serial:
            try:
                arduino_serial.close()
            except:
                pass
            arduino_serial = None
        
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Failed to send command: {str(e)}"}
        )

@app.get("/plate-solve")
async def plate_solve():
    return FileResponse("plate-solve.html", media_type="text/html")

@app.get("/plate-solve-main.js")
async def plate_solve_main():
    return FileResponse("plate-solve-main.js", media_type="text/javascript")

@app.get("/plate-solve.js")
async def plate_solve_js():
    return FileResponse("plate-solve.js", media_type="text/javascript")

@app.get("/reference-stars")
async def get_reference_stars():
    try:
        with open("reference_stars.json", "r") as f:
            return JSONResponse(content=json.load(f))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Reference stars data not found")
    
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/localserver.css")
async def get_localserver_css():
    return FileResponse("static/localserver.css", media_type="text/css")

@app.get("/localserver.js")
async def get_localserver_js():
    return FileResponse("static/localserver.js", media_type="text/javascript")

@app.on_event("shutdown")
async def shutdown_event():
    # Close Arduino connection when server shuts down
    global arduino_serial
    if arduino_serial:
        arduino_serial.close()
        print("Arduino connection closed")
    
if __name__ == "__main__":
    print("Available endpoints:")
    for route in app.routes:
        print(f"  {route.methods} {route.path}")
    uvicorn.run(app, host="127.0.0.1", port=8000)