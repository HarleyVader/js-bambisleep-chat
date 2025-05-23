let eyeCursor;
let canvas;
let width, height;

// Control parameters for spirals
let spiral1Width = 5.0;
let spiral2Width = 3.0;
let spiral1Speed = 20; // Speed for first spiral
let spiral2Speed = 15; // Speed for second spiral (slightly different)

function setup() {
  eyeCursor = document.querySelector("#eyeCursor");
  
  // Check if eyeCursor is not null
  if (!eyeCursor) {
    console.error("Element with id 'eyeCursor' not found.");
    return;
  }
  
  width = eyeCursor.clientWidth;
  height = eyeCursor.clientHeight;

  // Create a canvas with the size of the #eyeCursor element
  canvas = createCanvas(width, height);

  // Append the canvas to the #eyeCursor div
  canvas.parent("eyeCursor");

  // Add event listener for window resize
  window.addEventListener("resize", onWindowResize);
}

function draw() {
  clear();
  translate(width / 2, height / 2);
  
  // Base values for spirals with separate speeds
  let a = map(sin(frameCount / spiral1Speed), -1, 1, 0.5, 1.5);
  let b = map(cos(frameCount / spiral2Speed), -1, 1, 1, 1.5);

  rotate(frameCount / 5);
  spiral(a, 1, [199, 0, 199], spiral1Width);
  spiral(b, 0.3, [255, 130, 255], spiral2Width);
}

function onWindowResize() {
  // Check if eyeCursor exists
  if (!eyeCursor) return;
  
  // Update the canvas size
  width = eyeCursor.clientWidth;
  height = eyeCursor.clientHeight;
  resizeCanvas(width, height);
}

function spiral(a, x, d, baseWidth) {
  fill(d[0], d[1], d[2]);
  stroke(d[0], d[1], d[2]);
  
  let r1 = 0, r2 = 2, step = a;
  let spiralWidth = baseWidth;
  let dw = (spiralWidth / 350);
  
  beginShape(TRIANGLE_STRIP);
  for (let i = 0; i < 450; i++) {
    r1 += step;
    spiralWidth -= dw;
    r2 = r1 + spiralWidth;
    const ang = x;
    const r1x = r1 * sin(ang * i);
    const r1y = r1 * cos(ang * i);
    const r2x = r2 * sin(ang * i);
    const r2y = r2 * cos(ang * i);
    vertex(r1x, r1y);
    vertex(r2x, r2y);
  }
  endShape();
}

// Function to update spiral parameters - renamed to avoid conflict
function updateSpiralParams(spiral1WidthValue, spiral2WidthValue, speedValue1, speedValue2) {
  spiral1Width = spiral1WidthValue;
  spiral2Width = spiral2WidthValue;
  spiral1Speed = speedValue1;
  spiral2Speed = speedValue2;
}

// Make the function globally accessible
window.updateSpiralParams = updateSpiralParams;