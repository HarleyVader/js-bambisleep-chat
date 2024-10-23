function autoExpand(element) {
  element.style.height = "inherit";
  const computed = window.getComputedStyle(element);
  const height =
    parseInt(computed.getPropertyValue("border-top-width"), 5) +
    parseInt(computed.getPropertyValue("border-bottom-width"), 5) +
    element.scrollHeight;
  element.style.height = height + "px";
}

textarea.addEventListener("keypress", function (event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submit.click();
  }
});

function unhideUpdateElement() {
  const updateElement = document.getElementById("update-element");
  if (updateElement.hasAttribute("hidden")) {
    updateElement.removeAttribute("hidden");
  } else {
    updateElement.setAttribute("hidden", "true");
  }
}
/*
function toggleAnimation(selector, class1, class2) {
  const element = document.querySelector(selector);
  if (element.classList.contains(class1)) {
      element.classList.remove(class1);
      element.classList.add(class2);
  } else {
      element.classList.remove(class2);
      element.classList.add(class1);
  }
}
*/
function applyUppercaseStyle() {
  const responseParagraphs = document.querySelectorAll('#response p');
  responseParagraphs.forEach(paragraph => {
      const text = paragraph.textContent;
      const styledText = text.replace(/([A-Z])/g, '<span class="uppercase-char">$1</span>');
      paragraph.innerHTML = styledText;
  });
}



