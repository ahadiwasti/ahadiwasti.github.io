const fs = require("fs");
const path = require("path");

const POSTS_DIR = path.join(__dirname, "../blog/posts");
const OUTPUT = path.join(__dirname, "../blog/posts.json");
const result = [];

function isDir(p) {
  return fs.statSync(p).isDirectory();
}

function processPostDir(postDir, topCat, subCat = null) {
  if (!fs.existsSync(postDir)) return;
  const files = fs.readdirSync(postDir).filter(f => f.endsWith(".md"));

  for (const file of files) {
    const parts = file.replace(".md", "").split("-");
    const date = parts.slice(0, 3).join("-");
    const title = parts.slice(3).join(" ");

    const relativePath = subCat
      ? `blog/posts/${topCat}/${subCat}/${file}`
      : `blog/posts/${topCat}/${file}`;

    result.push({
      title: title.charAt(0).toUpperCase() + title.slice(1),
      date,
      category: topCat,
      subcategory: subCat,
      path: relativePath,
      url: `https://raw.githubusercontent.com/ahadiwasti/ahadiwasti.github.io/main/${relativePath.split('/').map(encodeURIComponent).join('/')}`
    });
  }
}

const topCategories = fs.readdirSync(POSTS_DIR).filter(f =>
  isDir(path.join(POSTS_DIR, f))
);

for (const topCat of topCategories) {
  const topCatPath = path.join(POSTS_DIR, topCat);
  const topContents = fs.readdirSync(topCatPath);
  const subDirs = topContents.filter(f => isDir(path.join(topCatPath, f)));

  if (subDirs.length === 0) {
    processPostDir(topCatPath, topCat, null);
  } else {
    for (const subCat of subDirs) {
      processPostDir(path.join(topCatPath, subCat), topCat, subCat);
    }
  }
}

result.sort((a, b) => new Date(b.date) - new Date(a.date));
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
console.log(`Generated posts.json with ${result.length} posts`);