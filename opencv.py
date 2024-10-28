import sys
import cv2
import numpy as np
import json
import base64
from skimage.metrics import structural_similarity as ssim

def convert_binary_to_base64(binary_data):
    """Converts binary (BSON from MongoDB) to base64 encoded string."""
    return base64.b64encode(binary_data).decode('utf-8')

def load_fingerprint_from_binary(binary_data):
    """Convert MongoDB binary to an OpenCV image."""
    # Convert binary to base64 first
    base64_data = convert_binary_to_base64(binary_data)
    
    # Decode base64 to raw image bytes
    decoded_image = base64.b64decode(base64_data)
    nparr = np.frombuffer(decoded_image, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)

    if image is None:
        raise ValueError("Decoded image could not be loaded.")
    
    # Resize image for comparison
    image = cv2.resize(image, (300, 300))
    return image

def compare_fingerprints(img1, img2):
    """Compares two fingerprint images using SSIM."""
    score, _ = ssim(img1, img2, full=True)
    return score

if __name__ == '__main__':
    input_image_path = sys.argv[1]
    fingerprint_images = json.loads(sys.argv[2])

    try:
        # Load the uploaded fingerprint image from file
        with open(input_image_path, 'rb') as f:
            uploaded_fingerprint_data = f.read()

        # Convert binary file data to OpenCV image
        uploaded_fingerprint = load_fingerprint_from_binary(uploaded_fingerprint_data)

        best_match = -1
        best_score = 0

        # Loop through each fingerprint from the MongoDB collection
        for idx, fingerprint_binary in enumerate(fingerprint_images):
            try:
                # Convert stored MongoDB binary to OpenCV image
                stored_fingerprint = load_fingerprint_from_binary(fingerprint_binary)
                # Compare fingerprints using SSIM
                score = compare_fingerprints(uploaded_fingerprint, stored_fingerprint)

                # Find the best match based on score
                if score > 0.7 and score > best_score:
                    best_score = score
                    best_match = idx
            except Exception as e:
                print(f"Error processing fingerprint {idx}: {str(e)}", file=sys.stderr)

        result = {
            "matchIndex": best_match,
            "matchPercentage": best_score * 100 if best_match != -1 else None
        }

        # Output result to stdout
        print(json.dumps(result))

    except Exception as e:
        error_result = {
            "error": str(e)
        }
        print(json.dumps(error_result))
