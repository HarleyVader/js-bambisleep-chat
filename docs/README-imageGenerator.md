# Image Generator Worker

This worker integrates with RunPod's AI API to generate images from text prompts in the BambiSleep Chat application.

## Features

- Text-to-image generation based on user prompts
- Support for negative prompts to improve image quality
- Configurable image dimensions
- Asynchronous job processing with status updates
- Real-time image generation via socket connection
- Image download capabilities

## Setup

1. Add the RunPod API key to your `.env` file:
   ```
   RUNPOD_API_KEY=your_api_key_here
   RUNPOD_API_URL=https://api.runpod.ai/v2/ttz08s667h5t9r/run
   ```

2. The worker is automatically initialized by the worker coordinator when the application starts.

## Usage

### Socket API

The image generator can be accessed through socket events:

```javascript
// Client-side
// To generate an image
socket.emit('generate-image', {
  prompt: 'A beautiful sunset over mountains',
  negativePrompt: 'ugly, blurry, distorted',
  width: 512,  // optional, defaults to 512
  height: 512  // optional, defaults to 512
});

// Listen for job start (for async processing)
socket.on('image-generation-started', (data) => {
  console.log('Image generation started with job ID:', data.jobId);
  // You can store this job ID to check status later
});

// For checking status of an ongoing job
socket.emit('check-image-job', { jobId: 'job_123456' });

// Listen for status updates
socket.on('image-generation-status', (data) => {
  console.log('Job status:', data.status);
});

// Listen for results
socket.on('image-generated', (result) => {
  // Handle the generated image
  if (result.success) {
    const imageUrl = result.data.output[0];
    // Display the image
  }
});

// Listen for errors
socket.on('image-generation-error', (error) => {
  console.error('Image generation failed:', error.error);
});
```

### REST API

The image generator can also be accessed through HTTP endpoints:

```
POST /api/generate-image
```

Request body:
```json
{
  "prompt": "A beautiful sunset over mountains",
  "negativePrompt": "ugly, blurry, distorted",
  "width": 512,
  "height": 512
}
```

Response for asynchronous jobs:
```json
{
  "success": true,
  "status": "processing",
  "jobId": "job_123456",
  "message": "Image generation in progress"
}
```

For checking job status:
```
GET /api/image-job/:jobId
```

Response:
```json
{
  "success": true,
  "status": "COMPLETED",
  "data": {
    "id": "...",
    "output": ["https://..."]
  }
}
```

## Testing

A test script is available at `src/test/imageGeneratorTest.js` to verify the worker is functioning correctly.

Run the test with:
```
node src/test/imageGeneratorTest.js
```
