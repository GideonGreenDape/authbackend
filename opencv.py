import sys
import cv2
import numpy as np
import json
import base64
from skimage.metrics import structural_similarity as ssim

def fix_base64_padding(data):
    """Fixes base64 padding if required."""
    if isinstance(data, bytes):
        data = data.decode('utf-8')
    return data + '=' * (-len(data) % 4)

def load_fingerprint_from_base64(base64_data):
    """Decode base64 and convert to an OpenCV image."""
    base64_data = fix_base64_padding(base64_data)
    try:
        decoded_image = base64.b64decode(base64_data)
    except Exception as e:
        print(f"Error decoding base64 data: {base64_data[:50]}...")  # Log the first 50 characters
        raise ValueError("Invalid base64-encoded string.") from e

    nparr = np.frombuffer(decoded_image, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)

    if image is None:
        raise ValueError("Decoded image could not be loaded.")
    
    image = cv2.resize(image, (300, 300))
    return image

def compare_fingerprints(img1, img2):
    score, _ = ssim(img1, img2, full=True)
    return score

if __name__ == '__main__':
    input_image_path = sys.argv[1]
    fingerprint_images = json.loads(sys.argv[2])  

    try:
        with open(input_image_path, 'rb') as f:
            uploaded_fingerprint_base64 = base64.b64encode(f.read()).decode('utf-8')

        uploaded_fingerprint = load_fingerprint_from_base64(uploaded_fingerprint_base64)

        best_match = -1
        best_score = 0

        for idx, fingerprint_base64 in enumerate(fingerprint_images):
            try:
                stored_fingerprint = load_fingerprint_from_base64(fingerprint_base64)
                score = compare_fingerprints(uploaded_fingerprint, stored_fingerprint)

                if score > 0.7 and score > best_score:
                    best_score = score
                    best_match = idx
            except Exception as e:
                print(f"Error processing fingerprint {idx}: {str(e)}", file=sys.stderr)

        result = {
            "matchIndex": best_match,
            "matchPercentage": best_score * 100 if best_match != -1 else None
        }

        print(json.dumps(result))

    except Exception as e:
        error_result = {
            "error": str(e)
        }
        print(json.dumps(error_result))
