import {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  type TextChannel,
  type GuildMember,
  type Role,
} from "discord.js";
import { logger } from "./lib/logger";

// =========================
// CONFIG
// =========================
const PREFIX = "+";

const LOG_MOD = "1507070382312526006";
const LOG_RAID = "1508077887436226741";
const STAFF_ROLE_ID = "1507070149767860415";

const jailRoleId = "1507394053572919469";
const jailChannelId = "1507394055540047992";
const MUTED_ROLE_NAME = "Muted";

// =========================
// SYSTEMS
// =========================
const warns = new Map<string, number>();
const afk = new Map<string, boolean>();
const jailBackup = new Map<string, string[]>();
const spam = new Map<string, { count: number; time: number }>();

// =========================
// CLIENT
// =========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
});

// =========================
// READY
// =========================
client.once("clientReady", () => {
  logger.info({ tag: client.user?.tag }, "Bot Discord connecté");
});

// =========================
// MESSAGE EVENT
// =========================
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const member = message.member as GuildMember;
  const logMod = message.guild.channels.cache.get(LOG_MOD) as TextChannel | undefined;
  const logRaid = message.guild.channels.cache.get(LOG_RAID) as TextChannel | undefined;

  // =========================
  // 🛡 ANTI SPAM
  // =========================
  const now = Date.now();

  if (!spam.has(message.author.id)) {
    spam.set(message.author.id, { count: 1, time: now });
  } else {
    const data = spam.get(message.author.id)!;

    if (now - data.time < 4000) {
      data.count++;

      if (data.count >= 6) {
        await message.delete().catch(() => {});

        let muted: Role | undefined = message.guild.roles.cache.find(
          (r) => r.name === MUTED_ROLE_NAME
        );

        if (!muted) {
          muted = await message.guild.roles.create({
            name: MUTED_ROLE_NAME,
            permissions: [],
          });
        }

        await member.roles.add(muted).catch(() => {});

        logRaid?.send(`🚨 Anti-spam: ${message.author.tag} mute 5 min`).catch(() => {});

        setTimeout(() => {
          member.roles.remove(muted!).catch(() => {});
        }, 300000);

        spam.delete(message.author.id);
      }
    } else {
      spam.set(message.author.id, { count: 1, time: now });
    }
  }

  // =========================
  // AFK RETURN
  // =========================
  if (afk.has(message.author.id)) {
    afk.delete(message.author.id);
    message.reply("👋 AFK retiré.").catch(() => {});
  }

  const mentioned = message.mentions.users.first();
  if (mentioned && afk.has(mentioned.id)) {
    message.reply(`💤 ${mentioned.username} est AFK`).catch(() => {});
  }

  // =========================
  // AUTO UNJAIL SI "LEGIT"
  // =========================
  if (
    message.channel.id === jailChannelId &&
    message.content.trim().toUpperCase() === "LEGIT" &&
    member.roles.cache.has(jailRoleId)
  ) {
    const roles = jailBackup.get(message.author.id);
    if (roles) await member.roles.set(roles).catch(() => {});
    else await member.roles.remove(jailRoleId).catch(() => {});
    jailBackup.delete(message.author.id);

    const jailChannel = message.channel as TextChannel;
    jailChannel
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setDescription(`✅ ${message.author} a écrit **LEGIT** — sorti de jail.`),
        ],
      })
      .catch(() => {});
    return;
  }

  // =========================
  // MENTION → AFFICHE LE PREFIX
  // =========================
  const isMention =
    message.content === `<@${client.user!.id}>` ||
    message.content === `<@!${client.user!.id}>`;

  if (isMention) {
    const mentionEmbed = new EmbedBuilder()
      .setColor(0x5dade2)
      .setTitle("👋 Salut !")
      .setDescription(
        `Mon préfixe sur ce serveur est **\`${PREFIX}\`**\n\nTape **\`${PREFIX}help\`** pour voir toutes mes commandes.`
      )
      .setThumbnail(client.user!.displayAvatarURL({ size: 256 }))
      .setFooter({ text: `Demandé par ${message.author.tag}` })
      .setTimestamp();
    return void message.reply({ embeds: [mentionEmbed] });
  }

  // =========================
  // PREFIX CHECK
  // =========================
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();
  if (!cmd) return;

  // =========================
  // HELP
  // =========================
  if (cmd === "help") {
    const helpEmbed = new EmbedBuilder()
      .setColor(0x5dade2)
      .setTitle("📌 Commandes du bot")
      .addFields(
        {
          name: "🔨 Modération",
          value: [
            "`+warn @membre` — Avertir un membre",
            "`+unwarn @membre` — Retirer les warns d'un membre",
            "`+mute @membre` — Rendre muet un membre",
            "`+unmute @membre` — Retirer le mute d'un membre",
            "`+ban @membre` — Bannir un membre",
            "`+unban <id>` — Débannir un membre par ID",
            "`+jail @membre` — Mettre un membre en jail",
            "`+unjail @membre` — Sortir un membre de jail",
            "`+addrole @membre @role` — Donner un rôle",
            "`+removerole @membre @role` — Retirer un rôle",
            "`+lockdown` — 🔒 Verrouiller tous les salons",
            "`+lockdown off` — 🔓 Déverrouiller tous les salons",
          ].join("\n"),
        },
        {
          name: "🧰 Utilitaires",
          value: [
            "`+ping` — Vérifier si le bot répond",
            "`+afk [raison]` — Se mettre en AFK",
            "`+clears <nombre>` — Supprimer X messages (max 100)",
            "`+dm @membre message` — Envoyer un DM à un membre",
            "`+userinfo [@membre]` — Voir les infos d'un membre",
            "`+serverinfo` — Voir les infos du serveur",
          ].join("\n"),
        },
        {
          name: "🛡 Automatique",
          value: "Anti-spam actif — mute automatique après 6 messages en 4 secondes",
        }
      )
      .setFooter({ text: `Demandé par ${message.author.tag}` })
      .setTimestamp();
    return void message.channel.send({ embeds: [helpEmbed] });
  }

  // =========================
  // PING
  // =========================
  if (cmd === "ping") {
    return void message.reply("🏓 Pong");
  }

  // =========================
  // AFK
  // =========================
  if (cmd === "afk") {
    afk.set(message.author.id, true);
    return void message.reply("💤 AFK activé");
  }

  // =========================
  // CLEAR
  // =========================
  if (cmd === "clears") {
    if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;
    const amount = parseInt(args[0] ?? "");
    if (!amount || amount < 1 || amount > 100) return;
    await message.delete().catch(() => {});
    await (message.channel as TextChannel).bulkDelete(amount, true).catch(() => {});
    return;
  }

  // =========================
  // DM USER
  // =========================
  if (cmd === "dm") {
    const user = message.mentions.users.first();
    if (!user) return;
    const msg = args.slice(1).join(" ");
    if (!msg) return;
    user.send(msg).catch(() => {});
    return;
  }

  // =========================
  // WARN / UNWARN
  // =========================
  if (cmd === "warn") {
    const user = message.mentions.users.first();
    if (!user) return;
    const count = (warns.get(user.id) ?? 0) + 1;
    warns.set(user.id, count);
    message.channel.send(`⚠️ Warn ${user.tag} (${count})`).catch(() => {});
    logMod?.send(`${user.tag} warn (${count})`).catch(() => {});
    return;
  }

  if (cmd === "unwarn") {
    const user = message.mentions.users.first();
    if (!user) return;
    warns.set(user.id, 0);
    message.channel.send(`✅ Warns réinitialisés pour ${user.tag}`).catch(() => {});
    return;
  }

  // =========================
  // MUTE / UNMUTE
  // =========================
  if (cmd === "mute") {
    const user = message.mentions.members?.first();
    if (!user) return;
    let role: Role | undefined = message.guild.roles.cache.find(
      (r) => r.name === MUTED_ROLE_NAME
    );
    if (!role) {
      role = await message.guild.roles.create({ name: MUTED_ROLE_NAME, permissions: [] });
    }
    await user.roles.add(role).catch(() => {});
    message.channel.send(`🔇 ${user.user.tag} a été mute.`).catch(() => {});
    return;
  }

  if (cmd === "unmute") {
    const user = message.mentions.members?.first();
    if (!user) return;
    const role = message.guild.roles.cache.find((r) => r.name === MUTED_ROLE_NAME);
    if (role) await user.roles.remove(role).catch(() => {});
    message.channel.send(`🔊 ${user.user.tag} a été unmute.`).catch(() => {});
    return;
  }

  // =========================
  // BAN / UNBAN
  // =========================
  if (cmd === "ban") {
    const user = message.mentions.members?.first();
    if (!user) return;
    await user.ban().catch(() => {});
    message.channel.send(`🔨 ${user.user.tag} a été banni.`).catch(() => {});
    return;
  }

  if (cmd === "unban") {
    const id = args[0];
    if (!id) return;
    await message.guild.members.unban(id).catch(() => {});
    message.channel.send(`✅ <@${id}> a été débanni.`).catch(() => {});
    return;
  }

  // =========================
  // ADDROLE / REMOVEROLE
  // =========================
  if (cmd === "addrole") {
    const user = message.mentions.members?.first();
    const role = message.mentions.roles.first();
    if (!user || !role) return;
    await user.roles.add(role).catch(() => {});
    message.channel.send(`✅ Rôle ${role.name} ajouté à ${user.user.tag}.`).catch(() => {});
    return;
  }

  if (cmd === "removerole") {
    const user = message.mentions.members?.first();
    const role = message.mentions.roles.first();
    if (!user || !role) return;
    await user.roles.remove(role).catch(() => {});
    message.channel.send(`✅ Rôle ${role.name} retiré de ${user.user.tag}.`).catch(() => {});
    return;
  }

  // =========================
  // LOCKDOWN / UNLOCK
  // =========================
  if (cmd === "lockdown") {
    const isOff = args[0]?.toLowerCase() === "off";
    const everyoneRole = message.guild.roles.everyone;

    const textChannels = message.guild.channels.cache.filter(
      (ch) =>
        ch.type === ChannelType.GuildText ||
        ch.type === ChannelType.GuildAnnouncement
    );

    // FIX: utilise Promise.all + await — le forEach original n'attendait pas les permissions
    await Promise.all(
      textChannels.map(async (ch) => {
        const channel = ch as TextChannel;
        try {
          if (isOff) {
            await channel.permissionOverwrites.edit(everyoneRole, {
              SendMessages: null,
            });
          } else {
            await channel.permissionOverwrites.edit(everyoneRole, {
              SendMessages: false,
            });
            await channel.permissionOverwrites.edit(STAFF_ROLE_ID, {
              SendMessages: true,
            });
          }
        } catch {
          // salon ignoré si permissions insuffisantes
        }
      })
    );

    message.channel
      .send(
        isOff
          ? "🔓 Serveur déverrouillé — tout le monde peut parler."
          : `🔒 Serveur en lockdown — seul le staff peut parler.`
      )
      .catch(() => {});
    return;
  }

  // Alias +unlock = +lockdown off
  if (cmd === "unlock") {
    const everyoneRole = message.guild.roles.everyone;
    await Promise.all(
      message.guild.channels.cache
        .filter(
          (ch) =>
            ch.type === ChannelType.GuildText ||
            ch.type === ChannelType.GuildAnnouncement
        )
        .map(async (ch) => {
          try {
            await (ch as TextChannel).permissionOverwrites.edit(everyoneRole, {
              SendMessages: null,
            });
          } catch {
          }
        })
    );
    message.channel.send("🔓 Serveur déverrouillé.").catch(() => {});
    return;
  }

  // =========================
  // USERINFO
  // =========================
  if (cmd === "userinfo") {
    const target = message.mentions.members?.first() ?? member;
    const user = target.user;

    const roles = target.roles.cache
      .filter((r) => r.id !== message.guild!.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => `<@&${r.id}>`)
      .slice(0, 10)
      .join(" ") || "Aucun";

    const joinedAt = target.joinedAt
      ? `<t:${Math.floor(target.joinedAt.getTime() / 1000)}:D>`
      : "Inconnu";
    const createdAt = `<t:${Math.floor(user.createdAt.getTime() / 1000)}:D>`;

    const userinfoEmbed = new EmbedBuilder()
      .setColor(0x5dade2)
      .setTitle(`👤 Informations — ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "🪪 Identifiant", value: `\`${user.id}\``, inline: true },
        { name: "📛 Pseudo serveur", value: target.displayName, inline: true },
        { name: "📅 Compte créé le", value: createdAt, inline: true },
        { name: "📥 A rejoint le", value: joinedAt, inline: true },
        {
          name: "🤖 Bot",
          value: user.bot ? "Oui" : "Non",
          inline: true,
        },
        {
          name: `🎭 Rôles (${target.roles.cache.size - 1})`,
          value: roles,
        }
      )
      .setFooter({ text: `Demandé par ${message.author.tag}` })
      .setTimestamp();

    return void message.channel.send({ embeds: [userinfoEmbed] });
  }

  // =========================
  // SERVERINFO
  // =========================
  if (cmd === "serverinfo") {
    const guild = message.guild;
    await guild.fetch().catch(() => {});

    const owner = await guild.fetchOwner().catch(() => null);
    const createdAt = `<t:${Math.floor(guild.createdAt.getTime() / 1000)}:D>`;
    const totalMembers = guild.memberCount;
    const bots = guild.members.cache.filter((m) => m.user.bot).size;
    const humans = totalMembers - bots;
    const textChannels = guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildText
    ).size;
    const voiceChannels = guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildVoice
    ).size;
    const roles = guild.roles.cache.size - 1;
    const boosts = guild.premiumSubscriptionCount ?? 0;
    const boostLevel = guild.premiumTier;

    const serverEmbed = new EmbedBuilder()
      .setColor(0x5dade2)
      .setTitle(`🌐 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
      .addFields(
        { name: "🪪 ID", value: `\`${guild.id}\``, inline: true },
        { name: "👑 Propriétaire", value: owner ? `${owner.user.tag}` : "Inconnu", inline: true },
        { name: "📅 Créé le", value: createdAt, inline: true },
        { name: "👥 Membres", value: `${humans} humains • ${bots} bots`, inline: true },
        { name: "💬 Salons texte", value: `${textChannels}`, inline: true },
        { name: "🔊 Salons vocaux", value: `${voiceChannels}`, inline: true },
        { name: "🎭 Rôles", value: `${roles}`, inline: true },
        { name: "🚀 Boosts", value: `${boosts} boost(s) — Niveau ${boostLevel}`, inline: true },
      )
      .setFooter({ text: `Demandé par ${message.author.tag}` })
      .setTimestamp();

    return void message.channel.send({ embeds: [serverEmbed] });
  }

  // =========================
  // JAIL / UNJAIL
  // =========================
  if (cmd === "jail") {
    const user = message.mentions.members?.first();
    if (!user) return;

    jailBackup.set(user.id, user.roles.cache.map((r) => r.id));
    await user.roles.set([jailRoleId]).catch(() => {});

    const jailChannel = message.guild.channels.cache.get(jailChannelId) as
      | TextChannel
      | undefined;
    jailChannel
      ?.send(
        `🔒 ${user} tu as été mis en jail.\nÉcris **LEGIT** pour sortir.`
      )
      .catch(() => {});
    return;
  }

  if (cmd === "unjail") {
    const user = message.mentions.members?.first();
    if (!user) return;

    const roles = jailBackup.get(user.id);
    if (roles) await user.roles.set(roles).catch(() => {});
    else await user.roles.remove(jailRoleId).catch(() => {});

    message.channel.send(`✅ ${user.user.tag} sorti de jail.`).catch(() => {});
    return;
  }
});

// =========================
// EXPORT
// =========================
export function startBot(): void {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) {
    logger.error("DISCORD_TOKEN manquant — bot non démarré");
    return;
  }
  client.login(token).catch((err: unknown) => {
    logger.error({ err }, "Échec de connexion du bot Discord");
  });
}
