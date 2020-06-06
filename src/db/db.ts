// tslint:disable: variable-name
import { Message, MessageAttachment, MessageEmbed } from 'discord.js';
import log from 'electron-log';
import knex from 'knex';
import { SQL_DATABASE, SQL_HOST, SQL_PASSWORD, SQL_PORT, SQL_USER } from '..';

export class Database {
  public ready: boolean;
  public sql: knex<any, unknown> = knex({
    client: 'mysql',
    connection: {
      database: SQL_DATABASE,
      host: SQL_HOST,
      password: SQL_PASSWORD,
      port: Number(SQL_PORT),
      user: SQL_USER,
    },
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
      timestamp: embed.timestamp ? String(embed.timestamp) : null,
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
      timestamp: String(msg.createdTimestamp),
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
      `SELECT table_name FROM information_schema.tables WHERE table_schema = "${SQL_DATABASE}"`
    );

    // wtf mysql
    const tableNames = tables[0].map((row: any) =>
      row.table_name ? row.table_name : row.TABLE_NAME
    );

    log.info(tableNames);

    await this.sql.raw(`SET NAMES utf8mb4;`);
    let newDb = false;

    if (!tableNames.includes('posts')) {
      newDb = true;
      await this.sql.schema.createTable('posts', (table) => {
        table.boolean('attachments');
        table.string('author_avatar');
        table.string('author_id');
        table.string('author_username');
        table.specificType('comment', 'mediumtext');
        table
          .string('discord_id')
          .unique()
          .index();
        table.boolean('embeds');
        table.boolean('pinned');
        table.string('timestamp');
      });
    }

    if (!tableNames.includes('embeds')) {
      await this.sql.schema.createTable('embeds', (table) => {
        table.string('type');
        table.string('title');
        table.specificType('description', 'mediumtext');
        table.specificType('url', 'mediumtext');
        table.string('color');
        table.string('timestamp');
        table.specificType('fields', 'mediumtext');
        table.specificType('thumbnail_url', 'mediumtext');
        table.specificType('thumbnail_proxy_url', 'mediumtext');
        table.integer('thumbnail_height');
        table.integer('thumbnail_width');
        table.specificType('image_url', 'mediumtext');
        table.specificType('image_proxy_url', 'mediumtext');
        table.integer('image_height');
        table.integer('image_width');
        table.specificType('video_url', 'mediumtext');
        table.specificType('video_proxy_url', 'mediumtext');
        table.integer('video_height');
        table.integer('video_width');
        table.string('author_name');
        table.specificType('author_url', 'mediumtext');
        table.specificType('author_icon_url', 'mediumtext');
        table.specificType('author_proxy_icon_url', 'mediumtext');
        table.string('provider_name');
        table.specificType('provider_url', 'mediumtext');
        table.string('footer_text');
        table.specificType('footer_icon_url', 'mediumtext');
        table.specificType('footer_proxy_icon_url', 'mediumtext');
        table.string('post_id');
      });
    }

    if (!tableNames.includes('attachments')) {
      await this.sql.schema.createTable('attachments', (table) => {
        table.string('attachment');
        table.string('name');
        table.string('id');
        table.integer('size');
        table.string('url');
        table.specificType('proxy_url', 'mediumtext');
        table.integer('height');
        table.integer('width');
        table.string('post_id');
        table.specificType('buffer', 'mediumblob');
      });
    }

    if (!tableNames.includes('internal')) {
      await this.sql.schema.createTable('internal', (table) => {
        table.string('topMessage');
      });
      await this.sql('internal').insert({});
    }

    if (newDb) {
      await this.sql.raw(
        'alter table attachments convert to character set utf8mb4 collate utf8mb4_unicode_ci;'
      );
      await this.sql.raw(
        'alter table embeds convert to character set utf8mb4 collate utf8mb4_unicode_ci;'
      );
      await this.sql.raw(
        'alter table internal convert to character set utf8mb4 collate utf8mb4_unicode_ci;'
      );
      await this.sql.raw(
        'alter table posts convert to character set utf8mb4 collate utf8mb4_unicode_ci;'
      );
    }

    this.ready = true;
    log.info('Database opened successfully');
  }
}
