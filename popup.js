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
            `<strong>Post ${index + 1}:</strong>\n<strong>Author:</strong> ${
              post.author
            }\n<strong>Author Link:</strong> ${
              post.authorLink
            }\n<strong>Content:</strong> ${
              post.content
            }\n<strong>Link:</strong> ${post.link}\n\n`
        )
        .join('-------------------\n');
      document.getElementById('result').innerHTML = formattedPosts;
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
    // First find the feed container
    const feedContainers = document.querySelector('div[role="feed"]');
    if (!feedContainers) return;
    // get all direct child divs of feedContainers
    const directChildDivs = feedContainers.querySelectorAll(':scope > div');

    directChildDivs.forEach((feedContainer) => {
      let postText = '';
      let postLink = '';
      let author = '';
      let authorLink = '';

      // Find the story message within this specific post
      const storyMessage = feedContainer.querySelector(
        '[data-ad-rendering-role="story_message"]'
      );

      const authorContainer = feedContainer.querySelector(
        '[data-ad-rendering-role="profile_name"]'
      );

      if (authorContainer) {
        author = authorContainer.querySelector('strong').innerText.trim();
        const authorurl = authorContainer
          .querySelector('a')
          .getAttribute('href');

        const authorLinkMatch = authorurl.match(/\/groups\/(\d+)\/user\/(\d+)/);
        if (authorLinkMatch) {
          const groupId = authorLinkMatch[1];
          const userId = authorLinkMatch[2];
          authorLink = `https://www.facebook.com/groups/${groupId}/user/${userId}`;
        }
      }

      if (storyMessage) {
        postText = storyMessage.innerText.trim();

        // Try to find the permalink inside the article

        const anchors = feedContainer.querySelectorAll('a[href]');
        for (const a of anchors) {
          const href = a.getAttribute('href');
          // Check if it's a post link with the specific structure

          if (
            href.startsWith('https://www.facebook.com/groups/') &&
            !href.includes('comment_id') &&
            href.includes('/posts/')
          ) {
            const postIdMatch = href.match(/\/groups\/(\d+)\/posts\/(\d+)/);
            if (postIdMatch) {
              const groupId = postIdMatch[1];
              const postId = postIdMatch[2];
              postLink = `https://www.facebook.com/groups/${groupId}/posts/${postId}`;
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
            link: postLink,
            author: author,
            authorLink: authorLink
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
    const maxScrolls = 0;
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
