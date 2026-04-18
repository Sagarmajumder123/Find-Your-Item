/**
 * AI Image Validation for Find Your Item
 * Uses face-api.js to detect human faces in images.
 */

/* global faceapi */

let modelsLoaded = false;

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

export const loadModels = async () => {
    if (modelsLoaded) return;
    try {
        console.log("🧠 Loading AI Models...");
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        ]);
        modelsLoaded = true;
        console.log("✅ AI Models Loaded");
    } catch (err) {
        console.error("❌ Failed to load AI models:", err);
    }
};

/**
 * Checks if an image contains a human face.
 * @param {File|string} imageSource - File object or Image URL
 * @returns {Promise<boolean>} - True if a face is detected
 */
export const containsFace = async (imageSource) => {
    try {
        await loadModels();
        
        let img;
        if (typeof imageSource === 'string') {
            img = await faceapi.fetchImage(imageSource);
        } else {
            img = await faceapi.bufferToImage(imageSource);
        }

        const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions());
        
        return detections.length > 0;
    } catch (err) {
        console.error("Image validation error:", err);
        return false; // Fail open but log error
    }
};
