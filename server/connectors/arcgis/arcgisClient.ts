import axios from 'axios';

export interface ArcGISFeature {
  attributes: Record<string, any>;
  geometry: {
    x?: number;
    y?: number;
    rings?: number[][][];
    paths?: number[][][];
  };
}

export interface ArcGISQueryResponse {
  features: ArcGISFeature[];
  exceededTransferLimit?: boolean;
}

export async function queryArcGISLayer(layerUrl: string, where: string = '1=1'): Promise<ArcGISFeature[]> {
  const allFeatures: ArcGISFeature[] = [];
  let offset = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      where,
      outFields: '*',
      f: 'json',
      resultOffset: offset.toString(),
      resultRecordCount: limit.toString(),
      outSR: '4326' // WGS84
    });

    const res = await axios.get(`${layerUrl}/query?${params.toString()}`);
    const data: ArcGISQueryResponse = res.data;

    if (data.features && data.features.length > 0) {
      allFeatures.push(...data.features);
      offset += data.features.length;
      hasMore = !!data.exceededTransferLimit;
    } else {
      hasMore = false;
    }
  }

  return allFeatures;
}
