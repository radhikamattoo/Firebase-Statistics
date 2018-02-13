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

return dbRef.once("value").then((gameBuilder) => {
  const imagesToDownload = []; // [{cloudPath:___, destinationPath:___}]
  const specs = gameBuilder.child('gameSpecs');
  const elements = gameBuilder.child('elements');
  const images = gameBuilder.child('images');
  const promises = [];
  let count = 0;
  specs.forEach((gameSpec) => { //for each gameSpec object get all ids for the pieces
    count += 1;
    const elementIds = [];
    const imageIds = [];
    const gameName = gameSpec.child('gameName').val();
    console.log("GAME: " + gameName + " count: ", count);
    json[gameName] = {};

    const pieces = gameSpec.child('pieces');
    pieces.forEach((piece) => {
      const elementId = piece.child('pieceElementId').val();
      elementIds.push(elementId);
    });

    // Get imageId for each element in the game
    elementIds.forEach((elementId) =>{
      const imageRefs = elements.child(elementId).child('images');
      imageRefs.forEach((ref) =>{
        imageIds.push( ref.child('imageId').val() );
      });
    });

    // get the image cloud path from imageIds
    imageIds.forEach((imageId) =>{
      const isBoard = images.child(imageId).child('isBoardImage').val();
      console.log(isBoard);
      if(isBoard){
        const cloudPath = images.child(imageId).child('cloudStoragePath').val(); //images/dog.jpg
        const obj = {'cloudStoragePath' : cloudPath, 'metadata': {} };
        json[gameName] = obj;
        console.log(cloudPath);
        console.log(json[gameName]);
        const filename = cloudPath.split("/")[1]; //dog.jpg
        let file, extension = filename.split("."); // dog, jpg
        const thumbFileName = file + '.jpg'; // dog.jpg

        // Temporary paths for images
        const tempDir = os.tmpdir(); //tmp
        const tempFilePath = path.join(tempDir, filename); // tmp/dog.jpg
        const tempThumb = path.join(tempDir, file + "_thumb.jpg"); //tmp/dog_thumb.jpg
        const temp50 = path.join(tempDir, path.format( { name: file + "_50" , ext: extension} )); // /tmp/dog_50.jpg
        const temp70 = path.join(tempDir, path.format( { name: file + "_70" , ext: extension} )); // /tmp/dog_70.jpg

        // Paths in GCS for upload
        const filePath70 = path.join('images/quality70', filename);
        const filePath50 = path.join('images/quality50', filename);
        const thumbnailPath = path.join('images/thumbnail', thumbFileName);
        const fileRef = storage.file(cloudPath);

        console.log("Resizing the image with path: ", filePath, ", name: ", filename, " and extension: ", extension);
        console.log("Download path: ", tempFilePath);
        console.log("Temp 50 path: ", temp50);
        console.log("Temp 70 path: ", temp70);
        console.log("Temp thumb path: ", tempThumb);
        console.log("File50 GCS path: ", filePath50);
        console.log("File70 GCS path: ", filePath70);
        console.log("Thumbnail GCS path: ", thumbnailPath);

        let promise = fileRef.getMetadata().then((results) =>{
          const metadata = results[0];
          console.log("Retrieved metadata, original file size is: ", metadata.size);
          json[gameName]['metadata']['originalSize'] = metadata.size;
          return fileRef.download({
            destination: tempFilePath
          });
        }).then(() => {
          console.log('Image downloaded locally to', tempFilePath);
          console.log("Converting image to quality70");
          return spawn('convert', [tempFilePath, '-quality', '70', temp70]);
        }).then(() => {
          console.log("Uploading quality70 image");
          return storage.upload(temp70, { destination: filePath70 });
        }).then(()=>{
          console.log("Converting image to quality50");
          return spawn('convert', [tempFilePath, '-quality', '50', temp50]);
        }).then(()=>{
          console.log("Uploading quality50 image");
          return storage.upload(temp50, { destination: filePath50});
        }).then(()=>{
          console.log('Converting image to thumbnail');
          return spawn('convert', [tempFilePath, '-thumbnail', '200x200>', tempThumb]);
        }).then(()=>{
          console.log("Uploading thumbnail");
          return storage.upload(tempThumb, { destination: thumbnailPath });
        }).then(() =>{
          console.log("Unlinking temp files");
          fs.unlinkSync(tempFilePath);
          fs.unlinkSync(tempThumb);
          fs.unlinkSync(temp70);
          fs.unlinkSync(temp50);
          return true;
          // console.log("EXITING");
          // process.exit(0);
        });
        promises.push(promise);
      }
    }); //imageIds forEach

  }); //specs forEach
  return Promise.all(promises);
});

function getFilesizeInBytes(filename) {
    const stats = fs.statSync(filename)
    const fileSizeInBytes = stats.size
    return fileSizeInBytes
}
