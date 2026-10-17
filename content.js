// Runs inside the Gmail page (mail.google.com), in an isolated world:
// it shares the DOM with Gmail but not Gmail's JavaScript variables.
console.log("[gmail-message-link] content script loaded:", location.href);

// Attribute names confirmed in DevTools on 2026-10-17:
//   open thread:  h2[data-thread-perm-id="thread-f:<decimal>"][data-legacy-thread-id="<hex>"]
//   open message: div[data-message-id="#msg-f:<decimal>"][data-legacy-message-id="<hex>"]
// Messages you sent carry "#msg-a:r<decimal>" instead (seen 2026-10-17); that
// number does not match the hex id, but the Gmail connector accepts both.

// Gmail keeps hidden views (e.g. the inbox list) in the DOM,
// so only elements that are actually shown count.
function isShown(el) {
  return el.checkVisibility();
}

// Not yet confirmed in DevTools for every view: the sender is assumed to be a span with an email attribute.
function readSender(root) {
  const sender = root.querySelector("span[email]");
  return sender ? `${sender.getAttribute("name")} <${sender.getAttribute("email")}>` : null;
}

function fromMessage(message) {
  const heading = [...document.querySelectorAll("h2[data-thread-perm-id]")].find(isShown);
  return {
    subject: heading?.textContent.trim() ?? null,
    from: readSender(message),
    messageId: message.dataset.legacyMessageId,
    messagePermId: message.dataset.messageId.replace(/^#/, ""),
    threadId: heading?.dataset.legacyThreadId ?? null,
    threadPermId: heading?.dataset.threadPermId ?? null,
  };
}

// With an open thread, take the last shown message (usually the newest).
function readOpenMessage() {
  const message = [...document.querySelectorAll("div[data-message-id]")].filter(isShown).at(-1);
  return message ? fromMessage(message) : null;
}

// The message under the mouse when the context menu was opened.
// List rows are not handled: Gmail shows its own menu there, so ours never appears (2026-10-17).
function readClickedMessage(target) {
  const message = target?.closest("div[data-message-id]");
  return message ? fromMessage(message) : readOpenMessage();
}

function format(info) {
  return [
    `件名: ${info.subject ?? "(取得できず)"}`,
    `差出人: ${info.from ?? "(取得できず)"}`,
    `Gmail API message id: ${info.messageId}`,
    `permmsgid: ${info.messagePermId}`,
    `Gmail API thread id: ${info.threadId ?? "(取得できず)"}`,
    `thread: ${info.threadPermId ?? "(取得できず)"}`,
  ].join("\n");
}

// A short notice at the bottom of the page, since the context menu has no popup.
function showToast(text) {
  const toast = document.createElement("div");
  toast.textContent = text;
  Object.assign(toast.style, {
    position: "fixed",
    left: "50%",
    bottom: "24px",
    transform: "translateX(-50%)",
    zIndex: "2147483647",
    padding: "8px 16px",
    borderRadius: "4px",
    background: "#323232",
    color: "#fff",
    font: "14px sans-serif",
  });
  document.body.append(toast);
  setTimeout(() => toast.remove(), 2500);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback when the async API is refused (e.g. the page is not focused).
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    if (!ok) throw new Error("copy command failed");
  }
}

// Remember what was right-clicked; the menu click arrives later from background.js.
let lastRightClicked = null;
document.addEventListener("contextmenu", (event) => {
  lastRightClicked = event.target;
}, true);

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === "getOpenMessage") {
    // Asked by the popup, which does the copying itself.
    const info = readOpenMessage();
    sendResponse(info ? format(info) : null);
  } else if (request.type === "copyClickedMessage") {
    const info = readClickedMessage(lastRightClicked);
    if (!info) {
      showToast("メールが見つかりません。");
      return;
    }
    copyToClipboard(format(info))
      .then(() => showToast("ID をコピーしました。"))
      .catch((e) => showToast(`コピーに失敗しました（${e.message}）。`));
  }
});
