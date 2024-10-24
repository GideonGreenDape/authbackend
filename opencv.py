import sys
import cv2
import numpy as np
import json
import base64

def load_fingerprint(image_path):
    # Load the fingerprint image in grayscale
    image = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    
    # Apply preprocessing steps if needed (e.g., resize, enhance, etc.)
    image = cv2.resize(image, (300, 300))  # Resize to a fixed size for comparison
    return image

def compare_fingerprints(img1, img2):
    # Compute SSIM score using QualitySSIM
    score = cv2.quality.QualitySSIM.compute(img1, img2)
    
    # Return the score (similarity between 0 and 1)
    return score[0]

if __name__ == '__main__':
    input_image_path = sys.argv[1]  # Uploaded fingerprint path
    fingerprint_images = json.loads(sys.argv[2])  # List of stored fingerprints (base64 encoded)

    # Load the uploaded fingerprint image
    uploaded_fingerprint = load_fingerprint(input_image_path)

    best_match = -1  # Variable to store the index of the best match
    best_score = 0  # Variable to store the highest score

    # Compare the uploaded fingerprint with each stored fingerprint
    for idx, fingerprint_base64 in enumerate(fingerprint_images):
        try:
            # Convert base64-encoded image to an OpenCV image
            decoded_image = base64.b64decode(fingerprint_base64)
            nparr = np.frombuffer(decoded_image, np.uint8)
            stored_fingerprint = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
            
            # Resize stored fingerprint to match the uploaded one
            stored_fingerprint = cv2.resize(stored_fingerprint, (300, 300))
            
            # Compare fingerprints using SSIM
            score = compare_fingerprints(uploaded_fingerprint, stored_fingerprint)

            # Check if this score is the best match and above the 70% threshold
            if score > 0.7 and score > best_score:
                best_score = score
                best_match = idx
        except Exception as e:
            print(f"Error processing fingerprint {idx}: {str(e)}", file=sys.stderr)

    # Prepare the result based on whether a match was found or not
    if best_match != -1:
        result = {
            "matchIndex": best_match,
            "matchPercentage": best_score * 100  # Convert to percentage
        }
    else:
        result = {
            "matchIndex": -1,
            "message": "Match not found"
        }

    # Output the result as JSON for Node.js to capture
    print(json.dumps(result))
