import os
from PIL import Image

# Define folder path where grayscale images are stored
folder_path = r"C:/Users/aquil/Desktop/NOVA/NOVA---Navigational-Object-Verification-and-Alignment/image_preprocessing/raw_data/anusha_raw"

# Target size (640x640)
target_size = (640, 640)

def resize_image(image_path):
    # Open the grayscale image
    with Image.open(image_path) as img:
        # Ensure the image is in grayscale mode
        if img.mode != "L":
            img = img.convert("L")
        
        # Maintain aspect ratio and resize
        img.thumbnail(target_size, Image.ANTIALIAS)

        # Create a new grayscale image with black background (for padding)
        new_img = Image.new("L", target_size, 0)  # 0 is black in grayscale

        # Paste the resized image onto the center of the black background
        new_img.paste(
            img, ((target_size[0] - img.size[0]) // 2, (target_size[1] - img.size[1]) // 2)
        )
        
        # Save the image, replacing the original
        new_img.save(image_path)

def resize_images_in_folder(folder_path):
    for filename in os.listdir(folder_path):
        if filename.endswith((".jpg", ".jpeg", ".png")):  # Add other image formats if necessary
            image_path = os.path.join(folder_path, filename)
            resize_image(image_path)
            print(f"Resized and saved: {filename}")

# Run the resizing function
resize_images_in_folder(folder_path)
