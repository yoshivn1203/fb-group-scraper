// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrape') {
    const postContent = document.querySelector('[data-ad-preview="message"]');
    const postLink = window.location.href;

    if (postContent) {
      sendResponse({
        content: postContent.textContent.trim(),
        link: postLink
      });
    } else {
      sendResponse(null);
    }
  }
  return true;
});
