window.addEventListener(
  "error",
  function (e) {
    if (e.target.tagName && e.target.tagName.toLowerCase() === "img") {
      e.target.style.display = "none";
    }
  },
  true,
);
