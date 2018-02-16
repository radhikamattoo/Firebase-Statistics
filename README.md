# Firebase File Conversion

This module using the [Firebase Admin SDK](https://firebase.google.com/docs/reference/admin/) to read image data/paths from the universalgamemaker Firebase Database, then perform image resizing/compression on images in the Firebase Cloud Storage.

## Usage:
After running `npm install`, download your service account credentials and replace this line with the path to your own credential file:

```
const serviceAccount = require("./<YOUR CREDENTIALS HERE>");

```  

Depending on what you want to do with the stats, uncomment the functions called in `main()`

```
function main(){
  // downloadDatabase();
  // downloadImages();
  // getGameData();
  // generateStats();
  // admin.app().delete();
}
```

Note that `admin.app().delete()` immediately closes the connection to Firebase, so if you are calling asynch function(s), keep this line uncommented and manually quit out of the program when the function(s) finish.


Then run `npm start`.
