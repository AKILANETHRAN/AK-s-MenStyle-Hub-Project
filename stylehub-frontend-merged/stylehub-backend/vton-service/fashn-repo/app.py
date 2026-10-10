#!/usr/bin/env python3
"""
AK's MEN STYLE — Flask Local FASHN VTON Service (FASHN VTON v1.5)
Runs on port 7860
"""

import io
import os
import sys
import time
import logging
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from PIL import Image
import torch

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("fashn-vton-service")

app = Flask(__name__)
CORS(app)

# Global pipeline & status tracking
pipeline = None
is_busy = False
device_name = "CUDA" if torch.cuda.is_available() else "CPU"

def find_weights_dir():
    candidates = [
        os.environ.get("WEIGHTS_DIR"),
        r"D:\stylehub-vton\weights",
        str(Path(__file__).resolve().parent.parent / "weights"),
        str(Path(__file__).resolve().parent / "weights"),
    ]
    for c in candidates:
        if c and os.path.exists(c) and os.path.exists(os.path.join(c, "model.safetensors")):
            return c
    return None

weights_dir = find_weights_dir()
logger.info(f"Weights directory resolved: {weights_dir}")

def init_pipeline():
    global pipeline
    if weights_dir is None:
        logger.error("Weights directory not found!")
        return False
    try:
        from fashn_vton import TryOnPipeline
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Initializing TryOnPipeline with device={device}...")
        pipeline = TryOnPipeline(weights_dir=weights_dir, device=device)
        logger.info("TryOnPipeline successfully loaded and ready for inference!")
        return True
    except Exception as e:
        logger.exception(f"Failed to initialize TryOnPipeline: {e}")
        return False

# Load pipeline at module start
weights_ready = init_pipeline()

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "weights_ready": weights_ready and (pipeline is not None),
        "device": device_name,
        "is_busy": is_busy,
        "model": "FASHN VTON v1.5"
    })

@app.route("/try-on", methods=["POST"])
@app.route("/api/vton/try-on", methods=["POST"])
def try_on():
    global is_busy
    if is_busy:
        return jsonify({
            "error": "Another virtual try-on is currently being generated",
            "message": "Another virtual try-on is currently being processed. Please wait.",
            "status": "busy"
        }), 503

    if pipeline is None:
        return jsonify({
            "error": "Pipeline not initialized",
            "message": "Virtual try-on model weights are not loaded."
        }), 500

    if "person_image" not in request.files:
        return jsonify({"error": "Missing person_image file"}), 400

    if "garment_image" not in request.files:
        return jsonify({"error": "Missing garment_image file"}), 400

    category = request.form.get("category", "tops").lower()
    if category not in ["tops", "bottoms", "one-pieces"]:
        category = "tops"

    num_timesteps = int(request.form.get("num_timesteps", 12))
    guidance_scale = float(request.form.get("guidance_scale", 1.5))
    seed = int(request.form.get("seed", 42))

    try:
        is_busy = True
        logger.info(f"Received try-on request: category={category}, timesteps={num_timesteps}, seed={seed}")
        start_time = time.time()

        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        person_file = request.files["person_image"]
        garment_file = request.files["garment_image"]

        person_img = Image.open(person_file.stream).convert("RGB")
        garment_img = Image.open(garment_file.stream).convert("RGB")

        # Keep resolution within model input dimension (max 864) to prevent VRAM overflow on 4GB GPUs
        max_dim = 864
        if max(person_img.size) > max_dim:
            scale = max_dim / max(person_img.size)
            person_img = person_img.resize((int(person_img.width * scale), int(person_img.height * scale)), Image.Resampling.LANCZOS)

        if max(garment_img.size) > max_dim:
            scale = max_dim / max(garment_img.size)
            garment_img = garment_img.resize((int(garment_img.width * scale), int(garment_img.height * scale)), Image.Resampling.LANCZOS)

        logger.info(f"Optimized person image size: {person_img.size}, garment size: {garment_img.size}")

        with torch.inference_mode():
            result = pipeline(
                person_image=person_img,
                garment_image=garment_img,
                category=category,
                garment_photo_type="flat-lay",
                num_samples=1,
                num_timesteps=num_timesteps,
                guidance_scale=guidance_scale,
                seed=seed,
                segmentation_free=True
            )

        if not result.images or len(result.images) == 0:
            raise RuntimeError("Pipeline completed but returned no images")

        out_img = result.images[0]
        elapsed = time.time() - start_time
        logger.info(f"Inference completed successfully in {elapsed:.2f} seconds!")

        # Return as PNG
        img_io = io.BytesIO()
        out_img.save(img_io, format="PNG")
        img_io.seek(0)
        return send_file(img_io, mimetype="image/png")

    except Exception as e:
        logger.exception(f"Inference error: {e}")
        return jsonify({
            "error": "Generation failure",
            "message": str(e)
        }), 500

    finally:
        is_busy = False

if __name__ == "__main__":
    logger.info("Starting Flask FASHN VTON Service on http://127.0.0.1:7860")
    app.run(host="0.0.0.0", port=7860, threaded=False)
