const listOfTriggers = [
  "BIMBO DOLL",
  "GOOD GIRL",
  "BAMBI SLEEP",
  "BAMBI FREEZE",
  "ZAP COCK DRAIN OBEY",
  "BAMBI ALWAYS WINS",
  "BAMBI RESET",
  "I-Q DROP",
  "I-Q LOCK",
  "POSTURE LOCK",
  "UNIFORM LOCK",
  "SAFE & SECURE",
  "PRIMPED",
  "PAMPERED",
  "SNAP & FORGET",
  "GIGGLE TIME",
  "BLONDE MOMENT",
  "BAMBI DOES AS SHE IS TOLD",
  "DROP FOR COCK",
  "COCK ZOMBIE NOW",
  "TITS LOCK",
  "WAIST LOCK",
  "BUTT LOCK",
  "LIMBS LOCK",
  "FACE LOCK",
  "LIPS LOCK",
  "THROAT LOCK",
  "HIPS LOCK",
  "CUNT LOCK",
  "BAMBI CUM & COLAPSE"
];


function createToggleButtons() {
  const container = document.getElementById("trigger-toggles");
  if (!container) return;

  listOfTriggers.forEach((trigger, index) => {
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.id = `toggle-${index}`;
    toggle.className = "toggle-input";

    const label = document.createElement("label");
    label.textContent = trigger;
    label.htmlFor = `toggle-${index}`;
    label.className = "toggle-label";

    container.appendChild(toggle);
    container.appendChild(label);
  });
}

function toggleAllToggles() {
  const toggleInputs = document.getElementsByClassName("toggle-input");
  for (let i = 0; i < toggleInputs.length; i++) {
    toggleInputs[i].checked = !toggleInputs[i].checked;
  }
}

window.onload = function () {
  createToggleButtons();
  const activateAllButton = document.getElementById("activate-all");
  if (activateAllButton) {
    activateAllButton.addEventListener("click", toggleAllToggles);
  }
};

function sendTriggers() {
  const enabledToggleButtons = getEnabledToggleButtons();
  if (!Array.isArray(enabledToggleButtons)) {
    console.error("No triggers selected");
    return;
  }

  const triggers = enabledToggleButtons.map(
    (buttonId) => listOfTriggers[parseInt(buttonId.split("-")[1])]
  );
  if (triggers.length === 0) {
    console.error("No valid triggers found");
    return;
  }
  socket.emit("triggers", triggers);
  console.log("Triggers sent:", triggers);
}

setInterval(() => {
  sendTriggers();
}, 3000);

function getEnabledToggleButtons() {
  const enabledToggleButtons = [];
  const toggleInputs = document.getElementsByClassName("toggle-input");
  for (let i = 0; i < toggleInputs.length; i++) {
    if (toggleInputs[i].checked) {
      enabledToggleButtons.push(toggleInputs[i].id);
    }
  }
  return enabledToggleButtons;
}

function scanTriggers() {
  let enabledToggleButtons = getEnabledToggleButtons();
  if (!Array.isArray(enabledToggleButtons)) {
    enabledToggleButtons = [];
  }

  const triggers = enabledToggleButtons.map(
    (buttonId) => listOfTriggers[parseInt(buttonId.split("-")[1])]
  );
  if (typeof currentMessage === "undefined") {
    console.error("currentMessage is not defined");
    return;
  }

  triggers.forEach((trigger) => {
    if (currentMessage.includes(trigger)) {
      flashTriggers(trigger);
    }
  });
}

function flashTriggers(trigger) {
  const container = document.getElementById("eye");
  if (!container) return;

  // Clear existing content
  container.innerHTML = "";

  // Create and append the trigger text
  const span = document.createElement("span");
  span.textContent = trigger;
  container.appendChild(span);  
}

function triggerTriggers() {
  // Get the enabled toggle buttons
  const enabledToggleButtons = getEnabledToggleButtons();
  if (!Array.isArray(enabledToggleButtons) || enabledToggleButtons.length === 0) {
    console.error("No triggers selected");
    return;
  }

  // Map the enabled toggle buttons to their corresponding trigger names
  const triggers = enabledToggleButtons.map(
    (buttonId) => listOfTriggers[parseInt(buttonId.split("-")[1])]
  );

  // Elements to fade in and out
  const elementsToFade = [
    document.getElementById("eyeCursorText"),
    document.getElementById("eyeCursorText2"),
    document.getElementById("eyeCursorText3"),
    document.getElementById("eyeCursorText4"),
  ];

  // Function to handle fading in and out for a specific element
  function fadeElement(element, trigger) {
    if (!element) return;

    // Clear the element's content
    element.textContent = "";

    // Set the trigger text and fade in
    element.textContent = trigger;
    element.style.opacity = "1";

    // Fade out after 1 second
    setTimeout(() => {
      element.style.opacity = "0";

      // Schedule the next fade with a random delay
      const randomDelay = Math.floor(Math.random() * 3000) + 2000; // Random delay between 2-5 seconds
      setTimeout(() => {
        const randomTrigger = triggers[Math.floor(Math.random() * triggers.length)];
        fadeElement(element, randomTrigger); // Recursively fade with a new random trigger
      }, randomDelay);
    }, 1000);
  }

  // Start fading for one element at a time
  elementsToFade.forEach((element, index) => {
    setTimeout(() => {
      const randomTrigger = triggers[Math.floor(Math.random() * triggers.length)];
      fadeElement(element, randomTrigger);
    }, index * 1500); // Stagger the start time for each element
  });

  console.log("Triggered:", triggers);
}

setInterval(() => {
  triggerTriggers();
}, 3000);