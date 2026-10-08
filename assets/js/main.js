// Mobile nav toggle
(function () {
  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("siteNav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      const isOpen = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Enquiry form — static site, so submissions are emailed via FormSubmit
  const form = document.getElementById("enquiryForm");
  if (form) {
    const success = document.getElementById("formSuccess");
    const error = document.getElementById("formError");
    const button = form.querySelector('button[type="submit"]');
    const buttonText = button ? button.textContent : "";

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const data = Object.fromEntries(new FormData(form).entries());
      data._subject = form.dataset.subject || "Website enquiry";
      data._template = "table";
      if (data.email) data._replyto = data.email;

      if (success) success.classList.remove("show");
      if (error) error.classList.remove("show");
      if (button) {
        button.disabled = true;
        button.textContent = "Sending...";
      }

      fetch("https://formsubmit.co/ajax/attin.helpdesk@attsystemsgroup.com", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data)
      })
        .then(function (res) {
          return res.json().then(function (body) {
            if (!res.ok || String(body.success) !== "true") throw new Error(body.message || "Send failed");
          });
        })
        .then(function () {
          if (success) success.classList.add("show");
          form.reset();
        })
        .catch(function () {
          if (error) error.classList.add("show");
        })
        .finally(function () {
          if (button) {
            button.disabled = false;
            button.textContent = buttonText;
          }
        });
    });
  }
})();
