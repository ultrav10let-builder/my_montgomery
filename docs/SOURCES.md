# Montgomery Open Data Sources

This document lists the ArcGIS Hub items and underlying REST FeatureServer layers used by My❤️Montgomery.

| Label | Type | ArcGIS Hub URL | REST Query URL | Refresh Cadence | Fields Used |
|-------|------|----------------|----------------|-----------------|-------------|
| 311 Service Requests | Feature Layer | [Hub Item](https://opendata.montgomeryal.gov/apps/e5004d18034e41e192e89e03601d4c17) | `https://services.arcgis.com/.../FeatureServer/0` | Daily | `TYPE`, `CATEGORY`, `STATUS`, `OPENED_AT`, `NEIGHBORHOOD` |
| Code Violations | Feature Layer | [Hub Item](https://opendata.montgomeryal.gov/apps/0dcb0a26743442168f36c38e3e020300) | `https://services.arcgis.com/.../FeatureServer/0` | Daily | `VIOLATION_TYPE`, `STATUS`, `DATE_REPORTED` |
| Zoning Cases | Feature Layer | [Hub Item](https://opendata.montgomeryal.gov/maps/3b6888b911174bd28c746c737b4006ac) | `https://services.arcgis.com/.../FeatureServer/0` | Weekly | `CASE_NUMBER`, `STATUS`, `DESCRIPTION` |
| Capital Projects | Feature Layer | [Hub Item](https://opendata.montgomeryal.gov/maps/ebd5bd8832b04ce8b87a5accfc3b1526) | `https://services.arcgis.com/.../FeatureServer/0` | Monthly | `PROJECT_NAME`, `PHASE`, `BUDGET` |
| Business Licenses | Feature Layer | [Hub Item](https://opendata.montgomeryal.gov/apps/989599339fed43138248fb799625ad8c) | `https://services.arcgis.com/.../FeatureServer/0` | Monthly | `BUSINESS_NAME`, `CATEGORY`, `ISSUE_DATE` |
| Parks & Rec Facilities | Feature Layer | [Hub Item](https://opendata.montgomeryal.gov/maps/1dce55228002411ba308638a11bdb813) | `https://services.arcgis.com/.../FeatureServer/0` | Yearly | `NAME`, `TYPE`, `ADDRESS` |
| City Council Districts | Feature Layer | [Hub Item](https://opendata.montgomeryal.gov/documents/c0c056626bd449cba2c078f5c49c2650) | `https://services.arcgis.com/.../FeatureServer/0` | Yearly | `DISTRICT_ID`, `REPRESENTATIVE` |

*Note: REST URLs are discovered dynamically by the `hubItemResolver.ts` service.*

## Scraped Civic Sources (Bright Data)

These sources are live-scraped using the Bright Data Browser API to generate the daily "Today in Montgomery" digest.

| Label | Purpose | URL | Refresh Cadence |
|-------|---------|-----|-----------------|
| City News | General announcements and news | [News](https://www.montgomeryal.gov/news) | Daily |
| City Council | Meeting agendas and minutes | [Council](https://www.montgomeryal.gov/city-council) | Daily |
| Planning Dept | Zoning and development updates | [Planning](https://www.montgomeryal.gov/departments/planning) | Daily |
| Parks & Rec | Community events and facility news | [Parks](https://www.montgomeryal.gov/departments/parks-recreation) | Daily |
| Public Safety | Police and Fire department updates | [Public Safety](https://www.montgomeryal.gov/departments/public-safety) | Daily |
