const admin = require("firebase-admin");
const gcs = require('@google-cloud/storage')();
// const spawn = require('child-process-promise').spawn;
const imagemagick = require('imagemagick');
const os = require('os');
const path = require('path');
const realFs = require('fs');
const mkdirp = require('mkdirp');
const fs = require('graceful-fs');
fs.gracefulify(realFs);

const serviceAccount = require("./credentials.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://universalgamemaker.firebaseio.com",
  storageBucket: 'universalgamemaker.appspot.com'
});

const db = admin.database();
const storage = admin.storage().bucket();
const dbRef = db.ref("/gameBuilder");

const db_outfile = "database.json";
const images_outfile = "image_data.json";

// 1) download all images locally and also our entire db (as a json file)
// 2) run image magic on all images locally using two quality levels (converting PNG to jpg, to measure what can be gained by that)
// 3) do everything locally without needing to deal with promises at all :)

// Game name |
// Original size in KB |
// Size for quality=70 without compressing PNGs |
 // Size for quality=70 without compressing PNGs |
 // Size for quality=70 with compressing PNGs as JPGs |
 // Size for quality=70 with compressing PNGs as JPGs

function downloadDatabase(){
  let database_json = {};
  dbRef.once("value", (gameBuilder) => {
    const specs = gameBuilder.child('gameSpecs');
    const elements = gameBuilder.child('elements');
    const images = gameBuilder.child('images');

    database_json["specs"] = specs.toJSON();
    database_json["elements"] = elements.toJSON();
    database_json["images"] = images.toJSON();
    specs.forEach((spec) =>{
      let json = spec.child('pieces').toJSON();
      if(typeof json == "string"){ //it's a badly formatted array!
        let array_obj = JSON.parse(database_json["specs"][spec.key]["pieces"]);
        let build = {};
        for(let i = 0; i < array_obj.length; i++){
          build[i] = array_obj[i];
        }
        database_json["specs"][spec.key]["pieces"] = build;
      }
    });
    fs.writeFileSync(db_outfile, JSON.stringify(database_json, null, 2));
    console.log("Saved JSON to", outfile);
  });
}

function downloadImages(){
  storage.getFiles(function(err, files){
    files.forEach((file) =>{
      file.download({
        destination: file.name
      },(err) =>{
        console.log("Downloaded file to", file.name);
      });
    });
  });
}

function getGameData(){
  let game_data = {}; // {gameName: {board:___, nonBoard: [__,___]}}
  const string = fs.readFileSync(db_outfile);
  const obj = JSON.parse(string);

  const specs = obj['specs'];
  const images = obj['images'];
  const elements = obj['elements'];

  for(let specId in specs) {
    const name = specs[specId]['gameName'];
    const imageId = specs[specId]['board']['imageId'];
    const imagePath = images[imageId]['cloudStoragePath'];

    game_data[name] = {};
    game_data[name]['board'] = imagePath;
    game_data[name]['nonboard'] = [];

    const pieces = specs[specId]['pieces'];
    for(let element in pieces){
      const elementId = pieces[element]['pieceElementId'];
      const image_set = elements[elementId]['images'];
      for(let image in image_set){
        const imageId = image_set[image]['imageId'];
        const imgPath = images[imageId]['cloudStoragePath'];
        game_data[name]['nonboard'].push(imgPath);
      }
    }
  }
  fs.writeFileSync(images_outfile, JSON.stringify(game_data, null, 2));
  console.log("Wrote game image data to", images_outfile);
  return game_data;
}

function generateStats(){
  let stats = {}; //{gameName: {original : ___, }}
  const extensions = ['.jpg', '.png', '.jpeg'];
  const dir50 = "images/50";
  const dir70 = "images/70";
  const str = fs.readFileSync(images_outfile);
  const game_data = JSON.parse(str);

  for (let game in game_data) {
    if (game_data.hasOwnProperty(game)) {
      const data = game_data[game];
      const board_file = data['board'];
      const nonboard_files = data['nonboard'];

      // original summed size
      let size_sum = 0;
      let size = getFilesizeInBytes(board_file);
      size_sum += size;
      for(let i = 0; i < nonboard_files.length; i++){
        let filename = nonboard_files[i];
        size_sum += getFilesizeInBytes(filename);
      }
      stats[game] = {};
      stats[game]['original'] = bytesToSize(size_sum);

      size_sum = 0;

      // convert board to JPG if it isn't a JPG already
      if(path.extname(board_file) != ".jpg"){
        const ext = path.extname(board_file);
        let filename = path.basename(board_file, ext);
        filename += ".jpg";
        let outpath = "./images/boardToJPG/" + game.replace(/ /g, '');
        let finalpath = path.join(outpath, filename);
        mkdirp(outpath, (err) =>{
          if(err) throw err;
          imagemagick.convert([board_file, finalpath], (err, stdout) =>{
            if (err) throw err;
            console.log("Converted image");
          });
        });
      }

      // convert non-board images to q70
      for(let i = 0; i < nonboard_files.length; i++){
        const file = nonboard_files[i];
        let filename = path.basename(file);
        let outpath = "./images/q70/uncompressed/" + game.replace(/ /g, '');
        let finalpath = path.join(outpath, filename);
        mkdirp(outpath, (err) => {
          if(err) throw err;
          imagemagick.convert([file, '-quality', '70', finalpath], (err, stdout) =>{
            if (err) throw err;
            else{
              console.log("Converted image", i);
            }
          });
        });
      }
        // find the sum of all new file sizes
      // convert non-board images to q50
        // find the sum of all new file sizes

      // convert non-board images to JPG with q70
        // find the sum of all new file sizes

      // convert non-board images to JPG with q50
        // find the sum of all new file sizes
        // process.exit(0);


    }
  }

}
// Taken from: https://techoverflow.net/2012/09/16/how-to-get-filesize-in-node-js/
function getFilesizeInBytes(filename) {
    const stats = fs.statSync(filename);
    const fileSizeInBytes = stats.size;
    return fileSizeInBytes;
}
// Taken from: https://stackoverflow.com/questions/15900485/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript
function bytesToSize(bytes) {
   var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
   if (bytes == 0) return '0 Byte';
   var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
   return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

function main(){
  // downloadDatabase();
  // downloadImages();
  // getGameData();
  // generateStats();
  // admin.app().delete();
}

main();
