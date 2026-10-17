// Opens when the toolbar button is clicked. The popup is a focused extension
// page, so it can write to the clipboard reliably.
const status = document.getElementById("status");
const output = document.getElementById("output");

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  let text;
  try {
    text = await chrome.tabs.sendMessage(tab.id, { type: "getOpenMessage" });
  } catch {
    // No content script answered: not a Gmail tab, or the tab was opened
    // before the extension was (re)loaded.
    status.textContent = "Gmail のタブで使ってください（拡張を読み込み直したら、タブも再読み込み）。";
    return;
  }
  if (!text) {
    status.textContent = "開いているメールが見つかりません。";
    return;
  }

  output.value = text;
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = "コピーしました。";
  } catch (e) {
    status.textContent = `コピーに失敗しました（${e.message}）。下の欄から手でコピーしてください。`;
  }
}

main();
