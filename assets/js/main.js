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

  const transcript = []; // this session's Q&A, sent along with the lead so the team has context

  // Tap-to-ask chips so a visitor rarely has to type at all. The point of this widget is sales
  // enquiries, not just answering trivia, so most chips skip the AI entirely and go straight to
  // the lead card, pre-tagged with the same enquiry types the contact form already tracks
  // (enquiryType is carried in the lead's message, not a separate field, to reuse one webhook).
  // One "learn more" chip is kept for a visitor who isn't ready to leave details yet.
  const QUICK_QUESTIONS = [
    { label: "Request a quotation", enquiryType: "Request for Quotation" },
    { label: "Request a brochure", enquiryType: "Request for Brochure" },
    { label: "Have a sales person call me", enquiryType: "Sales person to call" },
    { label: "Book a discussion", enquiryType: "Meet for discussion" },
    { label: "What solutions do you offer?" }
  ];

  function addMessage(role, text) {
    const el = document.createElement("div");
    el.className = "ask-us-msg ask-us-msg-" + role;
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  function addQuickReplies() {
    const row = document.createElement("div");
    row.className = "ask-us-chips";
    QUICK_QUESTIONS.forEach(function (q) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "ask-us-chip";
      chip.textContent = q.label;
      chip.addEventListener("click", function () {
        if (q.enquiryType) { messages.innerHTML = ""; showLeadCard(q.enquiryType); return; }
        ask(q.label);
      });
      row.appendChild(chip);
    });
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  }

  // The point of this widget is sales enquiries, so this is offered after every answer, not just
  // once - and deliberately NOT the AI's job to drive (small local models are not reliable at
  // reading contact details back out of a conversation); a plain form is.
  function showLeadCard(enquiryType) {
    if (!CRM_WEBHOOK_URL) return;

    // Last question asked (if any) is a reasonable starting point for "what are you interested
    // in" - the visitor can still edit it, but it's required either way: a lead with no stated
    // reason or interest isn't actionable for sales, whichever path (chip or chat) brought them here.
    const lastQuestion = transcript.length ? transcript[transcript.length - 2] : null; // "Q: ..." entry
    const defaultReason = enquiryType ? "" : (lastQuestion ? lastQuestion.replace(/^Q: /, "") : "");

    const intro = enquiryType ? "Great - let's get that sorted. Share your details:" : "Want our team to follow up with you directly?";
    const card = document.createElement("div");
    card.className = "ask-us-lead-card";
    card.innerHTML =
      '<p>' + intro + '</p>' +
      '<input type="text" class="ask-us-lead-name" placeholder="Your name" required>' +
      '<input type="text" class="ask-us-lead-contact" placeholder="Email or phone" required>' +
      '<textarea class="ask-us-lead-reason" placeholder="What are you interested in?" required></textarea>' +
      '<div class="ask-us-lead-actions">' +
        '<button type="button" class="ask-us-lead-skip">No thanks</button>' +
        '<button type="button" class="ask-us-lead-send">Send my details</button>' +
      '</div>';
    messages.appendChild(card);
    card.querySelector(".ask-us-lead-reason").value = defaultReason;
    messages.scrollTop = messages.scrollHeight;

    card.querySelector(".ask-us-lead-skip").addEventListener("click", function () { card.remove(); addQuickReplies(); });
    card.querySelector(".ask-us-lead-send").addEventListener("click", function () {
      const name = card.querySelector(".ask-us-lead-name").value.trim();
      const contact = card.querySelector(".ask-us-lead-contact").value.trim();
      const reason = card.querySelector(".ask-us-lead-reason").value.trim();
      if (!name || !contact || !reason) return;
      const isEmail = contact.indexOf("@") !== -1;

      const sendBtn = card.querySelector(".ask-us-lead-send");
      sendBtn.disabled = true;
      sendBtn.textContent = "Sending...";

      const parts = [];
      if (enquiryType) parts.push("Enquiry type: " + enquiryType);
      parts.push("Interested in: " + reason);
      if (transcript.length) parts.push("Via Ask Us chat:\n" + transcript.join("\n"));

      fetch(CRM_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Webhook-Secret": CRM_WEBHOOK_SECRET },
        body: JSON.stringify({
          name: name,
          email: isEmail ? contact : undefined,
          phone: isEmail ? undefined : contact,
          message: parts.join("\n\n"),
          source: "AskUs"
        })
      })
        .then(function () {
          card.innerHTML = '<p>Thanks, ' + name.split(" ")[0] + ' - our team will be in touch soon.</p>';
        })
        .catch(function () {
          card.innerHTML = '<p>Sorry, that didn\'t go through - please use the Contact page instead.</p>';
        });
    });
  }

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      input.focus();
      if (!messages.children.length) {
        addMessage("assistant", "Hi! Ask me anything about ATT Systems' solutions, or tap a question below.");
        addQuickReplies();
      }
    }
  }
  toggle.addEventListener("click", function () { setOpen(panel.hidden); });
  root.querySelector(".ask-us-close").addEventListener("click", function () { setOpen(false); });

  function ask(question) {
    messages.innerHTML = ""; // show one Q&A at a time rather than a growing, scrolling history
    addMessage("user", question);
    transcript.push("Q: " + question);
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
      .then(function (body) {
        pending.textContent = body.answer;
        transcript.push("A: " + body.answer);
        showLeadCard();
        addQuickReplies();
      })
      .catch(function () {
        pending.textContent = "Sorry, I couldn't get an answer just now - please try again, or use the Contact page.";
      })
      .finally(function () {
        input.disabled = false;
        input.focus();
      });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const question = input.value.trim();
    if (question) ask(question);
  });
})();
