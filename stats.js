const admin = require("firebase-admin");
const gcs = require('@google-cloud/storage')();
// const spawn = require('child-process-promise').spawn;
const imagemagick = require('imagemagick');
const os = require('os');
const path = require('path');
const realFs = require('fs');
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
let database_json = {};
let statistics = {};

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
    game_data[name]['board'] = {imagePath};
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
}

function resizeImages(gameNames, boardImages){
  const extensions = ['.jpg', '.png', '.jpeg'];
  const dir50 = "images/50";
  const dir70 = "images/70";

  fs.readdir('images', function(err, list){
    list.forEach((file) => {
      // BOARD IMAGES COMPRESSED AS JPGS
      // NON-BOARD JPGS COMPRESSED
      const ext = path.extname(file);
      const name = path.basename(file, ext);
      if(extensions.indexOf(ext) >= 0){
        const filename50 = path.join()
        // imagemagick.convert([file, ])
      }
    });
  });
}


function main(){
  // downloadDatabase();
  // downloadImages();
  getGameData();
  // resizeImages(gameNames, boardImages);
  // admin.app().delete();
}

main();
