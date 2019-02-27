const { resolve } = require('path');
const walk = require('walk');
const ms = require('parse-ms');
const { Collection } = require('discord.js');

class Handler {
    constructor(options) {

        this.commands = new Collection();
        this.aliases = new Collection();
        this.cooldowns = new Map();
        this.owner = options.owner || null;
        options.client.handler = this;


        const walkCmd = walk.walk(options.cmdDir);
        walkCmd.on('file', (root, stats, next) => {
            if(!stats.name.endsWith('.js')) return;
            console.log(`[EzCmds] Command Loaded: ${stats.name}`);

            const cmd = require(`${resolve(root)}/${stats.name}`);
            cmd.help.path = `${resolve(root)}/${stats.name}`;

            if(cmd.help.aliases) {
                for(let i = 0; i < cmd.help.aliases.length; i++) {
                    this.aliases.set(cmd.help.aliases[i].toLowerCase(), cmd);
                }
            }

            this.commands.set(cmd.help.name.toLowerCase(), cmd);
            next();
        });

        if (options.evtDir) {
            const w = walk.walk(options.evtDir);
            w.on("file", (root, stats, next) => {
              if (!stats.name.endsWith(".js")) return;
              const Event = require(`${resolve(root)}/${stats.name}`);
              const name = stats.name.substring(0, stats.name.length - 3);
              options.client.on(name, (...args) =>
                Event.run(options.client, ...args)
              );
              console.log(`[EzCmds] Event Loaded: ${name}`);
              next();
            });
          }

    }

    async run (cmd, client, message, args, ...extras) {

        if(!this.commands) return null;

        const file = this.commands.get(cmd.toLowerCase()) || this.aliases.get(cmd.toLowerCase());
        if(!file) return null;

        if(file.help.cooldown) {
            const check = this.cooldowns.get(`${message.author.id}_${message.guild.id}_${cmd.toLowerCase()}`);
            if(check && file.help.cooldown - (Date.now() - check) > 0) {
                const obj = ms(file.help.cooldown - (Date.now() - check));
                return message.channel.send(`You must wait another ${obj.days > 0 ? `${obj.days}d ` : ''}${obj.hours > 0 ? `${obj.hours}h ` : ''}${obj.minutes > 0 ? `${obj.minutes}m ` : ''}${obj.seconds > 0 ? `${obj.seconds}s ` : ''}${obj.milliseconds > 0 ? `${obj.milliseconds}ms` : ''} before using this command again. `);   
            }
            this.cooldowns.set(`${message.author.id}_${message.guild.id}_${cmd.toLowerCase()}`, Date.now());
        }

        if(this.owner) {
            if(file.ownerOnly && message.author.id !== this.owner) {
                return message.reply('You do not have access to this command.');
            }
        }

        if(file.botPerms && !file.botPerms.some(u => message.guild.me.hasPermission(u))) return message.channel.send(`I need the following permissions to execute this command: ${file.botPerms.join('`, `')}`);
        if(file.userPerms && !file.userPerms.some(u => message.member.hasPermission(u))) return message.channel.send(`You need the following permissions to run this command: ${file.userPerms.join('`, `')}`);

        if(file.guildOnly && !message.guild) return message.channel.send('This command does not work inside DM channels.');

        try {
            await file.run(client, message, args, ...extras);
        }catch(e) {
            message.reply('Something has gone wrong while executing this command.');
            console.log(e);
        }

    }
    
    
    


}

module.exports = Handler;