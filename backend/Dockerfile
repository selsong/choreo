# Use an official lightweight Python image
FROM --platform=linux/amd64 python:3.10-slim

# Set working directory inside container
WORKDIR /app

# Copy everything from choreo/ into container
COPY . .

# Install system dependencies + Python packages
RUN apt-get update && apt-get install -y \
    ffmpeg libsm6 libxext6 \
    && pip install --no-cache-dir flask flask-cors opencv-python mediapipe

# Expose Flask server port
EXPOSE 5000

# Run your server
CMD ["python", "server.py"]
