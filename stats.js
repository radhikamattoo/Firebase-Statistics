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
});
const db = admin.database();
const storage = admin.storage().bucket('universalgamemaker');

const dbRef = db.ref("/gameBuilder");
const outfile = "statistics.json";
let json = {}; // "{Monopoly: {original:__, quality70:__, quality50:__}"

function createStatistics(){
  return dbRef.once("value", (gameBuilder) => {
    const specs = gameBuilder.child('gameSpecs');
    const elements = gameBuilder.child('elements');
    const images = gameBuilder.child('images');
    const elementIds = [];
    const imageIds = [];

    specs.forEach((gameSpec) => { //for each gameSpec object get all ids for the pieces
      // console.log("GAME: " + gameSpec.child('gameName').val());
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
        const isBoardImage = images.child(imageId).child('isBoardImage').val();
        if(isBoardImage){ // convert to quality50 and quality70
          const cloudPath = images.child(imageId).child('cloudStoragePath').val();
          console.log(cloudPath);
        }else{ //create thumbnails

        }

      });

    });
    console.log(boardCount)
    console.log("\n\n");

  });
}

// storageRef.child('/<INSERT GCS PATH HERE>').getDownloadURL().then(function(url) {
//   // `url` is the download URL for 'images/stars.jpg'
//   // This can be downloaded directly:
//   var xhr = new XMLHttpRequest();
//   xhr.responseType = 'blob';
//   xhr.onload = function(event) {
//     var blob = xhr.response;
//   };
//   xhr.open('GET', url);
//   xhr.send();
//
//   // Or inserted into an <img> element:
//   var img = document.getElementById('myimg');
//   img.src = url;
// }).catch(function(error) {
//   // Handle any errors
// });
