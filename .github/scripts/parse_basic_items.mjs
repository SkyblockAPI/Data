import {Octokit} from "@octokit/core";
import fetch from "node-fetch";
import process from "node:process";
import {createOrUpdateTextFile} from "@octokit/plugin-create-or-update-text-file";
import fs from "fs";

const colorCodeRegex = /%%\w+%%/g

const ids = JSON.parse(fs.readFileSync(".github/scripts/1_8_9_to_1_21_1.json", "utf-8"))

const getItemId = (item) => {
    const id = item.material + (item.durability ? ":" + item.durability : "")
    if ("id".startsWith("MONSTER_EGG")) {
        return "minecraft:ghast_spawn_egg"
    }
    return ids[id] || "minecraft:barrier"
}

const convertItem = (item) => {
    return {
        id: getItemId(item),
        count: 1,
        components: {
            'minecraft:attribute_modifiers': {
                modifiers: [],
                show_in_tooltip: false
            },
            'minecraft:hide_additional_tooltip': {},
            'minecraft:custom_name': `"${item.name.replaceAll(colorCodeRegex, "")}"`,
            'minecraft:enchantment_glint_override': item.glowing ? true : undefined,
            'minecraft:profile': item.skin ? {
                properties: [
                    {
                        name: "textures",
                        value: typeof item.skin === "string" ? item.skin : item.skin.value,
                        signature: typeof item.skin === "string" ? undefined : item.skin.signature
                    }
                ]
            } : undefined,
            'minecraft:custom_data': {
                id: item.id
            }
        }
    }
}

async function run() {
    const OctokitInstance = Octokit.plugin(createOrUpdateTextFile);
    const octokit = new OctokitInstance({
        auth: process.env.GITHUB_TOKEN,
        request: {
            fetch: fetch,
        },
    });
    const context = JSON.parse(process.env.GITHUB_CONTEXT);

    const data = await fetch("https://api.hypixel.net/v2/resources/skyblock/items").then(res => res.json())

    if (data.success) {
        const items = {}
        const nameToId = {}

        for (let item of data.items) {
            items[item.id] = convertItem(item)
            nameToId[item.id] = item.name.replaceAll(colorCodeRegex, "")
        }

        const sorted = Object.keys(items).sort().reduce((obj, key) => {
            obj[key] = items[key];
            return obj;
        }, {});

        await octokit.createOrUpdateTextFile({
            owner: context.repository_owner,
            repo: context.repository.split("/")[1],
            path: "items.json",
            message: "Update items.json",
            content: JSON.stringify({
                updated: data.lastUpdated,
                items: sorted
            })
        })

        await octokit.createOrUpdateTextFile({
            owner: context.repository_owner,
            repo: context.repository.split("/")[1],
            path: "namesToId.json",
            message: "Update namesToId.json",
            content: JSON.stringify({
                updated: data.lastUpdated,
                items: nameToId
            })
        })
    } else {
        throw new Error("Failed to fetch items from Hypixel API")
    }
}

run().catch(err => {
    console.error(err)
    process.exit(1)
})
