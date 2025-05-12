document.getElementById('scrapeButton').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  console.log('tab', tab);

  try {
    // First execute script to expand "See More" buttons
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        const seeMoreButtons = document.querySelectorAll(
          'div[role="button"]:not([aria-expanded="true"])'
        );
        seeMoreButtons.forEach((button) => {
          if (
            button.textContent.includes('See More') ||
            button.textContent.includes('See more')
          ) {
            button.click();
          }
        });
      }
    });

    // Wait for content to expand
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Then scrape the content
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: scrapePost
    });

    console.log('result', result);

    const scrapedData = result[0].result;
    if (scrapedData && scrapedData.posts.length > 0) {
      const formattedPosts = scrapedData.posts
        .map(
          (post, index) =>
            `Post ${index + 1}:\nContent: ${post.content}\nLink: ${
              post.link
            }\n\n`
        )
        .join('-------------------\n');
      document.getElementById('result').textContent = formattedPosts;
    } else {
      document.getElementById('result').textContent =
        'No posts found on this page.';
    }

    // document.getElementById('result').textContent = scrapedData.html;
  } catch (error) {
    document.getElementById('result').textContent = 'Error: ' + error.message;
  }
});

async function scrapePost() {
  const wholePage = document.documentElement.outerHTML;
  const posts = [];

  // Find all post containers
  const postContainers = document.querySelectorAll(
    '[data-ad-rendering-role="story_message"]'
  );

  // Function to expand "See More" buttons
  function expandSeeMore() {
    const seeMoreButtons = document.querySelectorAll(
      'div[role="button"]:not([aria-expanded="true"])'
    );
    seeMoreButtons.forEach((button) => {
      if (
        button.textContent.includes('See More') ||
        button.textContent.includes('See more')
      ) {
        button.click();
      }
    });
  }

  // Click all "See More" buttons first
  expandSeeMore();

  // Wait for content to expand
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Now process the posts after the timeout
  postContainers.forEach((postContainer) => {
    let postText = '';
    let postLink = '';

    if (postContainer) {
      postText = postContainer.innerText.trim();

      // Find all <a> tags that look like permalinks
      const anchors = document.documentElement.querySelectorAll('a[href]');
      for (const a of anchors) {
        const href = a.getAttribute('href');
        if (
          (href.includes('/posts/') || href.includes('/permalink/')) &&
          !href.includes('/comment_id=') &&
          !href.includes('/user/')
        ) {
          postLink = a.href.startsWith('http')
            ? a.href
            : 'https://www.facebook.com' + a.getAttribute('href');
          break;
        }
      }
    }

    if (postText) {
      posts.push({
        content: postText,
        link: postLink
      });
    }
  });

  return {
    html: wholePage,
    posts: posts
  };
}
