import sys
import cv2
import numpy as np
import json
from skimage.metrics import structural_similarity as ssim
import os

def load_image_from_file(file_path):
    """Loads an image from a file path using OpenCV."""
    image = cv2.imread(file_path, cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise ValueError(f"Could not load image from path: {file_path}")
    
    # Resize image for comparison (assuming 300x300 as in previous code)
    image = cv2.resize(image, (300, 300))
    return image

def compare_fingerprints(img1, img2):
    """Compares two fingerprint images using SSIM."""
    score, _ = ssim(img1, img2, full=True)
    return score

if __name__ == '__main__':
    uploaded_image_path = sys.argv[1]
    stored_image_paths = json.loads(sys.argv[2])

    try:
        # Load the uploaded fingerprint image
        uploaded_fingerprint = load_image_from_file(uploaded_image_path)

        best_match = -1
        best_score = 0

        # Loop through each stored fingerprint image
        for idx, image_path in enumerate(stored_image_paths):
            try:
                # Load stored fingerprint image from file
                stored_fingerprint = load_image_from_file(image_path)
                # Compare fingerprints using SSIM
                score = compare_fingerprints(uploaded_fingerprint, stored_fingerprint)

                # Find the best match based on score
                if score > 0.7 and score > best_score:
                    best_score = score
                    best_match = idx
            except Exception as e:
                print(f"Error processing fingerprint at {image_path}: {str(e)}", file=sys.stderr)

        # Result indicating best match index and match percentage
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
