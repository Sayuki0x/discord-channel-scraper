// tslint:disable: variable-name
import { Message, MessageAttachment, MessageEmbed } from 'discord.js';
import log from 'electron-log';
import knex from 'knex';
import { CHANNEL_ID, DATA_DIR } from '..';

export class Database {
  public ready: boolean;
  public sql: knex<any, unknown> = knex({
    client: 'sqlite3',
    connection: {
      filename: `${DATA_DIR}/${CHANNEL_ID}.sqlite`,
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

  public async storeEmbed(embed: MessageEmbed, post_id: string, trx: any) {
    const data = {
      type: embed.type,
      // tslint:disable-next-line: object-literal-sort-keys
      title: embed.title ? embed.title : null,
      description: embed.description ? embed.description : null,
      url: embed.url ? embed.url : null,
      color: embed.color ? embed.color : null,
      timestamp: embed.timestamp ? embed.timestamp : null,
      fields: embed.fields ? JSON.stringify(embed.fields) : null,
      thumbnail_url: embed.thumbnail ? embed.thumbnail.url : null,
      thumbnail_proxy_url: embed.thumbnail ? embed.thumbnail.proxyURL : null,
      thumbnail_height: embed.thumbnail ? embed.thumbnail.height : null,
      thumbnail_width: embed.thumbnail ? embed.thumbnail.width : null,
      image_url: embed.image ? embed.image.url : null,
      image_proxy_url: embed.image ? embed.image.proxyURL : null,
      image_height: embed.image ? embed.image.height : null,
      image_width: embed.image ? embed.image.width : null,
      video_url: embed.video ? embed.video.url : null,
      video_proxy_url: embed.video ? embed.video.proxyURL : null,
      video_height: embed.video ? embed.video.height : null,
      video_width: embed.video ? embed.video.width : null,
      author_name: embed.author ? embed.author.name : null,
      author_icon_url: embed.author ? embed.author.url : null,
      author_proxy_icon_url: embed.author ? embed.author.proxyIconURL : null,
      provider_name: embed.provider ? embed.provider.name : null,
      provider_url: embed.provider ? embed.provider.url : null,
      footer_text: embed.footer ? embed.footer.text : null,
      footer_icon_url: embed.footer ? embed.footer.iconURL : null,
      footer_proxy_icon_url: embed.footer ? embed.footer.proxyIconURL : null,
      post_id,
    };

    await this.sql('embeds')
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
      embeds: false,
      pinned: msg.pinned,
      timestamp: msg.createdTimestamp,
    };

    const attachmentList = [...msg.attachments.values()];

    if (attachmentList.length > 0) {
      data.attachments = true;
      for (const attachment of attachmentList) {
        await this.storeAttachment(attachment, msg.id, trx);
      }
    }

    const embedList = [...msg.embeds.values()];

    if (embedList.length > 0) {
      data.embeds = true;
      for (const embed of embedList) {
        await this.storeEmbed(embed, msg.id, trx);
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
          "attachments" BOOLEAN,
          "author_avatar" TEXT,
          "author_id" TEXT,
          "author_username" TEXT,
          "comment" TEXT,
          "discord_id" TEXT UNIQUE,
          "embeds" BOOLEAN,
          "pinned" BOOLEAN,
          "timestamp" INTEGER
        );`
      );
    }

    if (!tableNames.includes('embeds')) {
      await this.sql.raw(
        `CREATE TABLE "embeds" (
          "type" TEXT,
          "title" TEXT,
          "description" TEXT,
          "url" TEXT,
          "color" INTEGER,
          "timestamp" INTEGER,
          "fields" TEXT,
          "thumbnail_url" TEXT,
          "thumbnail_proxy_url" TEXT,
          "thumbnail_height" INTEGER,
          "thumbnail_width" INTEGER,
          "image_url" TEXT,
          "image_proxy_url" TEXT,
          "image_height" INTEGER,
          "image_width" INTEGER,
          "video_url" TEXT,
          "video_proxy_url" TEXT,
          "video_height" INTEGER,
          "video_width" INTEGER,
          "author_name" TEXT,
          "author_url" TEXT,
          "author_icon_url" TEXT,
          "author_proxy_icon_url" TEXT,
          "provider_name" TEXT,
          "provider_url" TEXT,
          "footer_text" TEXT,
          "footer_icon_url" TEXT,
          "footer_proxy_icon_url" TEXT,
          "post_id" TEXT
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
