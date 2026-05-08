const fs = require("fs");
const path = require("path");

const POSTS_DIR = path.join(__dirname, "../blog/posts");
const OUTPUT = path.join(__dirname, "../blog/posts.json");
const result = [];

function isDir(p) {
  return fs.statSync(p).isDirectory();
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  match[1].split("\n").forEach(line => {
    const [key, ...val] = line.split(":");
    if (key && val) fm[key.trim()] = val.join(":").trim();
  });
  return fm;
}

function processDir(dir, topCat, subCat = null) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".md"));

  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const fm = parseFrontmatter(content);

    const parts = file.replace(".md", "").split("-");
    const fallbackDate = parts.slice(0, 3).join("-");
    const fallbackTitle = parts.slice(3).join(" ");

    const relativePath = subCat
      ? `blog/posts/${topCat}/${subCat}/${file}`
      : `blog/posts/${topCat}/${file}`;

    result.push({
      title: fm.title
        ? fm.title.charAt(0).toUpperCase() + fm.title.slice(1)
        : fallbackTitle.charAt(0).toUpperCase() + fallbackTitle.slice(1),
      created_at: fm.created_at || fallbackDate,
      updated_at: fm.updated_at || fallbackDate,
      date: fm.created_at || fallbackDate,
      category: fm.category || topCat,
      subcategory: fm.subcategory || subCat,
      breadcrumb: fm.breadcrumb || null,
      path: relativePath,
      url: `https://raw.githubusercontent.com/ahadiwasti/ahadiwasti.github.io/main/${relativePath.split("/").map(encodeURIComponent).join("/")}`
    });
  }
}

const topCategories = fs.readdirSync(POSTS_DIR).filter(f =>
  isDir(path.join(POSTS_DIR, f))
);

for (const topCat of topCategories) {
  const topCatPath = path.join(POSTS_DIR, topCat);
  const subDirs = fs.readdirSync(topCatPath).filter(f =>
    isDir(path.join(topCatPath, f))
  );

  if (subDirs.length === 0) {
    processDir(topCatPath, topCat, null);
  } else {
    for (const subCat of subDirs) {
      processDir(path.join(topCatPath, subCat), topCat, subCat);
    }
  }
}

result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
console.log(`Generated posts.json with ${result.length} posts`);