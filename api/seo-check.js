export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { url, keyword } = req.query;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  let targetUrl = url.trim();

  if (!targetUrl.startsWith("http")) {
    targetUrl = "https://" + targetUrl;
  }

  try {
    const startTime = Date.now();

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 Website SEO Checker by ClickDo",
        "Accept": "text/html"
      }
    });

    const loadTime = Date.now() - startTime;

    if (!response.ok) {
      return res.status(400).json({
        error: "Website blocked the request or returned an error"
      });
    }

    const html = await response.text();
    const pageSizeKB = Math.round(Buffer.byteLength(html, "utf8") / 1024);

    const getMatch = (regex) => {
      const match = html.match(regex);
      return match ? match[1].trim().replace(/\s+/g, " ") : "";
    };

    const title = getMatch(/<title[^>]*>(.*?)<\/title>/is);

    const metaDescription = getMatch(
      /<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["'][^>]*>/is
    );

    const canonical = getMatch(
      /<link[^>]*rel=["']canonical["'][^>]*href=["'](.*?)["'][^>]*>/is
    );

    const publishedDate =
      getMatch(/<meta[^>]*property=["']article:published_time["'][^>]*content=["'](.*?)["'][^>]*>/is) ||
      getMatch(/<meta[^>]*name=["']date["'][^>]*content=["'](.*?)["'][^>]*>/is) ||
      getMatch(/<time[^>]*datetime=["'](.*?)["'][^>]*>/is);

    const h1Matches = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || [];
    const h2Matches = html.match(/<h2[^>]*>[\s\S]*?<\/h2>/gi) || [];

    const imgMatches = html.match(/<img[^>]*>/gi) || [];
    const imgAltMatches = html.match(/<img[^>]*alt=["'][^"']+["'][^>]*>/gi) || [];

    const jsonLdMatches =
      html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];

    let schemaTypes = [];

    jsonLdMatches.forEach((block) => {
      const jsonText = block
        .replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>/i, "")
        .replace(/<\/script>/i, "")
        .trim();

      try {
        const parsed = JSON.parse(jsonText);

        const collectTypes = (item) => {
          if (!item) return;

          if (Array.isArray(item)) {
            item.forEach(collectTypes);
          } else if (typeof item === "object") {
            if (item["@type"]) {
              if (Array.isArray(item["@type"])) {
                schemaTypes.push(...item["@type"]);
              } else {
                schemaTypes.push(item["@type"]);
              }
            }

            if (item["@graph"]) {
              collectTypes(item["@graph"]);
            }
          }
        };

        collectTypes(parsed);
      } catch {}
    });

    schemaTypes = [...new Set(schemaTypes)];

    const cleanText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const words = cleanText ? cleanText.split(" ") : [];
    const wordCount = words.length;

    let keywordDensity = "Not checked";
    let keywordCount = 0;

    if (keyword) {
      const safeKeyword = keyword.toLowerCase().trim();
      const textLower = cleanText.toLowerCase();

      keywordCount = (textLower.match(new RegExp(safeKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
      keywordDensity = wordCount > 0 ? ((keywordCount / wordCount) * 100).toFixed(2) + "%" : "0%";
    }

    const issues = [];

    if (!title) issues.push("Meta title is missing.");
    if (title && (title.length < 30 || title.length > 60)) issues.push("Meta title length should ideally be 30 to 60 characters.");

    if (!metaDescription) issues.push("Meta description is missing.");
    if (metaDescription && (metaDescription.length < 120 || metaDescription.length > 160)) issues.push("Meta description length should ideally be 120 to 160 characters.");

    if (h1Matches.length === 0) issues.push("H1 tag is missing.");
    if (h1Matches.length > 1) issues.push("More than one H1 tag found.");

    if (h2Matches.length === 0) issues.push("No H2 headings found.");
    if (wordCount < 300) issues.push("Page content appears too thin.");

    if (imgMatches.length > 0 && imgAltMatches.length < imgMatches.length) {
      issues.push("Some images are missing ALT text.");
    }

    if (!canonical) issues.push("Canonical URL is missing.");
    if (jsonLdMatches.length === 0) issues.push("No structured data found.");

    let score = 0;
const breakdown = {
  title: 0,
  metaDescription: 0,
  headings: 0,
  content: 0,
  images: 0,
  structuredData: 0,
  canonical: 0,
  performance: 0
};

// 🔴 TITLE (STRICT)
if (title) breakdown.title += 5;
if (title && title.length >= 50 && title.length <= 60) breakdown.title += 10;

// 🔴 META DESCRIPTION (STRICT)
if (metaDescription) breakdown.metaDescription += 5;
if (metaDescription && metaDescription.length >= 140 && metaDescription.length <= 160) breakdown.metaDescription += 10;

// 🔴 HEADINGS
if (h1Matches.length === 1) breakdown.headings += 10;
if (h2Matches.length >= 2) breakdown.headings += 5;

// 🔴 CONTENT (STRICT)
if (wordCount >= 500) breakdown.content += 5;
if (wordCount >= 1000) breakdown.content += 5;
if (wordCount >= 1500) breakdown.content += 5;

// 🔴 IMAGES (ALT RATIO)
if (imgMatches.length > 0) {
  let altRatio = imgAltMatches.length / imgMatches.length;
  if (altRatio > 0.8) breakdown.images += 10;
  else if (altRatio > 0.5) breakdown.images += 5;
}

// 🔴 STRUCTURED DATA
if (jsonLdMatches.length > 0) breakdown.structuredData += 10;

// 🔴 CANONICAL
if (canonical) breakdown.canonical += 5;

// 🔴 PERFORMANCE (STRICT)
if (loadTime < 1500) breakdown.performance += 10;
else if (loadTime < 3000) breakdown.performance += 5;

if (pageSizeKB < 500) breakdown.performance += 5;

// ✅ FINAL SCORE
score = Object.values(breakdown).reduce((a, b) => a + b, 0);

// ✅ HARD LIMIT
score = Math.min(score, 100);

    const estimatedDA = Math.min(
      100,
      Math.round(
        (wordCount / 100) +
        (schemaTypes.length * 5) +
        (h2Matches.length * 1.5) +
        (canonical ? 10 : 0)
      )
    );

    return res.status(200).json({
      url: targetUrl,
      score,
      breakdown,
      title: title || "Missing",
      titleLength: title.length,
      metaDescription: metaDescription || "Missing",
      metaLength: metaDescription.length,
      publishedDate: publishedDate || "Not found",
      canonical: canonical || "Missing",
      h1Count: h1Matches.length,
      h2Count: h2Matches.length,
      wordCount,
      imageCount: imgMatches.length,
      imagesWithAlt: imgAltMatches.length,
      structuredDataBlocks: jsonLdMatches.length,
      schemaTypes: schemaTypes.length ? schemaTypes : ["Not found"],
      keyword: keyword || "Not checked",
      keywordCount,
      keywordDensity,
      pageSpeed: {
        responseTimeMs: loadTime,
        pageSizeKB
      },
      estimatedDA,
      issues: issues.length ? issues : ["No major basic SEO issues found."]
    });

  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch website. This website may block crawlers or timed out."
    });
  }
}
