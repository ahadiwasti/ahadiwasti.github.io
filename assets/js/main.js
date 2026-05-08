async function buildPostList() {
  const res = await fetch("blog/posts.json");
  const allPosts = await res.json();
  window.allPosts = allPosts;

  // Build filter tabs dynamically from categories
  const categories = [...new Set(allPosts.map(p => p.category))];
  const filters = document.querySelector(".filters");
  filters.innerHTML = `<button class="filter active" data-tag="all">All</button>`;
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "filter";
    btn.dataset.tag = cat;
    btn.textContent = cat.replace(/-/g, " ");
    filters.appendChild(btn);
  });

  renderPosts("all");

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
    <a href="post.html?url=${encodeURIComponent(post.url)}" class="post-card">
      <div class="post-meta">
        <span class="tag">${post.category.replace(/-/g, " ")}</span>
        <span class="date">${post.date}</span>
      </div>
      <h3>${post.title}</h3>
    </a>
  `;
}

document.getElementById("posts-list").innerHTML = "<p class='empty'>Loading posts...</p>";
buildPostList().catch(err => {
  console.error(err);
  document.getElementById("posts-list").innerHTML = "<p class='empty'>Could not load posts.</p>";
});