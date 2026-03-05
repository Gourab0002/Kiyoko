export class Constants {
  static SukebeiBaseUrl: string = "https://sukebei.nyaa.si";
  static SukebeiAltUrl: string = "https://sukebei.nyaa.land";
  static DefaultProfilePic: string =
    "https://raw.githubusercontent.com/Yash-Garg/Nyaa-Api-Go/dev/static/default.png";

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
}
