const YOUTUBE_API_KEY = "AIzaSyCB97IxgXOU7p7nRm9TZj1a_d9XETd2WhQ";
const fetchButton = document.querySelector("#fetch-creators");
const statusMessage = document.querySelector("#status-message");
const creatorGrid = document.querySelector("#creator-grid");
const searchForm = document.querySelector("#youtube-search-form");
const searchInput = document.querySelector("#youtube-search");
const searchButton = searchForm.querySelector("button");
const sortSelect = document.querySelector("#sort-creators");
let channels = [];

function createCreatorCard(channel) {
  const card = document.createElement("article");
  card.className = "creator-card";

  const image = document.createElement("img");
  image.src =
    channel.snippet.thumbnails.high?.url ||
    channel.snippet.thumbnails.medium?.url ||
    channel.snippet.thumbnails.default?.url;
  image.alt = `${channel.snippet.title} YouTube channel picture`;
  image.loading = "lazy";
  image.addEventListener(
    "error",
    () => {
      const placeholder = document.createElement("div");
      placeholder.className = "creator-image-placeholder";
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.textContent = channel.snippet.title.charAt(0);
      image.replaceWith(placeholder);
    },
    { once: true },
  );

  const name = document.createElement("h2");
  name.textContent = channel.snippet.title;

  const link = document.createElement("a");
  link.href = `https://www.youtube.com/channel/${channel.id}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Visit channel";

  const subscribers = document.createElement("p");
  subscribers.textContent = channel.statistics?.hiddenSubscriberCount
    ? "Subscriber count hidden"
    : `${Number(channel.statistics?.subscriberCount || 0).toLocaleString()} subscribers`;

  const views = document.createElement("p");
  views.textContent = `${Number(channel.statistics?.viewCount || 0).toLocaleString()} total views`;

  card.append(image, name, views, subscribers, link);
  return card;
}

async function youtubeRequest(endpoint, params) {
  if (YOUTUBE_API_KEY === "PASTE_YOUR_GOOGLE_API_KEY_HERE") {
    throw new Error("Add your Google API key to YOUTUBE_API_KEY at the top of script.js.");
  }

  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  for (const [key, value] of Object.entries({ ...params, key: YOUTUBE_API_KEY })) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  const result = await response.json();
  if (!response.ok) {
    const reason = result.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded") {
      throw new Error("YouTube API quota exceeded. Try again later.");
    }
    throw new Error(
      result.error?.message ||
        `YouTube returned HTTP ${response.status}. Check the API key and API settings.`,
    );
  }
  return result;
}

function displayChannels() {
  const sortedChannels = [...channels];
  const sortOrder = sortSelect.value;

  if (sortOrder === "name-asc") {
    sortedChannels.sort((a, b) => a.snippet.title.localeCompare(b.snippet.title));
  } else if (sortOrder === "name-desc") {
    sortedChannels.sort((a, b) => b.snippet.title.localeCompare(a.snippet.title));
  } else if (sortOrder === "subscribers-desc" || sortOrder === "subscribers-asc") {
    sortedChannels.sort((a, b) => {
      const aHidden = a.statistics?.hiddenSubscriberCount;
      const bHidden = b.statistics?.hiddenSubscriberCount;
      const aCount = a.statistics?.subscriberCount;
      const bCount = b.statistics?.subscriberCount;
      const aHasCount = !aHidden && aCount !== undefined && Number.isFinite(Number(aCount));
      const bHasCount = !bHidden && bCount !== undefined && Number.isFinite(Number(bCount));

      if (aHasCount !== bHasCount) return aHasCount ? -1 : 1;
      if (!aHasCount) return 0;
      return sortOrder === "subscribers-asc" ? aCount - bCount : bCount - aCount;
    });
  } 
  else {
    sortedChannels.sort((a, b) => {
      const aViews = Number(a.statistics?.viewCount || 0);
      const bViews = Number(b.statistics?.viewCount || 0);
      return sortOrder === "views-asc" ? aViews - bViews : bViews - aViews;
    });
  }
  creatorGrid.replaceChildren(...sortedChannels.map(createCreatorCard));
}

async function fetchChannels(
  query,
  order,
  loadingMessage,
  successMessage,
  candidateLimit = 20,
  rankByViews = false,
) {
  fetchButton.disabled = true;
  searchButton.disabled = true;
  sortSelect.disabled = true;

  channels = [];

  creatorGrid.replaceChildren();
  statusMessage.className = "";
  statusMessage.textContent = loadingMessage;

  try {
    const searchResult = await youtubeRequest("search", {
      part: "snippet",
      q: query,
      type: "channel",
      maxResults: String(candidateLimit),
      order,
    });

    const channelIds = (searchResult.items || [])
      .map((item) => item.id?.channelId)
      .filter(Boolean);

    if (channelIds.length === 0) {
      statusMessage.textContent = "No channels found. Try a different search.";
      return;
    }

    const channelResult = await youtubeRequest("channels", {
      part: "snippet,statistics",
      id: channelIds.join(","),
      maxResults: "50",
    });

    const channelsById = new Map(
      (channelResult.items || []).map((channel) => [channel.id, channel]),
    );

    channels = channelIds.map((id) => channelsById.get(id)).filter(Boolean);

    if (rankByViews) {
      channels.sort(
        (a, b) => Number(b.statistics?.viewCount || 0) - Number(a.statistics?.viewCount || 0),
      );
      channels = channels.slice(0, 20);
    }

    displayChannels();
    statusMessage.textContent = `${successMessage} Showing ${channels.length} channels.`;
  } 

  catch (error) {
    statusMessage.className = "error";
    statusMessage.textContent =
      error instanceof Error ? error.message : "Couldn't fetch YouTube channels. Check your connection and try again.";
  } 

  finally {
    fetchButton.disabled = false;
    searchButton.disabled = false;
    sortSelect.disabled = false;
  }
}

fetchButton.addEventListener("click", () =>
  fetchChannels(
    "YouTuber",
    "viewCount",
    "Finding YouTube channels and ranking them by total views…",
    "Top 20 by total channel views from up to 50 YouTube search matches (not a global ranking).",
    50,
    true,
  ),
);

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();

  if (!query) {
    statusMessage.className = "error";
    statusMessage.textContent = "Enter a YouTuber's name to search.";
    return;
  }
  
  fetchChannels(query, "relevance", `Searching YouTube for "${query}"…`, `Results for "${query}".`);
});

sortSelect.addEventListener("change", displayChannels);
