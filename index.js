/*Variable area*/

var http = require('http');
var finalhandler = require('finalhandler');
var serveStatic = require('serve-static');

var serve = serveStatic('public', {'index': ['index.html', 'index.htm']})

http.createServer(function (req, res) { 
    res.writeHead(200, {'Content-Type': 'text/plain'});
    serve(req, res, finalhandler(req, res));
    res.end('Hello! Was I asleep? Sorry, Heroku is very particular about sleeping apps.\n'); 
}).listen(process.env.PORT || 5000);

var Discord = require('discord.io');
var bot = new Discord.Client({
    token: "MjQ2MDI2MDQwNTA4NTQ3MDcy.CwUtmg.WAlGCQ9QyImc9t4FLTOOqzZia2c",
    autorun: true
});

var success = "Success", failure = "Failure", advantage = "Advantage", threat = "Threat", triumph = "Triumph", despair = "Despair", blank = "Blank", light = "Light", dark = "Dark";

// var diceEM = {
// 	"a":dice.ability,
// 	"d":dice.difficulty,
// 	"s":dice.setback,
// 	"b":dice.boost,
// 	"p":dice.proficiency,
// 	"c":dice.challenge,
// 	"f":dice.force
// }

var serverDice = {};
var serverSymbols = {};

// var symbols = dice.symbols;

function resultIs(result) {
    return function(target) {
        return result == target;
    }
}

function setupServer(serverID) {
    var server = bot.servers[serverID];
    var newConfig = require('./dice.js');
    var diceEM = {
        "a":newConfig.ability,
        "d":newConfig.difficulty,
        "s":newConfig.setback,
        "b":newConfig.boost,
        "p":newConfig.proficiency,
        "c":newConfig.challenge,
        "f":newConfig.force
    }
    var symbols = newConfig.symbols;
    var serverEmojis = server.emojis;
    console.log(serverEmojis);
    Object.keys(diceEM).forEach(function(dieKey) {
        diceEM[dieKey].forEach(function(side){
            var emoji = Object.keys(serverEmojis).find(function(it){
                return (serverEmojis[it].name === side.face);
            });
            emoji = serverEmojis[emoji];
            if (emoji) {
                side.code = "<:"+emoji.name+":"+emoji.id+">";
            }
        });
    });
    Object.keys(symbols).forEach(function(symbol) {
        var emoji = Object.keys(serverEmojis).find(function(it){
            return (serverEmojis[it].name === symbols[symbol].name);
        });
        emoji = serverEmojis[emoji];
        if (emoji) {
            symbols[symbol].code = "<:"+emoji.name+":"+emoji.id+">";
        }
    });

    serverDice[serverID] = diceEM;
    serverSymbols[serverID] = symbols;
    serverSetup[serverID] = true;

}

var diceMatch = /!Roll\[([adpcfbs]*)\]/;
var destinyMatch = /!Flip ((Dark)|(Light))/;
var poolMatch = /!Roll Destiny/;
var clearMatch = /!Reset Destiny/;
var showMatch = /!Show Destiny/;
var emojiCodes = /Copy Me Too \\</;

var pool = [];

var serverSetup = {};

/*Event area*/

bot.on("ready", function(event) {
    console.log("Connected!");
    console.log("Logged in as: ");
    console.log(bot.username + " - (" + bot.id + ")");
    setTimeout(console.log, 9000, bot.inviteURL);
});

bot.on("message", function(user, userID, channelID, message, event) {
    console.log(process.env.maintenance);
    if (process.env.maintenance === "true"){
        console.log("Ignoring message, in maintenance mode.");
        return;
    }
    console.log(user + " - " + userID);
//    console.log("in " + channelID);
    console.log(message);
    console.log("----------");
    console.log("Server ID" + bot.channels[channelID].guild_id); //Woot! Thanks Discord.io discord!
    var serverID = bot.channels[channelID].guild_id;
    Object.keys(serverDice).forEach(function(thing) {
        console.log(thing);
    });
    if(!(serverID in serverDice)) {
        setupServer(serverID);
        console.log(serverSymbols[serverID]);
    }

    if (message === "ping") {
        sendMessages(channelID, [String.raw`\\:AbilBla:`]); //Sending a message with our helper function
    }
    
    if (message === "!ClearAll") {
        serverDice = {};
        serverSymbols = {};
        serverSetup = {};
        console.log(serverSymbols[serverID]);
        sendMessages(channelID, ["Clearing all saved emoji settings. I'll re-add them next time someone wants to roll."]);
    }

    if (message.match(poolMatch)) {
        if (!pool){
            pool = [];
        }
        var die = "f";
        var roll = Math.floor(Math.random() * serverDice[serverID][die].length);
        var result = serverDice[serverID][die][roll].result;
        pool = pool.concat(result);
        var returnMessage =  "```Adding (" + result.join(", ") + ") to destiny pool```";
        var poolMessage = "```Current destiny pool: " + pool.join(", ") + "```";
        sendMessages(channelID, [returnMessage, poolMessage]);
    }

    if (message.match(clearMatch)) {
        pool = [];	
        sendMessages(channelID, ["```Destiny Pool reset.```"]);
    }

    if (message.match(showMatch)) {
        // pool = [];	
        sendMessages(channelID, ["```Current destiny pool: " + pool.join(", ") + "```"]);
    }

    if (message.match(destinyMatch)) {
        var returnMessage = "```";
        console.log(message.indexOf("Dark"));
        console.log(message.indexOf("Light"));
        if (message.indexOf("Dark") !== -1) {
            if (pool.indexOf(dark) !== -1) {
                console.log("Dark Flip");
                returnMessage += "Flipping a Dark Side point, thunder rolls.";
                pool[pool.indexOf(dark)] = light;
            }
        } else if (message.indexOf("Light") !== -1) {
            if (pool.indexOf(light) !== -1) {
                console.log("Light Flip");
                returnMessage += "Flipping a Light Side point, fortune favours you.";
                pool[pool.indexOf(light)] = dark;
            }
        } else {
            returnMessage += "The Force is confused.";
        }
        returnMessage += "```";
        var poolMessage = "```Current destiny pool: " + pool.join(", ") + "```";
        sendMessages(channelID, [returnMessage, poolMessage]);
    }

    if (message.match(diceMatch)) {
        console.log("Saw Dice Message");
        
        var match = diceMatch.exec(message);
        var diceToRoll = match[1].split('');

        var results = [];
        diceToRoll.forEach(function(die) {
            if (serverDice[serverID][die]) {
                var roll = Math.floor(Math.random() * serverDice[serverID][die].length);
                results = results.concat(serverDice[serverID][die][roll]);
            }
        });
        var returnMessage = "";

        var diceResults = [];
        results.forEach(function(result) {
            returnMessage += result.code + " ";	
            diceResults = diceResults.concat(result.results)
        });
        console.log(diceResults);
        var triumphs = diceResults.filter(resultIs(triumph)).length;
        var despair = diceResults.filter(resultIs(despair)).length
        var successes = diceResults.filter(resultIs(success)).length + triumphs;
        var failures = diceResults.filter(resultIs(failure)).length + despair;
        var threats = diceResults.filter(resultIs(threat)).length;
        var advantages = diceResults.filter(resultIs(advantage)).length;
        var lightForce = diceResults.filter(resultIs(light)).length;
        var darkForce = diceResults.filter(resultIs(dark)).length;

        var successScale = successes - failures;
        var advantageScale = advantages - threats;

        var resultsMessage = "";
        if (successScale > 0) {
            for(var i=0; i < successScale; i++){
                resultsMessage += serverSymbols[serverID].success.code;
            }	
        } else if (successScale < 0) {
            for(var i=0; i < -successScale; i++){
                resultsMessage += serverSymbols[serverID].failure.code;
            }
        }

        if (advantageScale > 0) {
            for(var i=0; i < advantageScale; i++){
                resultsMessage += serverSymbols[serverID].advantage.code;
            }	
        } else if (advantageScale < 0) {
            for(var i=0; i < -advantageScale; i++){
                resultsMessage += serverSymbols[serverID].threat.code;
            }
        }

        for(var i=0; i < despair; i++){
            resultsMessage += serverSymbols[serverID].despair.code;
        }
        for(var i=0; i < triumphs; i++){
            resultsMessage += serverSymbols[serverID].triumph.code;
        }
        for(var i=0; i < lightForce; i++){
            resultsMessage += serverSymbols[serverID].light.code;
        }
        for(var i=0; i < darkForce; i++){
            resultsMessage += serverSymbols[serverID].dark.code;
        }
        console.log(returnMessage);
        sendMessages(channelID, [returnMessage,resultsMessage]);
    }
});

bot.on("disconnect", function() {
    console.log("Bot disconnected");
    bot.connect() //Auto reconnect
});

/*Function declaration area*/
function sendMessages(ID, messageArr, interval) {
    var resArr = [], len = messageArr.length;
    var callback = typeof(arguments[2]) === 'function' ?  arguments[2] :  arguments[3];
    if (typeof(interval) !== 'number') interval = 1000;

    function _sendMessages() {
        setTimeout(function() {
            if (messageArr[0]) {
                bot.sendMessage({
                    to: ID,
                    message: messageArr.shift()
                }, function(err, res) {
                    resArr.push(err || res);
                    if (resArr.length === len) if (typeof(callback) === 'function') callback(resArr);
                });
                _sendMessages();
            }
        }, interval);
    }
    _sendMessages();
}

function sendFiles(channelID, fileArr, interval) {
    var resArr = [], len = fileArr.length;
    var callback = typeof(arguments[2]) === 'function' ? arguments[2] : arguments[3];
    if (typeof(interval) !== 'number') interval = 1000;

    function _sendFiles() {
        setTimeout(function() {
            if (fileArr[0]) {
                bot.uploadFile({
                    to: channelID,
                    file: fileArr.shift()
                }, function(err, res) {
                    resArr.push(err || res);
                    if (resArr.length === len) if (typeof(callback) === 'function') callback(resArr);
                });
                _sendFiles();
            }
        }, interval);
    }
    _sendFiles();
}
