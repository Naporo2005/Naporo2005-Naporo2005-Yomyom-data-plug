/*
  Apex Data Plug — Chat Assistant Widget
  ---------------------------------------
  Drop-in, self-contained chat widget. Add this ONE script tag near the
  end of your <body> (index.html, checkout.html, etc.):

    <script src="apex-chat-widget.js"></script>

  No build step, no dependencies. It injects its own CSS + a floating
  chat bubble, and talks directly to your Supabase project using the
  public anon key (safe to expose — it only has permission to run the
  read-only dataplug_lookup_orders() function, nothing else).

  WHAT IT DOES
  ------------
  Follows this exact script:
   1. Greets with the main menu (Data prices / order status via
      beneficiary number).
   2. If the customer types a Ghana phone number, it looks up their
      last 5 orders for that number and lists them.
   3. Customer picks an order by number (1-5) or by typing the Order ID.
   4. Bot reports the delivery status with a helpful tip, then returns
      to the main menu.
*/

(function () {
  "use strict";

  // ---- Config -------------------------------------------------------
  const SUPABASE_URL = "https://euezcqqaucxqopfiqdhb.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1ZXpjcXFhdWN4cW9wZmlxZGhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNTQ4MzMsImV4cCI6MjEwMDkzMDgzM30.DGVr2BI3tqLb_4oYyOCnDNUH0eKDnsYbHUlq0Ds79HE";
  const SUPPORT_WHATSAPP = "233595172004"; // update if this changes

  const MENU_TEXT =
    "I can help you with data orders. To check an order, share the beneficiary phone number. Or reply 1 to see today's data prices.";

  const GH_PHONE_RE = /\b0\d{9}\b/;

  // ---- State ----------------------------------------------------------
  let state = "menu"; // 'menu' | 'awaiting_selection' | 'post_result'
  let lastOrders = [];

  // ---- Styles ---------------------------------------------------------
  const css = `
  .adp-chat-btn{position:fixed;bottom:20px;right:20px;height:52px;padding:0 18px 0 14px;
    border-radius:999px;background:#FFC72C;border:none;box-shadow:0 4px 14px rgba(0,0,0,.25);
    cursor:pointer;z-index:99998;display:flex;align-items:center;gap:8px;justify-content:center;
    transition:transform .15s ease;font-family:'Space Grotesk',system-ui,sans-serif;
    font-weight:700;font-size:14px;color:#111;}
  .adp-chat-btn:hover{transform:scale(1.05);}
  .adp-chat-btn svg{width:22px;height:22px;fill:#111;flex-shrink:0;}
  .adp-chat-panel{position:fixed;bottom:90px;right:20px;width:340px;max-width:92vw;
    height:460px;max-height:75vh;background:#fff;border-radius:14px;
    box-shadow:0 10px 40px rgba(0,0,0,.25);display:none;flex-direction:column;
    overflow:hidden;z-index:99999;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}
  .adp-chat-panel.open{display:flex;}
  .adp-chat-header{background:#111;color:#FFC72C;padding:14px 16px;font-weight:700;
    font-size:15px;display:flex;align-items:center;justify-content:space-between;}
  .adp-chat-header span.sub{display:block;color:#ddd;font-weight:400;font-size:11px;margin-top:2px;}
  .adp-chat-close{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;}
  .adp-chat-body{flex:1;overflow-y:auto;padding:12px;background:#f7f7f8;}
  .adp-msg{max-width:85%;padding:9px 12px;border-radius:12px;margin-bottom:8px;font-size:13.5px;
    line-height:1.4;white-space:pre-wrap;word-wrap:break-word;}
  .adp-msg.bot{background:#fff;border:1px solid #eee;border-bottom-left-radius:2px;align-self:flex-start;}
  .adp-msg.user{background:#FFC72C;color:#111;border-bottom-right-radius:2px;align-self:flex-end;margin-left:auto;}
  .adp-chat-body{display:flex;flex-direction:column;}
  .adp-quick{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 10px;}
  .adp-quick button{background:#fff;border:1px solid #ddd;border-radius:16px;padding:5px 11px;
    font-size:12px;cursor:pointer;}
  .adp-quick button:hover{background:#FFC72C;border-color:#FFC72C;}
  .adp-chat-input{display:flex;border-top:1px solid #eee;padding:8px;gap:6px;background:#fff;}
  .adp-chat-input input{flex:1;border:1px solid #ddd;border-radius:20px;padding:8px 12px;
    font-size:13.5px;outline:none;}
  .adp-chat-input button{background:#111;color:#FFC72C;border:none;border-radius:50%;
    width:36px;height:36px;cursor:pointer;font-size:15px;}
  `;
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ---- DOM --------------------------------------------------------------
  const btn = document.createElement("button");
  btn.className = "adp-chat-btn";
  btn.setAttribute("aria-label", "Chat with Apex Data Plug");
  btn.innerHTML =
    '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg><span>Chat with us</span>';

  const panel = document.createElement("div");
  panel.className = "adp-chat-panel";
  panel.innerHTML = `
    <div class="adp-chat-header">
      <div>Apex Data Plug<span class="sub">We typically reply instantly</span></div>
      <button class="adp-chat-close" aria-label="Close chat">&times;</button>
    </div>
    <div class="adp-chat-body"></div>
    <div class="adp-chat-input">
      <input type="text" placeholder="Type your message..." />
      <button class="adp-send">&#10148;</button>
    </div>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  const bodyEl = panel.querySelector(".adp-chat-body");
  const inputEl = panel.querySelector("input");
  const sendBtn = panel.querySelector(".adp-send");
  const closeBtn = panel.querySelector(".adp-chat-close");

  let opened = false;
  btn.addEventListener("click", () => {
    panel.classList.toggle("open");
    if (!opened) {
      opened = true;
      addBotMessage(MENU_TEXT, ["1"]);
    }
  });
  closeBtn.addEventListener("click", () => panel.classList.remove("open"));

  function scrollDown() {
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function addMessage(text, who) {
    const div = document.createElement("div");
    div.className = "adp-msg " + who;
    div.textContent = text;
    bodyEl.appendChild(div);
    scrollDown();
  }

  function addQuickReplies(options) {
    if (!options || !options.length) return;
    const wrap = document.createElement("div");
    wrap.className = "adp-quick";
    options.forEach((opt) => {
      const b = document.createElement("button");
      b.textContent = opt;
      b.addEventListener("click", () => {
        wrap.remove();
        submit(opt);
      });
      wrap.appendChild(b);
    });
    bodyEl.appendChild(wrap);
    scrollDown();
  }

  function addBotMessage(text, quickReplies) {
    addMessage(text, "bot");
    if (quickReplies) addQuickReplies(quickReplies);
  }

  // ---- Supabase RPC call --------------------------------------------
  async function lookupOrders(beneficiary) {
    const res = await fetch(
      SUPABASE_URL + "/rest/v1/rpc/dataplug_lookup_orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: "Bearer " + SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ p_beneficiary: beneficiary }),
      }
    );
    if (!res.ok) throw new Error("Lookup failed");
    return res.json();
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function statusReply(order) {
    const s = (order.delivery_status || order.status || "").toLowerCase();
    if (s === "delivered" || s === "success" || s === "completed") {
      return (
        "I've checked the status. Order delivered. Dial *124# or use my " +
        (order.network || "MTN") +
        " app to check your data balance."
      );
    }
    if (s === "processing" || s === "pending" || s === "not_started") {
      return "Your order is still processing — it usually completes within a few minutes. Please check back shortly.";
    }
    if (s === "failed" || s === "error") {
      return (
        "This order shows as failed. Please reach out to us on WhatsApp (+" +
        SUPPORT_WHATSAPP +
        ") and we'll sort it out for you."
      );
    }
    return "Current status: " + (order.delivery_status || order.status || "unknown") + ".";
  }

  // ---- Conversation logic --------------------------------------------
  async function submit(rawText) {
    const text = rawText.trim();
    if (!text) return;
    addMessage(text, "user");

    // Order status flow: user provided a phone number
    const phoneMatch = text.match(GH_PHONE_RE);
    if (phoneMatch && state !== "awaiting_selection") {
      const beneficiary = phoneMatch[0];
      addBotMessage("Thank you for providing the Beneficiary Number. Looking that up...");
      try {
        const orders = await lookupOrders(beneficiary);
        if (!orders || orders.length === 0) {
          addBotMessage(
            "I couldn't find any orders for " +
              beneficiary +
              ". Please double-check the number, or reach us on WhatsApp (+" +
              SUPPORT_WHATSAPP +
              ")."
          );
          state = "menu";
          return;
        }
        lastOrders = orders;
        let msg =
          "Thank you for providing the Beneficiary Number. I found " +
          orders.length +
          " order(s) for that number:\n\n";
        orders.forEach((o, i) => {
          msg +=
            (i + 1) +
            ". Order ID: " +
            o.order_ref +
            " | Product: data | Beneficiary: " +
            beneficiary +
            " | Variation: " +
            o.network +
            " - " +
            o.bundle_label +
            " | Date: " +
            formatDate(o.created_at) +
            "\n\n";
        });
        msg +=
          "Kindly let me know which order you're having an issue with. You can either:\nEnter the Order ID (for example: " +
          orders[0].order_ref +
          "), or\nReply with the option number from the list above (1" +
          (orders.length > 1 ? "-" + orders.length : "") +
          ").";
        addBotMessage(msg);
        state = "awaiting_selection";
      } catch (e) {
        addBotMessage(
          "Sorry, I couldn't reach our order system just now. Please try again in a moment."
        );
        state = "menu";
      }
      return;
    }

    // Order selection flow
    if (state === "awaiting_selection") {
      let picked = null;
      const asNum = parseInt(text, 10);
      if (!isNaN(asNum) && asNum >= 1 && asNum <= lastOrders.length) {
        picked = lastOrders[asNum - 1];
      } else {
        picked = lastOrders.find(
          (o) => o.order_ref.toLowerCase() === text.toLowerCase()
        );
      }
      if (!picked) {
        addBotMessage(
          "I didn't catch that. Please reply with the option number (1-" +
            lastOrders.length +
            ") or the exact Order ID from the list above."
        );
        return;
      }
      addBotMessage(statusReply(picked));
      state = "post_result";
      return;
    }

    // Main menu options
    const lower = text.toLowerCase();
    if (state === "post_result") {
      state = "menu";
      addBotMessage(MENU_TEXT, ["1"]);
      return;
    }

    if (text === "1" || lower.includes("data")) {
      addBotMessage(
        "You can see today's MTN data bundle prices in the pricing section on this page — just tap a bundle to order. Want me to check on an order instead? Just share the beneficiary number."
      );
      return;
    }

    addBotMessage(MENU_TEXT, ["1"]);
  }

  sendBtn.addEventListener("click", () => {
    const v = inputEl.value;
    inputEl.value = "";
    submit(v);
  });
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const v = inputEl.value;
      inputEl.value = "";
      submit(v);
    }
  });
})();
