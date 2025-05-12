document.getElementById('scrapeButton').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    // Scrape the content
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: scrapePost
    });

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
  } catch (error) {
    document.getElementById('result').textContent = 'Error: ' + error.message;
  }
});

async function scrapePost() {
  const wholePage = document.documentElement.outerHTML;
  const posts = [];
  const processedPosts = new Set();

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

  // Function to process posts
  function processPosts() {
    const postContainers = document.querySelectorAll(
      '[data-ad-rendering-role="story_message"]'
    );

    postContainers.forEach((postContainer) => {
      let postText = '';
      let postLink = '';

      if (postContainer) {
        postText = postContainer.innerText.trim();

        // Try to find the permalink inside the article
        const article = postContainer.closest('[role="article"]');
        let foundLink = false;
        if (article) {
          const anchors = article.querySelectorAll('a[href]');
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
              foundLink = true;
              break;
            }
          }
        }
        // Fallback: search the whole document if not found in article
        if (!foundLink) {
          const anchors = document.querySelectorAll('a[href]');
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
      }

      if (postText) {
        const postId = postText.substring(0, 100) + postLink;
        if (!processedPosts.has(postId)) {
          processedPosts.add(postId);
          posts.push({
            content: postText,
            link: postLink
          });
        }
      }
    });
  }

  // Function to scroll and wait
  async function scrollAndWait() {
    // First process the initial posts at the top
    expandSeeMore();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    processPosts();

    // Now start scrolling
    let lastHeight = document.body.scrollHeight;
    let scrollCount = 0;
    const maxScrolls = 20;
    let patience = 0;
    const maxPatience = 3;

    while (scrollCount < maxScrolls) {
      window.scrollBy(0, 800);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expandSeeMore();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      processPosts();

      let newHeight = document.body.scrollHeight;
      if (newHeight === lastHeight) {
        patience++;
        if (patience >= maxPatience) {
          break;
        }
      } else {
        patience = 0;
      }
      lastHeight = newHeight;
      scrollCount++;
    }
  }

  // Start the scraping process
  await scrollAndWait();

  return {
    html: wholePage,
    posts: posts
  };
}
