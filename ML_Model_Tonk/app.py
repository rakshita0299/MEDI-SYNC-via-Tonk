from flask import Flask, request, jsonify
from PIL import Image, ImageOps
import torch
import io
import base64
from model import model, transform, device, model_br, processor
import numpy as np
import openai

app = Flask(__name__)

label_mapping = {0: "benign", 1: "malignant"}

def combine_image_with_mask(original: Image.Image, mask_np: np.ndarray) -> str:
    mask_img = Image.fromarray(mask_np).resize(original.size).convert("L")
    original = original.convert("RGB")
    combined = Image.new("RGB", (original.width * 2, original.height))
    combined.paste(original, (0, 0))
    combined.paste(mask_img.convert("RGB"), (original.width, 0))

    buffer = io.BytesIO()
    combined.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()

@app.route("/analyze-image", methods=["POST"])
def analyze_image():
    try:
        data = request.get_json()
        if "image_data" not in data:
            return jsonify({"error": "Missing 'image_data' field"}), 400

        # Extract and decode base64 data
        base64_data = data["image_data"].split(",")[1]  # remove header
        image_data = base64.b64decode(base64_data)
        image = Image.open(io.BytesIO(image_data)).convert("RGB")

        inputs = processor(images=image, return_tensors="pt")
        with torch.no_grad():
            logits = model_br(**inputs).logits
            pred_idx = logits.argmax(-1).item()
            label = label_mapping.get(pred_idx, "Unknown")

        return jsonify({"prediction": label})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/segment-image", methods=["POST"])
def segment_image():
    try:
        data = request.get_json()
        if "image_data" not in data:
            return jsonify({"error": "Missing image_data"}), 400

        base64_data = data["image_data"].split(",")[1]
        image_bytes = base64.b64decode(base64_data)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        original_size = image.size

        input_tensor = transform(image).unsqueeze(0).to(device)

        with torch.no_grad():
            output = model(input_tensor)

            # If HuggingFace-style output
            if hasattr(output, "logits"):
                output = output.logits

            output = torch.sigmoid(output)
            mask = output.squeeze().cpu().numpy()

            if mask.ndim != 2:
                return jsonify({"error": f"Unexpected mask shape: {mask.shape}"}), 500

            binary_mask = (mask > 0.5).astype(np.uint8) * 255
            base64_combined = combine_image_with_mask(image, binary_mask)

        return jsonify({
            "prediction": f"data:image/png;base64,{base64_combined}"
        })

    except Exception as e:
        return jsonify({ "error": str(e) }), 500

@app.route("/analyze-vitals", methods=["POST"])
def analyze_vitals():
    try:
        data = request.get_json()

        vitals = data
        print(vitals)

        prompt = f"""
You are a medical assistant AI. A patient has submitted the following vital signs:

{vitals}

Please analyze the vitals and return 4 to 6 clear and helpful health insights. Each insight should be brief and medically relevant. Use bullet points.
"""

        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",  # or "gpt-4"
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
        )

        reply = response.choices[0].message["content"]
        insights = [line.strip("-• ") for line in reply.splitlines() if line.strip() and ("-" in line or "•" in line)]

        return jsonify({"insights": insights})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)