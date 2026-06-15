import os
import random
import requests
import json
from pathlib import Path

def test_api():
    print("Selecting 3 random images from the dataset...")
    dataset_dir = Path("dataset/lfw_subset")
    images = list(dataset_dir.rglob("*.jpg"))
    
    if not images:
        print("No images found in dataset!")
        return

    selected_images = random.sample(images, min(2, len(images)))
    
    p1 = Path("my_test_images/p1.jpeg")
    if p1.exists():
        selected_images.append(p1)
    
    results = []

    url = "http://localhost:8080/api/cases/analyze-and-match"

    for img_path in selected_images:
        print(f"\nTesting image: {img_path}")
        with open(img_path, 'rb') as f:
            files = {'image': (img_path.name, f, 'image/jpeg')}
            data = {'fidelityW': '0.85'}
            
            try:
                response = requests.post(url, files=files, data=data)
                
                if response.status_code == 200:
                    json_res = response.json()
                    print(f"Success! Match Found: {json_res.get('matchFound')} | Name: {json_res.get('suspect', {}).get('name') if json_res.get('suspect') else 'None'} | Score: {json_res.get('similarityScore')}")
                    results.append({
                        "tested_image": str(img_path),
                        "api_response": json_res
                    })
                else:
                    print(f"Failed with status code: {response.status_code}")
                    print(response.text)
                    results.append({
                        "tested_image": str(img_path),
                        "error": response.text
                    })
            except Exception as e:
                print(f"Exception: {e}")

    # Save results to a file
    with open("test_results.json", "w") as f:
        json.dump(results, f, indent=4)
    print("\n✅ All results saved to test_results.json")

if __name__ == "__main__":
    test_api()
