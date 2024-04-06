import dotenv from "dotenv";
import Pocketbase from "pocketbase";
import express from "express";
import bodyParser from "body-parser";

import createBot from "./bot.js";
import { padNumberWithZeros } from "./utils.js";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const pb = new Pocketbase(process.env.PB_HOST || "http://127.0.0.1:8090");
const bots = {};

app.get("/active/bots", (_req, res) => {
  return res.status(200).json({
    bots: Object.keys(bots),
  });
});

app.post("/webhook/bots", async (req, res) => {
  const botData = req.body;
  var bot;

  try {
    let message = "";

    if (botData.isActive) {
      if (!bots.hasOwnProperty(botData.TOKEN)) {
        bot = createBot(botData.TOKEN, pb);
        bots[botData.TOKEN] = bot;

        bot.start();

        message = `Bot ${botData.TOKEN} has been started!`;
      } else {
        bot = bots[botData.TOKEN];
        message = `Bot ${botData.TOKEN} is already running!`;
      }
    } else {
      if (bots.hasOwnProperty(botData.TOKEN)) {
        bot = bots[botData.TOKEN];

        bot.stop();

        delete bots[botData.TOKEN];

        message = `Bot ${botData.TOKEN} has been stopped!`;
      } else {
        // Create a bot instance to get the bot info
        bot = createBot(botData.TOKEN, pb);
        message = `Bot ${botData.TOKEN} is not running!`;
      }
    }

    const botInfo = await bot.api.getMe();

    return res.status(200).json({
      message,
      bot: {
        id: padNumberWithZeros(botInfo.id),
        username: botInfo.username,
        firstName: botInfo.first_name || "",

        canJoinGroups: botInfo.can_join_groups || false,
        canReadAllGroupMessages: botInfo.can_read_all_group_messages || false,
        supportsInlineQueries: botInfo.supports_inline_queries || false,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message,
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, async () => {
  await pb.admins.authWithPassword(
    process.env.PB_ADMIN_EMAIL,
    process.env.PB_ADMIN_PASSWORD,
  );

  const botsData = await pb.collection("bots").getFullList({
    filter: "isActive=true",
  });

  botsData.forEach((botData) => {
    if (!bots.hasOwnProperty(botData.TOKEN)) {
      const bot = createBot(botData.TOKEN, pb);
      bots[botData.TOKEN] = bot;

      bot.start();
      console.log(`Bot ${botData.TOKEN} has been started!`);
    }
  });

  console.log(`Server is running on port ${port}`);
});