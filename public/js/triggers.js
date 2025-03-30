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
  triggerTriggers(triggers); // Call the function to trigger the flash
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

let activeTimers = []; // Array to store active timer IDs

function triggerTriggers(triggers) {
  if (triggers.length === 0) {
    console.error("No valid triggers found");
    return;
  }

  const triggerElements = [
    document.getElementById("eyeCursorText"),
    document.getElementById("eyeCursorText2"),
    document.getElementById("eyeCursorText3"),
    document.getElementById("eyeCursorText4"),
  ];

  let duration = Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000;

  // Randomly select a trigger from the list
  const randomTrigger = triggers[Math.floor(Math.random() * triggers.length)];

  // Select one of the triggerElements (cycling through them)
  const elementIndex = Math.floor(Math.random() * triggerElements.length);
  const selectedElement = triggerElements[elementIndex];

  if (selectedElement) {
    // Flash the trigger in the selected element
    flashTrigger(randomTrigger, duration, selectedElement);
  }

  // Set a timeout to trigger the next flash
  const timerId = setTimeout(() => triggerTriggers(triggers), duration);
  activeTimers.push(timerId); // Store the timer ID

  console.log("Triggered:", randomTrigger, "in element:", selectedElement.id);
}

function flashTrigger(trigger, duration, container) {
  if (!container) return;

  // Clear the container and set the trigger text
  setTimeout(() => {
    container.innerHTML = "";
    const span = document.createElement("span");
    span.textContent = trigger;
    container.appendChild(span);

    // Fade out after the specified duration
    setTimeout(() => {
      requestAnimationFrame(() => {
        container.innerHTML = "";
      });
    }, duration);
  });
}





