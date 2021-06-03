import { createAddon, runCli, DashboardItem } from "@mediaurl/sdk";
import * as cheerio from "cheerio";
const axios = require("axios");

interface izleseneItem {
    title: string;
    link: string;
    description: string;
}
interface izleseneList {
    title: string;
    thumbnail: string;
    link: string;
}

const parseItem = async (html: string): Promise<izleseneItem> => {
    const $ = cheerio.load(html);
    const title = $('meta[property="og:title"]').attr("content") as string;
    const video = $('meta[itemprop="contentURL"]').attr("content") as string;
    const description = $('meta[property="og:description"]').attr(
        "content"
    ) as string;
    return {
        title: title,
        link: video,
        description: description,
    };
};

const parseList = async (html: string): Promise<izleseneList[]> => {
    const results: izleseneList[] = [];
    const $ = cheerio.load(html);
    $(".videos-horizontal > div").each((index, elem) => {
        const thumbnail = $(elem)
            .find("img.js-lazy-image")
            .first()
            .attr("data-src") as string;

        const item: izleseneList = {
            title: $(elem).find("img").first().attr("alt") as string,
            thumbnail: thumbnail || "",
            link: $(elem).find("a").first().attr("href") as string,
        };
        if (thumbnail != undefined) {
            results.push(item);
        }
    });
    if ($("#search_results > a").length > 0) {
        $("#search_results > a").each((index, elem) => {
            const thumbnail = $(elem).find("img").first().attr("src") as string;

            const item: izleseneList = {
                title: $(elem).find("img").first().attr("alt") as string,
                thumbnail: thumbnail || "",
                link: $(elem).attr("href") as string,
            };
            if (thumbnail != undefined) {
                results.push(item);
            }
        });
    }
    return results;
};

const dashboardsList = async (): Promise<DashboardItem[]> => {
    let url = "https://www.izlesene.com/videolar";
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const dash: DashboardItem[] = [];
    $("#categoryDropdown > ul > li").each((index, elem) => {
        const item: DashboardItem = {
            id: $(elem).find("a").attr("href") as string,
            name: $(elem).find("a").attr("title") as string,
        };
        dash.push(item);
    });
    return dash;
};

(async () => {
    const dashboardList = await dashboardsList();
    const izleseneAddon = createAddon({
        id: "izlesene",
        name: "Izlesene",
        description: "Izlesene Videos",
        icon: "https://c1.imgiz.com/izlesene-favicon-32.ico",
        version: "0.1.2",
        itemTypes: ["movie", "series"],
        catalogs: [
            {
                features: {
                    search: { enabled: true },
                },
                options: {
                    imageShape: "landscape",
                    displayName: true,
                },
            },
        ],
        dashboards: dashboardList,
    });

    izleseneAddon.registerActionHandler("catalog", async (input, ctx) => {
        const { fetch } = ctx;
        const { id } = input; // cagetory get name
        let url = "https://www.izlesene.com";

        if (id) {
            url = id.toString();
        } else if (input.search) {
            url = "https://izlesene.com" + "?kelime=" + input.search; //tegory
        }

        const results = await fetch(url).then(async (resp) => {
            return parseList(await resp.text());
        });

        return {
            nextCursor: null,
            items: results.map((item) => {
                const id = item.link;
                return {
                    id,
                    ids: { id },
                    type: "movie",
                    name: `${item.title}`,
                    images: {
                        poster: item.thumbnail,
                    },
                };
            }),
        };
    });

    izleseneAddon.registerActionHandler("item", async (input, ctx) => {
        const { fetch } = ctx;

        const result = await fetch(input.ids.id.toString()).then(async (resp) =>
            parseItem(await resp.text())
        );

        //video item return
        return {
            type: "movie",
            ids: input.ids,
            name: result.title,
            description: `${result.description}` || "",
            sources: [
                {
                    type: "url",
                    url: result.link,
                    name: result.title,
                },
            ],
        };
    });
    runCli([izleseneAddon], { singleMode: false });
})();
