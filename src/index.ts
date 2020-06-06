import { Channel, Client, Message, TextChannel } from 'discord.js';
import log from 'electron-log';
import { performance } from 'perf_hooks';
import { Database } from './db/db';
import { loadEnv } from './utils/loadEnv';
import { sleep } from './utils/sleep';

// load the environment variables
loadEnv();

export const {
  CHANNEL_ID,
  GENESIS_MESSAGE_ID,
  DISCORD_TOKEN,
  SQL_HOST,
  SQL_USER,
  SQL_PASSWORD,
  SQL_DATABASE,
  SQL_PORT,
} = process.env;

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
  let client: Client = new Client();

  client.on('error', async (err) => {
    log.error(err);
    await sleep(5000);
    client = new Client();
  });

  client.on('warn', (e) => log.warn(e));
  // client.on('debug', (e) => log.info(e));

  client.on('ready', async () => {
    while (!db.ready) {
      await sleep(100);
    }

    let synced = false;
    let startTime = performance.now();
    log.info(`Logged in as ${client!.user!.tag}!`);

    const scrapedChannel: TextChannel = (await client!.channels.fetch(
      CHANNEL_ID!
    )) as TextChannel;

    const messageManager = scrapedChannel.messages;
    let topMessage = (await db.getTopMessage()) || GENESIS_MESSAGE_ID!;
    let initialStart = false;

    if (topMessage === GENESIS_MESSAGE_ID!) {
      initialStart = true;
    }

    let messagesScraped = 0;

    while (true) {
      if (synced) {
        startTime = performance.now();
      }

      log.debug('Current top message is ' + topMessage);
      log.debug(`Scraped ${messagesScraped.toString()} so far.`);

      let messages: any;

      try {
        if (initialStart) {
          messages = [await messageManager.fetch(GENESIS_MESSAGE_ID!)];
          console.log(messages);
          initialStart = false;
        } else {
          messages = await messageManager.fetch({
            after: topMessage,
            limit: 50,
          });
        }
      } catch (err) {
        log.warn(err);
        await sleep(2000);
        continue;
      }

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
        await sleep(1000);
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

  client.login(DISCORD_TOKEN!);
}
