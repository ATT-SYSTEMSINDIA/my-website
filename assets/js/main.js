// Tenders Hub CRM lead webhook (see Leads/LeadEndpoints.cs, POST /api/leads/webhook/website-form).
const CRM_WEBHOOK_URL = "https://tenders.attsystemsgroup.in/api/leads/webhook/website-form";
const CRM_WEBHOOK_SECRET = "0fd204fe6d881abfc27932e4cdbda0fc6906a1b87f279d65";

// "Ask Us" chat widget (see Ai/PublicAskEndpoints.cs, POST /api/public/ask).
const ASK_URL = "https://tenders.attsystemsgroup.in/api/public/ask";

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

      // Best-effort, fire-and-forget: the CRM webhook never blocks or affects the FormSubmit
      // flow above (which is what actually drives the success/error message the visitor sees),
      // so a misconfigured or unreachable CRM can't break the contact form.
      if (CRM_WEBHOOK_URL) {
        const crmMessage = [
          data.company ? "Company: " + data.company : "",
          data.enquiryType ? "Enquiry type: " + data.enquiryType : "",
          data.message || ""
        ].filter(Boolean).join("\n");
        fetch(CRM_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Webhook-Secret": CRM_WEBHOOK_SECRET },
          body: JSON.stringify({ name: data.name, email: data.email, phone: data.phone, message: crmMessage, honey: data._honey })
        }).catch(function (err) {
          console.warn("CRM webhook failed (enquiry still sent via email):", err);
        });
      }

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

// "Ask Us" - a small AI chat widget answering general questions about ATT Systems, grounded only
// in public company info (see PublicAskEndpoints.CompanyContext on the server - never any CRM or
// tender data). Injected here, not in every HTML file, so it appears on every page from one place.
(function () {
  if (!ASK_URL) return;

  const root = document.createElement("div");
  root.className = "ask-us";
  root.innerHTML =
    '<button type="button" class="ask-us-toggle" aria-expanded="false" aria-controls="askUsPanel">' +
      '<span class="ask-us-toggle-icon" aria-hidden="true">&#128172;</span><span>Ask Us</span>' +
    '</button>' +
    '<div class="ask-us-panel" id="askUsPanel" hidden>' +
      '<div class="ask-us-head"><span>Ask Us</span>' +
        '<button type="button" class="ask-us-close" aria-label="Close">&times;</button></div>' +
      '<div class="ask-us-messages"></div>' +
      '<form class="ask-us-form">' +
        '<input type="text" class="ask-us-input" placeholder="Ask about our solutions..." maxlength="500" required>' +
        '<button type="submit" class="ask-us-send">Send</button>' +
      '</form>' +
    '</div>';
  document.body.appendChild(root);

  const toggle = root.querySelector(".ask-us-toggle");
  const panel = root.querySelector(".ask-us-panel");
  const messages = root.querySelector(".ask-us-messages");
  const form = root.querySelector(".ask-us-form");
  const input = root.querySelector(".ask-us-input");

  function addMessage(role, text) {
    const el = document.createElement("div");
    el.className = "ask-us-msg ask-us-msg-" + role;
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      input.focus();
      if (!messages.children.length)
        addMessage("assistant", "Hi! Ask me anything about ATT Systems' solutions and I'll do my best to help.");
    }
  }
  toggle.addEventListener("click", function () { setOpen(panel.hidden); });
  root.querySelector(".ask-us-close").addEventListener("click", function () { setOpen(false); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    addMessage("user", question);
    input.value = "";
    input.disabled = true;
    const pending = addMessage("assistant", "Thinking...");

    fetch(ASK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question })
    })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error((body && body.detail) || "Something went wrong.");
          return body;
        });
      })
      .then(function (body) { pending.textContent = body.answer; })
      .catch(function () {
        pending.textContent = "Sorry, I couldn't get an answer just now - please try again, or use the Contact page.";
      })
      .finally(function () {
        input.disabled = false;
        input.focus();
      });
  });
})();
