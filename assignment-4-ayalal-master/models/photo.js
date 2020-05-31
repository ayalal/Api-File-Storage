/*
 * Photo schema and data accessor methods.
 */

const { ObjectId, GridFSBucket } = require('mongodb');

const { getDBReference } = require('../lib/mongo');
const { extractValidFields } = require('../lib/validation');

const rabbitmqHost = process.env.RABBITMQ_HOST || 'localhost';
const rabbitmqUrl = `amqp://guest:guest@${rabbitmqHost}:5672`;
const amqp = require('amqplib');

var mongodb = require('mongodb');
var assert = require('assert');
var fs = require('fs');

/*
 * Schema describing required/optional fields of a photo object.
 */
const PhotoSchema = {
  businessid: { required: true },
  caption: { required: false }
};
exports.PhotoSchema = PhotoSchema;

/*
 * Executes a DB query to insert a new photo into the database.  Returns
 * a Promise that resolves to the ID of the newly-created photo entry.
 */
async function insertNewPhoto(photo) {
  photo = extractValidFields(photo, PhotoSchema);
  photo.businessid = ObjectId(photo.businessid);
  const db = getDBReference();
  const collection = db.collection('photos');
  const result = await collection.insertOne(photo);
  return result.insertedId;
}
exports.insertNewPhoto = insertNewPhoto;

/*
 * Executes a DB query to fetch a single specified photo based on its ID.
 * Returns a Promise that resolves to an object containing the requested
 * photo.  If no photo with the specified ID exists, the returned Promise
 * will resolve to null.
 */
async function getPhotoById(id) {
  const db = getDBReference();
  const collection = db.collection('photos');
  if (!ObjectId.isValid(id)) {
    return null;
  } else {
    const results = await collection
      .find({ _id: new ObjectId(id) })
      .toArray();
    return results[0];
  }
}
exports.getPhotoById = getPhotoById;

/*
 * Executes a DB query to fetch all photos for a specified business, based
 * on the business's ID.  Returns a Promise that resolves to an array
 * containing the requested photos.  This array could be empty if the
 * specified business does not have any photos.  This function does not verify
 * that the specified business ID corresponds to a valid business.
 */
async function getPhotosByBusinessId(id) {
  const db = getDBReference();
  const collection = db.collection('photos');
  if (!ObjectId.isValid(id)) {
    return [];
  } else {
    const results = await collection
      .find({ businessid: new ObjectId(id) })
      .toArray();
    return results;
  }
}
exports.getPhotosByBusinessId = getPhotosByBusinessId;

exports.saveImageInfo = async function (image) {
  const db = getDBReference();
  const collection = db.collection('images');
  const result = await collection.insertOne(image);
  return result.insertedId;
};

exports.saveImageFile = async function (image) {
  return new Promise((resolve, reject) => {
    const db = getDBReference();
    const bucket = new GridFSBucket(db, {
      bucketName: 'images'
    });
    const metadata = {
      contentType: image.contentType,
      userId: image.userId
    };

    const uploadStream = bucket.openUploadStream(
      image.filename,
      { metadata: metadata }
    );
    fs.createReadStream(image.path).pipe(uploadStream)
      .on('error', (err) => {
        reject(err);
      })
      .on('finish', (result) => {
        resolve(result._id);
      });
  });
};

exports.getImageInfoById = async function (id) {
  const db = getDBReference();
  const bucket = new GridFSBucket(db, {
    bucketName: 'images'
  });
  // const collection = db.collection('images');
  if (!ObjectId.isValid(id)) {
    return null;
  } else {
    // const results = await collection.find({ _id: new ObjectId(id) })
    //   .toArray();
    const results = await bucket.find({ _id: new ObjectId(id) })
      .toArray();
    return results[0];
  }
};

exports.getImageDownloadStreamByFilename = function (filename) {
  const db = getDBReference();
  const bucket = new GridFSBucket(db, {
    bucketName: 'images'
  });
  return bucket.openDownloadStreamByName(filename);
};

function removeUploadedFile(file) {
  return new Promise((resolve, reject) => {
    fs.unlink(file.path, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
exports.removeUploadedFile = removeUploadedFile;

exports.getDownloadStreamById = function (id) {
  const db = getDBReference();
  const bucket = new GridFSBucket(db, { bucketName: 'images' });
  if (!ObjectId.isValid(id)) {
    return null;
  } else {
    return bucket.openDownloadStream(new ObjectId(id));
  }
};

exports.updateImageSizeById = async function (id, size) {
  const db = getDBReference();
  const collection = db.collection('images.files');
  if (!ObjectId.isValid(id)) {
    return null;
  } else {
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { "metadata.size": size }}
    );
    return result.matchedCount > 0;
  }};


  async function sendToRabbit(id) {
    try {
    const connection = await amqp.connect(rabbitmqUrl);
    const channel = await connection.createChannel();
    await channel.assertQueue('echo');
    channel.sendToQueue('images', Buffer.from(id.toString()));
    } catch (err) {
      console.error(err);
    }
  }
  exports.sendToRabbit = sendToRabbit;