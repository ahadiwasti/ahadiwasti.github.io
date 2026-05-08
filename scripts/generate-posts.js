const fs = require("fs");
const path = require("path");

const POSTS_DIR = path.join(__dirname, "../blog/posts");
const OUTPUT = path.join(__dirname, "../blog/posts.json");

const result = [];

const categories = fs.readdirSync(POSTS_DIR).filter(f =>
  fs.statSync(path.join(POSTS_DIR, f)).isDirectory()
);

for (const cat of categories) {
  const catPath = path.join(POSTS_DIR, cat);
  const files = fs.readdirSync(catPath).filter(f => f.endsWith(".md"));

  for (const file of files) {
    const parts = file.replace(".md", "").split("-");
    const date = parts.slice(0, 3).join("-");
    const title = parts.slice(3).join(" ");
    const relativePath = `blog/posts/${cat}/${file}`;

    result.push({
      title: title.charAt(0).toUpperCase() + title.slice(1),
      date,
      category: cat,
      path: relativePath,
      url: `https://raw.githubusercontent.com/ahadiwasti/ahadiwasti.github.io/main/${relativePath}`
    });
  }
}

result.sort((a, b) => new Date(b.date) - new Date(a.date));

fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
console.log(`Generated posts.json with ${result.length} posts`);