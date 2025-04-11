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

const textElements = [
  document.getElementById("eyeCursorText"),
  document.getElementById("eyeCursorText2"),
  document.getElementById("eyeCursorText3"),
  document.getElementById("eyeCursorText4")
].filter(element => element !== null);

function createToggleButtons() {
  const container = document.getElementById("trigger-toggles");
  if (!container) {
    console.error("Container with id 'trigger-toggles' not found.");
    return;
  }

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
  // Use BambiSocket instead of directly accessing socket
  if (typeof window.BambiSocket === "undefined" || !window.BambiSocket.getSocket().connected) {
    console.error("Socket is not initialized or connected.");
    return;
  }

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

  window.BambiSocket.sendMessage("triggers", triggers);
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

async function triggerTriggers(triggers) {
  if (!Array.isArray(triggers) || triggers.length === 0) {
    console.error("No triggers to display.");
    return;
  }

  while (true) {
    for (const trigger of triggers) {
      for (const element of textElements) {
        if (!element) continue;

        // Set the text content to the current trigger
        element.textContent = trigger;

        // Randomly determine the animation duration (2-4 seconds)
        const duration = Math.random() * 2 + 2; // 2 to 4 seconds
        element.style.transition = `opacity ${duration}s`;
        element.style.opacity = 1; // Fade in

        // Wait for the animation to finish
        await new Promise((resolve) => setTimeout(resolve, duration * 1000));

        // Fade out the element
        element.style.opacity = 0;

        // Wait for the fade-out animation to finish
        await new Promise((resolve) => setTimeout(resolve, duration * 1000));
      }
    }
  }
}

