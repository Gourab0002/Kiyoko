export class Constants {
  static Version: string = "1.3.0";
  static SukebeiBaseUrl: string = "https://sukebei.nyaa.si";
  static SukebeiAltUrl: string = "https://sukebei.nyaa.mom";
  static UserAgent: string =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
  static PrimaryTimeoutMs: number = 4000;
  static FetchTimeoutMs: number = 10000;
  static HealthTimeoutMs: number = 4000;
  static HealthCacheSeconds: number = 15;
  static ResultsPerPage: number = 75;
  static MaxBatchIds: number = 10;
  static MaxBatchConcurrency: number = 3;
  static MaxQueryLength: number = 200;
  static MaxPage: number = 1000;
  static MaxIdLength: number = 10;
  static MaxPageBytes: number = 2_000_000;
  static MaxTorrentBytes: number = 2_000_000;
  static ListingCacheSeconds: number = 60;
  static DetailCacheSeconds: number = 180;
  static RateLimitRetrySeconds: number = 60;
  static UpstreamRetrySeconds: number = 5;

  static SukebeiMirrors: string[] = [
    "https://sukebei.nyaa.si",
    "https://sukebei.nyaa.mom",
  ];

  static SukebeiEndpoints: Record<string, Record<string, string>> = {
    all: {
      all: "0_0",
    },
    art: {
      all: "1_0",
      anime: "1_1",
      doujinshi: "1_2",
      games: "1_3",
      manga: "1_4",
      pictures: "1_5",
    },
    real_life: {
      all: "2_0",
      photobooks: "2_1",
      videos: "2_2",
    },
  };

  static ValidSorts: Set<string> = new Set([
    "",
    "id",
    "size",
    "seeders",
    "leechers",
    "downloads",
    "comments",
  ]);

  static ValidOrders: Set<string> = new Set(["", "asc", "desc"]);
  static ValidFilters: Set<number> = new Set([0, 1, 2]);
}
