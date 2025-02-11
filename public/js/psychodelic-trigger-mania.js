const eyeCursor = document.querySelector("#eyeCursor");

// Check if eyeCursor is not null
if (eyeCursor) {
  const clicks = [false, false, false, false];
  const centerCalibrate = [];
  const trancePoint = [0, 0];

  const avgPoints = [];
  const first = true;

  const xdPred = 0;
  const ydPred = 0;

  let multiplierA1Value = 1;
  let multiplierA2Value = 1;
  let multiplierB1Value = 1;
  let multiplierB2Value = 1;

  let operationValue = 'add';

  function setup() {
    // Get the #eyeCursor element
    const width = eyeCursor.clientWidth;
    const height = eyeCursor.clientHeight;

    // Create a canvas with the size of the #eyeCursor element
    const cnv = createCanvas(width, height);

    // Append the canvas to the #eyeCursor div
    cnv.parent("eyeCursor");

    // Add event listener for window resize
    window.addEventListener("resize", onWindowResize);
  }

  function draw() {
    clear();
    translate(width / 2, height / 2);
    let a = map(sin(frameCount / 20), -1, 1, 0.5, 1.5);
    let b = map(cos(frameCount / 20), -1, 1, 1, 1.5);

    switch (operationValue) {
      case 'add':
        a += multiplierA1Value;
        b += multiplierB1Value;
        break;
      case 'subtract':
        a -= multiplierA2Value;
        b -= multiplierB2Value;
        break;
      case 'multiply':
        a *= multiplierA1Value;
        b *= multiplierB1Value;
        break;
      case 'divide':
        a /= multiplierA2Value;
        b /= multiplierB2Value;
        break;
    }

    rotate(frameCount / 5);
    spiral(a, 1, [199, 0, 199]);
    spiral(b, 0.3, [255, 130, 255]);
    calibrationComplete();
    circle(trancePoint[0], trancePoint[1], 40);
  }

  function onWindowResize() {
    // Update the canvas size
    const width = eyeCursor.clientWidth;
    const height = eyeCursor.clientHeight;
    resizeCanvas(width, height);
  }

  function calibrationComplete() {
    tranceAmt = dist(xdPred, ydPred, trancePoint[0], trancePoint[1]);
  }

  function spiral(a, x, d) {
    fill(d[0], d[1], d[2]); stroke(d[0], d[1], d[2]);
    let r1 = 0, r2 = 2, step = a, spiralWidth = 5.0 * multiplierA1Value, dw = (spiralWidth / 350) * multiplierB1Value;
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
} else {
  console.error("Element with id 'eyeCursor' not found.");
}