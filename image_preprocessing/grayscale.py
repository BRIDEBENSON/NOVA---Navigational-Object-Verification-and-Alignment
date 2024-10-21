from PIL import Image
import os

# Path to your folder containing the images
folder_path = "C:/Users/aquil/Desktop/NOVA/NOVA---Navigational-Object-Verification-and-Alignment/image_preprocessing/raw_data/mathew_raw"

# Supported image formats (you can add more if needed)
image_formats = (".jpg", ".jpeg", ".png", ".bmp", ".tiff")

# Loop through each file in the folder
for filename in os.listdir(folder_path):
    if filename.lower().endswith(image_formats):
        file_path = os.path.join(folder_path, filename)

        # Open the image
        img = Image.open(file_path)

        # Convert the image to grayscale
        grayscale_img = img.convert("L")

        # Save the image, replacing the original
        grayscale_img.save(file_path)

        print(f"Converted {filename} to grayscale.")

print("All images have been converted and replaced.")
