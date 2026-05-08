const GITHUB_USER = "ahadiwasti";
const GITHUB_REPO = "ahadiwasti.github.io";
const POSTS_PATH = "blog/posts";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${POSTS_PATH}`;

async function fetchCategories() {
  const res = await fetch(GITHUB_API);
  const items = await res.json();
  return items.filter(item => item.type === "dir");
}

async function fetchPostsInCategory(categoryPath) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${categoryPath}`);
  const items = await res.json();
  return items.filter(item => item.name.endsWith(".md"));
}

async function buildPostList() {
  const categories = await fetchCategories();

  // Build filter buttons dynamically
  const filters = document.querySelector(".filters");
  filters.innerHTML = `<button class="filter active" data-tag="all">All</button>`;
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "filter";
    btn.dataset.tag = cat.name;
    btn.textContent = cat.name.replace(/-/g, " ");
    filters.appendChild(btn);
  });

  // Fetch all posts from all categories
  const allPosts = [];
  for (const cat of categories) {
    const files = await fetchPostsInCategory(cat.path);
    for (const file of files) {
      // Parse date and title from filename e.g. 2026-05-08-two-sum.md
      const nameParts = file.name.replace(".md", "").split("-");
      const date = nameParts.slice(0, 3).join("-");
      const title = nameParts.slice(3).join(" ");
      allPosts.push({
        title: title.charAt(0).toUpperCase() + title.slice(1),
        file: file.path,
        date,
        category: cat.name,
        download_url: file.download_url
      });
    }
  }

  // Sort by date descending
  allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Store globally for filtering
  window.allPosts = allPosts;
  renderPosts("all");

  // Wire up filter buttons
  document.querySelectorAll(".filter").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderPosts(btn.dataset.tag);
    });
  });
}

function renderPosts(filter) {
  const container = document.getElementById("posts-list");
  container.innerHTML = "";

  const filtered = filter === "all"
    ? window.allPosts
    : window.allPosts.filter(p => p.category === filter);

  if (filtered.length === 0) {
    container.innerHTML = "<p class='empty'>No posts yet in this category.</p>";
    return;
  }

  filtered.forEach(post => {
    const div = document.createElement("div");
    div.className = "post-card";
    div.innerHTML = `
      <div class="post-meta">
        <span class="tag">${post.category.replace(/-/g, " ")}</span>
        <span class="date">${post.date}</span>
      </div>
      <h3><a href="post.html?url=${encodeURIComponent(post.download_url)}">${post.title}</a></h3>
    `;
    container.appendChild(div);
  });
}

// Loading state
document.getElementById("posts-list").innerHTML = "<p class='empty'>Loading posts...</p>";
buildPostList().catch(err => {
  console.error(err);
  document.getElementById("posts-list").innerHTML = "<p class='empty'>Could not load posts.</p>";
});