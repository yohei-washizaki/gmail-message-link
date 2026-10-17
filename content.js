// Runs inside the Gmail page (mail.google.com), in an isolated world:
// it shares the DOM with Gmail but not Gmail's JavaScript variables.
console.log("[gmail-message-link] content script loaded:", location.href);

// Gmail keeps hidden views (e.g. the inbox list) in the DOM,
// so only elements that are actually shown count.
function isShown(el) {
  return el.checkVisibility();
}

// Attribute names confirmed in DevTools on 2026-10-17:
//   h2[data-thread-perm-id="thread-f:<decimal>"][data-legacy-thread-id="<hex>"]
//   div[data-message-id="#msg-f:<decimal>"][data-legacy-message-id="<hex>"]
function readOpenMessage() {
  const heading = [...document.querySelectorAll("h2[data-thread-perm-id]")].find(isShown);
  if (!heading) return null;

  // A thread can show several messages; take the last one (usually the newest).
  const message = [...document.querySelectorAll("div[data-message-id]")].filter(isShown).at(-1);
  if (!message) return null;

  // Not yet confirmed in DevTools: the sender is assumed to be a span with an email attribute.
  const sender = message.querySelector("span[email]");

  return {
    subject: heading.textContent.trim(),
    from: sender ? `${sender.getAttribute("name")} <${sender.getAttribute("email")}>` : null,
    messageId: message.dataset.legacyMessageId,
    messagePermId: message.dataset.messageId.replace(/^#/, ""),
    threadId: heading.dataset.legacyThreadId,
    threadPermId: heading.dataset.threadPermId,
  };
}

// The popup asks for the open message; reply with what the DOM shows.
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === "getOpenMessage") {
    sendResponse(readOpenMessage());
  }
});
