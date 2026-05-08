const GITHUB_USER = "ahadiwasti";
const GITHUB_REPO = "ahadiwasti.github.io";
const POSTS_PATH = "blog/posts";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${POSTS_PATH}`;

async function fetchCategories() {
  const res = await fetch(GITHUB_API);
  const items = await res.json();
  return items.filter(item => item.type === "dir");
}

async function fetchPostsInCategory(cat) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${cat.path}`);
  const items = await res.json();
  return items.filter(item => item.name.endsWith(".md")).map(file => {
    const parts = file.name.replace(".md", "").split("-");
    const date = parts.slice(0, 3).join("-");
    const title = parts.slice(3).join(" ");
    return {
      title: title.charAt(0).toUpperCase() + title.slice(1),
      date,
      category: cat.name,
      download_url: file.download_url
    };
  });
}

async function buildPostList() {
  const categories = await fetchCategories();

  // Build filter tabs
  const filters = document.querySelector(".filters");
  filters.innerHTML = `<button class="filter active" data-tag="all">All</button>`;
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "filter";
    btn.dataset.tag = cat.name;
    btn.textContent = cat.name.replace(/-/g, " ");
    filters.appendChild(btn);
  });

  // Fetch all posts
  const allPosts = [];
  for (const cat of categories) {
    const posts = await fetchPostsInCategory(cat);
    allPosts.push(...posts);
  }
  allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
  window.allPosts = allPosts;
  window.activeFilter = "all";

  renderPosts("all");

  // Wire filter tabs
  document.querySelectorAll(".filter").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      window.activeFilter = btn.dataset.tag;
      renderPosts(btn.dataset.tag);
    });
  });
}

function renderPosts(filter) {
  const container = document.getElementById("posts-list");
  container.innerHTML = "";

  if (filter === "all") {
    // Group by category, show 3 per category
    const grouped = {};
    window.allPosts.forEach(post => {
      if (!grouped[post.category]) grouped[post.category] = [];
      grouped[post.category].push(post);
    });

    Object.entries(grouped).forEach(([catName, posts]) => {
      const top3 = posts.slice(0, 3);
      const section = document.createElement("div");
      section.className = "category-section";
      section.innerHTML = `
         <div class="category-header">
    <h3 class="category-title">${catName.replace(/-/g, " ")}</h3>
  </div>
  <div class="category-posts">
    ${top3.map(post => postCardHTML(post)).join("")}
  </div>
      `;
      container.appendChild(section);
    });

    // View all posts button at bottom
    const viewAll = document.createElement("div");
    viewAll.className = "view-all-wrap";
    viewAll.innerHTML = `<a href="all-posts.html" class="view-all-btn">View all posts →</a>`;
    container.appendChild(viewAll);

  } else {
   const filtered = window.allPosts.filter(p => p.category === filter);
  const top3 = filtered.slice(0, 3);

  const section = document.createElement("div");
  section.className = "category-section";
  section.innerHTML = `
    <div class="category-posts">
      ${top3.map(post => postCardHTML(post)).join("")}
    </div>
    ${filtered.length > 3 ? `
      <div class="view-all-wrap">
        <a href="all-posts.html?category=${encodeURIComponent(filter)}" class="view-all-btn">
          Show more (${filtered.length - 3} more) →
        </a>
      </div>` : ""}
  `;
  container.appendChild(section);
  }
}

function postCardHTML(post) {
  return `
    <div class="post-card">
      <div class="post-meta">
        <span class="tag">${post.category.replace(/-/g, " ")}</span>
        <span class="date">${post.date}</span>
      </div>
      <h3><a href="post.html?url=${encodeURIComponent(post.download_url)}">${post.title}</a></h3>
    </div>
  `;
}

document.getElementById("posts-list").innerHTML = "<p class='empty'>Loading posts...</p>";
buildPostList().catch(err => {
  console.error(err);
  document.getElementById("posts-list").innerHTML = "<p class='empty'>Could not load posts.</p>";
});