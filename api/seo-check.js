export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  let targetUrl = url.trim();

  if (!targetUrl.startsWith("http")) {
    targetUrl = "https://" + targetUrl;
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!response.ok) {
      return res.status(400).json({
        error: "Website blocked request or returned error"
      });
    }

    const html = await response.text();

    // SAFE MATCHES
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i);
    const h1Matches = html.match(/<h1[^>]*>/gi) || [];
    const h2Matches = html.match(/<h2[^>]*>/gi) || [];

    const text = html.replace(/<[^>]*>/g, " ");
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    const title = titleMatch ? titleMatch[1] : null;
    const meta = metaMatch ? metaMatch[1] : null;

    let score = 0;

    if (title) score += 25;
    if (meta) score += 25;
    if (h1Matches.length > 0) score += 25;
    if (wordCount > 300) score += 25;

    return res.status(200).json({
      score,
      title: title ? "Found" : "Missing",
      metaDescription: meta ? "Found" : "Missing",
      h1Count: h1Matches.length,
      h2Count: h2Matches.length,
      wordCount
    });

  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch website. Try another URL."
    });
  }
}
