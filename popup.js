// Opens when the toolbar button is clicked. The popup is a focused extension
// page, so it can write to the clipboard, unlike the content script.
const status = document.getElementById("status");
const output = document.getElementById("output");

function format(info) {
  return [
    `件名: ${info.subject}`,
    `差出人: ${info.from ?? "(取得できず)"}`,
    `Gmail API message id: ${info.messageId}`,
    `permmsgid: ${info.messagePermId}`,
    `Gmail API thread id: ${info.threadId}`,
    `thread: ${info.threadPermId}`,
  ].join("\n");
}

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  let info;
  try {
    info = await chrome.tabs.sendMessage(tab.id, { type: "getOpenMessage" });
  } catch {
    // No content script answered: not a Gmail tab, or the tab was opened
    // before the extension was (re)loaded.
    status.textContent = "Gmail のタブで使ってください（拡張を読み込み直したら、タブも再読み込み）。";
    return;
  }
  if (!info) {
    status.textContent = "開いているメールが見つかりません。";
    return;
  }

  const text = format(info);
  output.value = text;
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = "コピーしました。";
  } catch (e) {
    status.textContent = `コピーに失敗しました（${e.message}）。下の欄から手でコピーしてください。`;
  }
}

main();
