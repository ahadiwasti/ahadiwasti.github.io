const posts = [
  {
    title: "Day 1: Two Sum — sliding window pattern",
    file: "blog/posts/2026-05-08-day-one.md",
    date: "2026-05-08",
    tags: ["DSA"],
    youtube: ""
  }
];

function renderPosts(filter = "all") {
  const container = document.getElementById("posts-list");
  container.innerHTML = "";

  const filtered = filter === "all"
    ? posts
    : posts.filter(p => p.tags.includes(filter));

  if (filtered.length === 0) {
    container.innerHTML = "<p class='empty'>No posts yet in this category.</p>";
    return;
  }

  filtered.forEach(post => {
    const div = document.createElement("div");
    div.className = "post-card";
    div.innerHTML = `
      <div class="post-meta">
        ${post.tags.map(t => `<span class="tag">${t}</span>`).join("")}
        <span class="date">${post.date}</span>
      </div>
      <h3><a href="post.html?file=${post.file}">${post.title}</a></h3>
      ${post.youtube ? `<a class="yt-link" href="${post.youtube}" target="_blank">▶ Watch on YouTube</a>` : ""}
    `;
    container.appendChild(div);
  });
}

document.querySelectorAll(".filter").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderPosts(btn.dataset.tag);
  });
});

renderPosts();