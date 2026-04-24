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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(400).json({
        error: "Website blocked the request or returned an error",
      });
    }

    const html = await response.text();

    // SAFE PARSING
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const metaMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i
    );

    const h1Matches = html.match(/<h1[^>]*>/gi) || [];
    const h2Matches = html.match(/<h2[^>]*>/gi) || [];

    const cleanText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const wordCount = cleanText ? cleanText.split(" ").length : 0;

    const title = titleMatch ? titleMatch[1].trim() : null;
    const meta = metaMatch ? metaMatch[1].trim() : null;

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
      wordCount,
    });

  } catch (error) {
    return res.status(500).json({
      error:
        "Failed to fetch website. This site may block bots or timed out.",
    });
  }
}
