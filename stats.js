const admin = require("firebase-admin");
const gcs = require('@google-cloud/storage')();
const spawn = require('child-process-promise').spawn;
const os = require('os');
const path = require('path');
const fs = require('fs');
const serviceAccount = require("./credentials.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://universalgamemaker.firebaseio.com",
  storageBucket: 'universalgamemaker.appspot.com'
});
const db = admin.database();
const storage = admin.storage().bucket();

const dbRef = db.ref("/gameBuilder");
const outfile = "statistics.json";
let json = {}; // "{Monopoly: { cloudStoragePath : ____, metadata: {originalSize:__, quality70:__, quality70:__} }"

function getImageData(){
  return dbRef.once("value").then((gameBuilder) => {
    const specs = gameBuilder.child('gameSpecs');
    const elements = gameBuilder.child('elements');
    const images = gameBuilder.child('images');
    specs.forEach((gameSpec) => {
      const promises = [];
       //for each gameSpec object get its image data
      const elementIds = [];
      const imageIds = [];
      const gameName = gameSpec.child('gameName').val();
      json[gameName] = {};
      console.log("Game is: ", gameName);
      const pieces = gameSpec.child('pieces');
      // for each spec's piece, get its elementId
      pieces.forEach((piece) => {
        const elementId = piece.child('pieceElementId').val();
        elementIds.push(elementId);
      });

      //for each elementId get its imageIDs
      elementIds.forEach((elementId) =>{
        const imageRefs = elements.child(elementId).child('images');
        imageRefs.forEach((ref) =>{
          imageIds.push( ref.child('imageId').val() );
        });
      });

      ///for each imageId get its cloudStoragePath and perform conversions
      imageIds.forEach((imageId) =>{
        const isBoard = images.child(imageId).child('isBoardImage').val();
        const cloudPath = images.child(imageId).child('cloudStoragePath').val(); //images/dog.jpg
        const obj = {'cloudStoragePath' : cloudPath, 'metadata': {} };
        json[gameName] = obj;
        const JPEG_EXTENSION = '.jpg';
        const filename = cloudPath.split("/")[1]; //dog.jpg
        const file = filename.split(".")[0]; // dog
        const extension = filename.split(".")[1];
        const thumbFileName = file + JPEG_EXTENSION; // dog.jpg

        // Temporary paths for images
        const tempDir = os.tmpdir(); //tmp
        const tempFilePath = path.join(tempDir, filename); // tmp/dog.jpg
        const tempThumb = path.join(tempDir,  path.format( { name: file + "_thumb" , ext: JPEG_EXTENSION}) ); //tmp/dog_thumb.jpg
        const temp50 = path.join(tempDir, path.format( { name: file + "_50" , ext: extension} )); // /tmp/dog_50.jpg
        const temp70 = path.join(tempDir, path.format( { name: file + "_70" , ext: extension} )); // /tmp/dog_70.jpg

        // Paths in GCS for upload
        const filePath70 = path.join('images/quality70', filename);
        const filePath50 = path.join('images/quality50', filename);
        const thumbnailPath = path.join('images/thumbnail', thumbFileName);
        const fileRef = storage.file(cloudPath);

        // console.log("Resizing the image with path: ", cloudPath, ", name: ", filename, " and extension: ", extension);

        let promise = fileRef.download({
            destination: tempFilePath
        }).then(() => {
          json[gameName]['metadata']['original'] = getFileSize(tempFilePath);
          // console.log('Image downloaded locally to', tempFilePath);
          // console.log("Converting image to quality70");
          return spawn('convert', [tempFilePath, '-quality', '70', temp70]);
        }).then(() => {
          json[gameName]['metadata']['quality70'] = getFileSize(temp70);
          // console.log("Uploading quality70 image");
          return storage.upload(temp70, { destination: filePath70 });
        }).then(()=>{
          // console.log("Converting image to quality50");
          return spawn('convert', [tempFilePath, '-quality', '50', temp50]);
        }).then(()=>{
          json[gameName]['metadata']['quality50'] = getFileSize(temp70);
          // console.log("Uploading quality50 image");
          return storage.upload(temp50, { destination: filePath50});
        }).then(()=>{
          // console.log('Converting image to thumbnail');
          return spawn('convert', [tempFilePath, '-thumbnail', '200x200>', tempThumb]);
        }).then(()=>{
          // console.log("Uploading thumbnail");
          return storage.upload(tempThumb, { destination: thumbnailPath });
        }).then(() =>{
          // console.log("Unlinking temp files");
          fs.unlinkSync(tempFilePath);
          fs.unlinkSync(tempThumb);
          fs.unlinkSync(temp70);
          fs.unlinkSync(temp50);
          return true;
        }).catch(err =>{
          return true;
        });
        return Promise.all([promise]);

      }); //imageIds forEach
    }); //specs forEach
  }).catch(err =>{  //db .once
    console.log(err);
    return;
  });
}

// Taken from: https://gist.github.com/narainsagar/5cfd315ab38ba363191b63f8ae8b27db
function getFileSize(filePath) {
  var stats = fs.statSync(filePath);
  // console.log('stats', stats);
  var size = stats["size"];
  // convert it to humanly readable format.
  var i = Math.floor( Math.log(size) / Math.log(1024) );
  return ( size / Math.pow(1024, i) ).toFixed(2) * 1 + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
}

getImageData().then(() =>{
  console.log(json);
  fs.writeFileSync(outfile, JSON.stringify(json));
  return admin.app().delete();
})
