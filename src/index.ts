import { Channel, Client, Message, TextChannel } from 'discord.js';
import log from 'electron-log';
import { performance } from 'perf_hooks';
import { CHANNEL_ID, GENESIS_MESSAGE_ID } from './constants/constants';
import { Database } from './db/db';
import { loadEnv } from './utils/loadEnv';
import { sleep } from './utils/sleep';

// load the environment variables
loadEnv();

// initialize the db
export const db = new Database();

// start the main loop
main();

// main entry point
async function main() {
  await scrape();
}

// scrapes the channel
async function scrape() {
  const client = new Client();
  client.on('ready', async () => {
    let synced = false;
    let startTime = performance.now();
    log.info(`Logged in as ${client.user!.tag}!`);
    const scrapedChannel: TextChannel = (await client.channels.fetch(
      CHANNEL_ID
    )) as TextChannel;
    const messageManager = scrapedChannel.messages;
    let topMessage = (await db.getTopMessage()) || GENESIS_MESSAGE_ID;
    let messagesScraped = 0;

    while (true) {
      if (synced) {
        startTime = performance.now();
      }

      log.debug('Current top message is ' + topMessage);
      log.debug(`Scraped ${messagesScraped.toString()} so far.`);

      const messages: any = await messageManager.fetch({
        after: topMessage,
        limit: 50,
      });

      const msgList = [...messages.values()].reverse();

      if (msgList.length === 0) {
        const endTime = performance.now();
        log.info(
          'Scraped ' +
            messagesScraped.toString() +
            ' messages in ' +
            ((endTime - startTime) / 1000).toFixed(2) +
            ' seconds'
        );
        synced = true;
        messagesScraped = 0;
        await sleep(10000);
      }

      await db.sql.transaction(async (trx) => {
        for (const msg of msgList) {
          await db.storeMessage(msg, trx);
          topMessage = msg.id;
          if (msgList.indexOf(msg) === msgList.length - 1) {
            await db.setTopMessage(msg.id, trx);
          }
        }
      });

      messagesScraped += msgList.length;
      continue;
    }
  });

  client.login(process.env.DISCORD_TOKEN);
}
