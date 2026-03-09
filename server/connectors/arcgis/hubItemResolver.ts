import axios from 'axios';

export interface ArcGISItem {
  id: string;
  url: string;
  title: string;
  type: string;
}

export async function resolveHubItem(hubUrl: string): Promise<ArcGISItem | null> {
  try {
    // Extract ID from URL (e.g., /apps/e5004d18034e41e192e89e03601d4c17)
    const match = hubUrl.match(/\/(apps|maps|documents|datasets|content)\/([a-f0-9]{32})/);
    if (!match) return null;

    const itemId = match[2];
    const portalUrl = 'https://opendata.montgomeryal.gov/sharing/rest/content/items';
    const res = await axios.get(`${portalUrl}/${itemId}?f=json`);

    if (res.data && res.data.url) {
      return {
        id: itemId,
        url: res.data.url,
        title: res.data.title,
        type: res.data.type
      };
    }

    return null;
  } catch (error) {
    console.error(`Error resolving Hub item ${hubUrl}:`, error);
    return null;
  }
}
