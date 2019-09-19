/*
*              Comment Legends
*******************************************
*   TODO - Things to do in this update
*UPGRADE - Ideas written down for upgrade
*******************************************
*
*        Some Ideas for Next Update
*******************************************
*Remove Chatfuel digest and replace it with
*broadcast system which would send new
*beatmaps as lists
*
*(Adding to the idea above) Add an option 
*for the user to unsubscribe
*
*Add more beatmap categories (WIP, Loved,
*etc.)
*
*Add available modes to the pics of the 
*beatmaps
*/

// server.js
// where your node app starts

// init project
const express = require('express');
const app = express();
const chatfuelbroadcast = require('chatfuel-broadcast');
const bodyParser = require('body-parser');
const multer = require('multer');
const url = require('url');
const https = require('https');
const htmlToJson = require('html-to-json');
const fs= require('fs');
const xmlbuilder=require('xmlbuilder');
const winston = require('winston');
const sqlite=require('sqlite3').verbose();
const upload=multer();

// we've started you off with Express, 
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

app.set('trust proxy', true); 

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(upload.array()) 

var dbFilePath="./.data/osuFeedData.db";
var exists=fs.existsSync(dbFilePath);
var db=new sqlite.Database(dbFilePath);

db.serialize(function(){
  if(!exists)
    {
      db.run("CREATE TABLE Subscribers ( "+
             "messenger_user_id INT PRIMARY KEY, "+
             "subscribed_categories TEXT NOT NULL)")
      console.log("Table has been created!")
    }
});

function cfbroadcast(options,userIdArr,res, Count, errmsg) {
  let userId=userIdArr[Count];
  options.userId=userId;
  chatfuelbroadcast(options)
    .then(() => 
    {
      if(Count==userIdArr.length-1)
      {
        let errcount=errmsg.length;
        let successcount=userIdArr.length-errcount;
        if(successcount==1)
        {
          errmsg[errcount]="Finished sending the messages for "+successcount+" user.";
        }
        else
        {
          errmsg[errcount]="Finished sending the messages for "+successcount+" users.";
        }
        res.send(errmsg);
        console.log(errmsg);
      }
      else
      {
        setTimeout(cfbroadcast.bind(null,options,userIdArr, res, Count+1, errmsg),50);
      }
    }
    ,(error) =>
    {
    let msg;
      if(error.name==="StatusCodeError")
      {
        const HtmlErrorCode = FindPhrase(error.message, " ", true);
        
        if(HtmlErrorCode==422 || HtmlErrorCode==401) 
        {
          msg=error.message.slice(6);
          let errobj=JSON.parse(msg);
          msg=FindPhrase(errobj.result, ":", false).slice(1);
        }
        else
        {
          msg=error.message;
        }
      }
      else
      {
        msg=error.message;
      }
      errmsg[errmsg.length]=msg+" for messenger id : "+userId;
      if(Count==userIdArr.length-1)
      {
        let errcount=errmsg.length;
        let successcount=userIdArr.length-errcount;
        if(successcount<=0)
        {
          errmsg[errcount]="Couldn't send any messages.";
        }
        else if(successcount==1)
        {
          errmsg[errcount]="Finished sending the messages for "+successcount+" user.";
        }
        else
        {
          errmsg[errcount]="Finished sending the messages for "+successcount+" users.";
        }
        res.send(errmsg);
        console.log(errmsg);
      }
      else
      {
        setTimeout(cfbroadcast.bind(null,options,userIdArr, res, Count+1,errmsg),50);
      }
    })
}

/**
 *  This function will find phrases with respective to the provided character within the given string. 
 *  Note : This function will only find the frst character of the string.
 *  @param msg The string to be searched.
 *  @param character The character to be searched within the string.
 *  @param before The boolean parameter. 
 *         If it's true, this function will return the phrases before the provided character.
 *         If not, the function will reutn the phrases behind it.
 *  @return The phrases before or after the provided character from the string.
 */
function FindPhrase (msg, character, before) {
  let CharacterFound=false;
  let CharacterPosition=0;
  for(CharacterPosition; !CharacterFound && CharacterPosition<msg.length; CharacterPosition++) {
    CharacterFound=(msg.charAt(CharacterPosition)==character);
  }
  if(before)
  {
    return msg.slice(0, CharacterPosition);
  }
  else
  {
    return msg.slice(CharacterPosition);
  }
}

// http://expressjs.com/en/starter/basic-routing.html
app.get('/', function(request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get('/ranked/feed/generate', (req, res) => {
  htmlToJson.request('https://osu.ppy.sh/beatmapsets', {
    'beatmapsets':function (result) {
      let beatmaps_data=JSON.parse(
        result.find('#json-beatmaps').text()
                                  );
      return beatmaps_data;
    }
  }, function (err, result) {
    if(err) console.error(err);
  }).then((filtered_data) => {
    let beatmapsets=filtered_data.beatmapsets.beatmapsets, item=[];
    let beatmaps_link='https://osu.ppy.sh/beatmapsets';
      
    for(let beatmapset of beatmapsets)
    {
      let title, description="", link, guid,pubDate, image;
      title="\""+beatmapset.title+"\" by "+beatmapset.artist;
      if(beatmapset.source&&beatmapset.source!="")
        description='Song from '+beatmapset.source+'. ';
      let mode= [];
      for(let beatmap of beatmapset.beatmaps)
      {
        if(!mode.includes(beatmap.mode_int))
        {
          mode.push(beatmap.mode_int);
        }
      }
      mode.sort();
      mode = mode.map((mode_int)=> {
        switch(mode_int)
        {
          case 0: return "osu!";
          case 1: return "osu!taiko";
          case 2: return "osu!catch";
          case 3: return "osu!mania";
        }
      });
      
      if(mode.length==1)
      {
        description+=mode[0]+" mode available. ";
      }
      else if(mode.length>1)
      {
        for(let index=0; index<mode.length; index++)
        {
          description+=mode[index];
          if(index==mode.length-2)
            description+=' and ';
          else if (index==mode.length-1)
            description+=' modes available. ';
          else
            description+=', ';
        }
      }
      
      description+="Map created by \""+beatmapset.creator+"\".";
      
      link=guid=beatmaps_link+'/'+beatmapset.id;
      pubDate=Math.max(Date.parse(beatmapset.submitted_date),
                       Date.parse(beatmapset.last_updated),
                       Date.parse(beatmapset.ranked_date));
      pubDate=new Date(pubDate).toUTCString().slice(0,-3)+"+0000";
      image={'@url':beatmapset.covers['cover@2x'], '@type':'image/jpg'};
      
      item.push( { 
        title,
        description,
        link,
        guid,
        pubDate,
        'media:content':image
      });
    }
    
    var mostRecentBeatmapLink=item[0].link;
    
    let image={
      url:"https://cdn.glitch.com/4aa329c1-a2bb-44ed-8533-f6bca913d8eb%2Fosu%20logo.jpg?1531565922725",
      link:beatmaps_link,
      title:"Osu! Beatmaps Listing"
              };
    
    let channel = {
      'atom:link': {
      	'@href':req.protocol+"://"+req.get('host')+"/ranked/feed",
      	'@rel':"self",
      	'@type':"application/rss+xml"
      },
      title: "Osu! Beatmaps Listing",
      link:beatmaps_link,
      description:"List of Osu! ranked and approved beatmap sets.",
      image,
      item
    };
    let rss = xmlbuilder.create('rss',{version:'1.0',encoding: 'UTF-8'})
                        .att('version','2.0')
                        .att('xmlns:atom','http://www.w3.org/2005/Atom')
                        .att('xmlns:media','http://search.yahoo.com/mrss/');
    
    rss=rss.ele({channel}).end({pretty:true});
    fs.writeFile(__dirname+'/ranked_rss.xml',rss, (err)=> {
      if (err)
      {
        logger.info(err);
        res.send(err);
        return;
      }
      res.send('Writing to ranked_rss.xml successful.');
      console.log('Writing to ranked_rss.xml successful.');
    });
    
    var savedBeatmapLink=fs.readFileSync('savedBeatmapLink.txt','utf8');
    
    if(savedBeatmapLink!=mostRecentBeatmapLink) {
      fs.writeFile('savedBeatmapLink.txt',mostRecentBeatmapLink,(err)=>{
        if(err) {
          console.log(err);
        }
        else {
          console.log(mostRecentBeatmapLink);
          const options={
            hostname:req.get('host'),
            port:443,
            path:'/broadcast',
            method:'POST'
          };
          
          const httpsReq=https.request(options,(httpsRes)=>{
            httpsRes.on('data',data=>{
              console.log("HTTPS request response: \""+data.toString('utf8')+"\"");
            });
          });
          httpsReq.on('error',error=>console.log(error));
          httpsReq.end();
        }
      });
    }
  });
});

app.post('/subscribe',(req,res)=> {
  let query = url.parse(req.url, true).query;
  query = Object.assign({}, query, req.body);
  let messengerId=query['messenger user id'];
  let feedCategories='ranked';             //UPGRADE add other categories
  let responseMsg,textMsg,btnTitle,blockName;
  db.exec(`INSERT INTO Subscribers
                VALUES (${messengerId},"${feedCategories}")`,
   function(err){
    if(err) {
      console.log(err);
      textMsg="Oops, I encountered a problem subscribing you. "+
        "Maybe have a cup of coffee while my developer resolves the problem. "+
        "Click the button below to subscribe again after your coffee!";
      blockName="Subscribe to Ranked on Glitch.com";
      btnTitle="Please click me!";
    /*} UPGRADE
    **Uncomment this code block after you have upgraded the digest system**
    else {
      textMsg="You have successfully subscribed to Osu! Beatmap feed! "+
        "Now, you will be notified every time a new beatmap comes out! "+
        "You can click the button below to see the lastest beatmaps on Osu!";
      blockName="Ranked Beatmaps RSS";
      btnTitle="Latest Beatmaps";
    }
    */
    let button={
      "type": "show_block",
      "block_names": [blockName],
      "title": btnTitle
    };

    let payload={
      "template_type": "button",
      text:textMsg,
      buttons:[button]
    };

    let attachment={
      type:"template",
      payload
    };

    let messages=[{attachment}];
    responseMsg={messages};
    }                     //UPGRADE delete this line and else code block below if you are uncommenting the above code block
    else {
      responseMsg={"redirect_to_blocks":["Subscribe to Ranked RSS"]}
    }
    res.send(responseMsg);
  });
});
app.get('/delete',(req,res)=>{
  db.exec('DELETE FROM Subscribers');
  res.send("Yes")
})
app.post('/broadcast',(req,res)=> {
  let query = url.parse(req.url, true).query;
  query = Object.assign({}, query, req.body);
  let blockName="Digest";                     //UPGRADE change name when upgrading the digest system
  let messageTag="GAME_EVENT";
  let botId = process.env.botId;
  let token = process.env.token;
  let options={botId, token,messageTag, blockName};
  db.all('SELECT messenger_user_id AS userId FROM Subscribers',(err,rows)=>{
    if(err){ 
      console.log(err);
      res.send(err);
    }
    else if(!rows || rows.length<=0) {
      console.log("No subscribers found.");
      res.send("No subscribers found.")
    }
    else {
      console.log(rows)
      let userIdArr=rows.map(row=>row.userId);
      cfbroadcast(options, userIdArr, res, 0, []);
    }
  });
})

app.get('/ranked/feed',(req,res) => {
  res.type('application/xml');
  res.sendFile(__dirname+'/ranked_rss.xml');
});



const timestamp = () => (new Date()).toLocaleTimeString('en-GB', { timeZone: 'Asia/Yangon' });
const logger = new (winston.createLogger)({
  transports: [
    new (winston.transports.Console)({
      timestamp,
      level: 'info'
    }),
    new (winston.transports.File)({
      filename: 'winston.log',
      timestamp,
      level: 'info'
    })
  ]
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
