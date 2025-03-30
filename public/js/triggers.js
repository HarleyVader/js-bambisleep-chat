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

let activeTimers = []; // Array to store active timer IDs

function triggerTriggers() {
  // Clear any existing timers
  activeTimers.forEach((timerId) => clearTimeout(timerId));
  activeTimers = []; // Reset the timers array

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
  if (triggers.length === 0) {
    console.error("No valid triggers found");
    return;
  }

  // Elements to fade in and out
  const triggerElements = [
    document.getElementById("eyeCursorText"),
    document.getElementById("eyeCursorText2"),
    document.getElementById("eyeCursorText3"),
    document.getElementById("eyeCursorText4"),
  ];

  // Display each trigger in the corresponding element with fade-in and fade-out
  triggers.forEach((trigger, index) => {
    const element = triggerElements[index % triggerElements.length]; // Cycle through elements
    if (element) {
      const timerId = setTimeout(() => {
        element.textContent = trigger; // Set the trigger text
        element.style.opacity = 0;
        element.style.transition = "opacity 1s ease-out";
        element.style.display = "block";

        // Fade in
        requestAnimationFrame(() => {
          element.style.opacity = 1;
        });

        // Fade out after 2 seconds
        const fadeOutTimerId = setTimeout(() => {
          element.style.opacity = 0;
          setTimeout(() => {
            element.style.display = "none"; // Hide the element after fade-out
            element.textContent = ""; // Clear the text
          }, 1000); // Wait for fade-out to complete
        }, 2000);

        // Store the fade-out timer ID
        activeTimers.push(fadeOutTimerId);
      }, index * 3000); // Stagger each trigger by 3 seconds

      // Store the timer ID
      activeTimers.push(timerId);
    }
  });

  console.log("Triggered:", triggers);
}

// Randomize interval between 3 to 7 seconds for triggering
function getRandomInterval() {
  return Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000; // Random value between 3000ms and 7000ms
}

setInterval(() => {
  triggerTriggers();
}, getRandomInterval());