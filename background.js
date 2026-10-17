// Service worker: owns the right-click menu. It cannot see the page,
// so it asks the content script to read the clicked message and copy it.
const MENU_ID = "copy-message-ids";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "このメールの ID をコピー",
    contexts: ["all"],
    documentUrlPatterns: ["https://mail.google.com/*"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  chrome.tabs.sendMessage(tab.id, { type: "copyClickedMessage" }, { frameId: info.frameId })
    // No content script: the tab was opened before the extension was (re)loaded,
    // or the click was inside a frame we do not inject into.
    .catch((e) => console.warn("[gmail-message-link] could not reach the page:", e.message));
});
