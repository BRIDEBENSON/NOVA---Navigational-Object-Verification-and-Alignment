const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const ort = require("onnxruntime-node"); // ONNX Runtime

const app = express();
app.use(express.json());

const MODEL_URL = "https://raw.githubusercontent.com/BRIDEBENSON/NOVA---Navigational-Object-Verification-and-Alignment/main/yolov8.onnx";
const MODEL_PATH = "/tmp/yolov8.onnx"; // Temporary path in Vercel

let session;

// Function to download the model
async function loadModel() {
    if (!fs.existsSync(MODEL_PATH)) {
        console.log("Downloading model...");
        const response = await axios({
            url: MODEL_URL,
            method: "GET",
            responseType: "arraybuffer",
        });
        fs.writeFileSync(MODEL_PATH, response.data);
    }
    console.log("Model downloaded!");

    // Load the ONNX model
    session = await ort.InferenceSession.create(MODEL_PATH);
    console.log("Model loaded successfully!");
}

// Load the model when the server starts
loadModel();

// API route to run inference
app.post("/api/predict", async (req, res) => {
    try {
        if (!session) {
            return res.status(500).json({ error: "Model not loaded yet." });
        }

        // Process input image (For now, let's just return a success message)
        return res.json({ message: "API is working! Model is ready for inference." });
    } catch (error) {
        console.error("Error running model:", error);
        return res.status(500).json({ error: "Error running model" });
    }
});

module.exports = app;
