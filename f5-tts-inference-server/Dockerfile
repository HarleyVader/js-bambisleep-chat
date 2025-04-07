FROM python:3.10-slim

# Set environment variables for CUDA
ENV NVIDIA_VISIBLE_DEVICES all
ENV NVIDIA_DRIVER_CAPABILITIES compute,utility

# Set the working directory
WORKDIR /app

# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the source code and configuration files
COPY src/ ./src/
COPY config/ ./config/
COPY data/ ./data/

# Download the F5-TTS small model
RUN chmod +x ./scripts/download_model.sh
RUN ./scripts/download_model.sh

# Expose the port for the server
EXPOSE 7860

# Command to run the inference server
CMD ["python", "src/server.py"]