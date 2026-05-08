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
      url: `https://raw.githubusercontent.com/ahadiwasti/ahadiwasti.github.io/main/${relativePath}`
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
    // Flat — process directly
    processPostDir(topCatPath, topCat, null);
  } else {
    // Has subcategories — DSA/Array/, DSA/Stack/ etc
    for (const subCat of subDirs) {
      processPostDir(path.join(topCatPath, subCat), topCat, subCat);
    }
  }
}