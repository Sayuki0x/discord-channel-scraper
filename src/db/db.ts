// tslint:disable: variable-name
import chalk from 'chalk';
import { Message, MessageAttachment } from 'discord.js';
import log from 'electron-log';
import knex, { Transaction } from 'knex';

export class Database {
  public ready: boolean;
  public sql: knex<any, unknown> = knex({
    client: 'sqlite3',
    connection: {
      filename: './db2.sqlite',
    },
    useNullAsDefault: true,
  });

  constructor() {
    this.ready = false;
    this.init();
  }

  public async storeAttachment(
    attachment: MessageAttachment,
    post_id: string,
    trx: any
  ) {
    const data = {
      attachment: attachment.attachment,
      height: attachment.height,
      id: attachment.id,
      name: attachment.name,
      post_id,
      proxy_url: attachment.proxyURL,
      size: attachment.size,
      url: attachment.url,
      width: attachment.width,
    };

    await this.sql('attachments')
      .insert(data)
      .transacting(trx);
  }

  public async storeMessage(msg: Message, trx: any): Promise<void> {
    // interesting things: attachments
    const data = {
      attachments: false,
      author_avatar: msg.author.avatar,
      author_id: msg.author.id,
      author_username: msg.author.username,
      comment: msg.cleanContent,
      discord_id: msg.id,
      pinned: msg.pinned,
      timestamp: msg.createdTimestamp,
    };
    // log.debug(data);

    const attachmentList = [...msg.attachments.values()];

    if (attachmentList.length > 0) {
      data.attachments = true;
      for (const attachment of attachmentList) {
        await this.storeAttachment(attachment, msg.id, trx);
      }
    }

    try {
      await this.sql('posts')
        .insert(data)
        .transacting(trx);
    } catch (err) {
      if (err.errno !== 19) {
        throw err;
      } else {
        log.warn('Duplicate entry! Shit!');
      }
    }
  }

  public async getTopMessage(): Promise<any> {
    const query = await this.sql('internal').select('topMessage');
    return query[0].topMessage;
  }

  public async setTopMessage(discordID: string, trx: any) {
    await this.sql('internal')
      .update({ topMessage: discordID })
      .transacting(trx);
  }

  private async init(): Promise<void> {
    const tables = await this.sql.raw(
      `SELECT name FROM sqlite_master
       WHERE type='table'
       ORDER BY name;`
    );
    const tableNames = tables.map((table: any) => table.name);

    if (!tableNames.includes('posts')) {
      await this.sql.raw(
        `CREATE TABLE "posts" (
          "author_avatar" TEXT,
          "author_id" TEXT,
          "author_username" TEXT,
          "comment" TEXT,
          "discord_id" TEXT UNIQUE,
          "pinned" BOOLEAN,
          "timestamp" INTEGER,
          "attachments" BOOLEAN
        );`
      );
    }

    if (!tableNames.includes('attachments')) {
      await this.sql.raw(
        `CREATE TABLE "attachments" (
          "attachment" TEXT,
          "name" TEXT,
          "id" TEXT,
          "size" INTEGER,
          "url" TEXT,
          "proxy_url" TEXT,
          "height" INTEGER,
          "width" INTEGER,
          "post_id" TEXT,
          "buffer" BLOB
        );`
      );
    }

    if (!tableNames.includes('internal')) {
      await this.sql.raw(
        `CREATE TABLE "internal" (
          "topMessage" TEXT
        );`
      );
      await this.sql('internal').insert({});
    }

    this.ready = true;
    log.info('Database opened successfully');
  }
}
