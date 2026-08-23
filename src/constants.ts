export class Constants {
  static SukebeiBaseUrl: string = "https://sukebei.nyaa.si";
  static SukebeiAltUrl: string = "https://sukebei.nyaa.land";
  static UserAgent: string =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
  static FetchTimeoutMs: number = 15000;

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
}
