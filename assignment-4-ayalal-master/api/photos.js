/*
 * API sub-router for businesses collection endpoints.
 */

const router = require('express').Router();

const { validateAgainstSchema } = require('../lib/validation');
const { connectToRabbitMQ, getChannel } = require('../lib/rabbitmq');
const {
  PhotoSchema,
  insertNewPhoto,
  getPhotoById,
  saveImageFile,
  saveImageInfo,
  getImageInfoById,
  getImageDownloadStreamByFilename,
  removeUploadedFile,
  sendToRabbit
} = require('../models/photo');

const crypto = require('crypto');
const multer = require('multer');
const imageTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png'
};
const upload = multer({
  storage: multer.diskStorage({ 
  destination: `${__dirname}/uploads`,
  filename: (req, file, callback) => {  
      const filename =
        crypto.pseudoRandomBytes(16).toString('hex');
      const extension = imageTypes[file.mimetype];
      callback(null, `${filename}.${extension}`);
    } 
  }),
  fileFilter: (req, file, callback) => {
    callback(null, !!imageTypes[file.mimetype]);
  }
});

/*
 * Route to create a new photo.
 */
router.post('/', upload.single('image'), async (req, res) => {
  if (validateAgainstSchema(req.body, PhotoSchema)) {
    if(req.body && req.file && req.body.userId){
      try {
        const image = {
          contentType: req.file.mimetype,
          filename: req.file.filename,
          path: req.file.path,
          userId: req.body.userId
        };
        const id = await saveImageFile(image);
        await removeUploadedFile(req.file);
        const channel = getChannel();
        channel.sendToQueue('images', Buffer.from(id.toString()));
        res.status(200).send({ id: id });
      } catch (err) {
        console.error(err);
        res.status(500).send({
          error: "Error inserting photo into DB.  Please try again later."
        });
      }
     }
    } else {
      res.status(400).send({
        error: "Request body is not a valid photo object"
      });
    }
});

/*
 * Route to fetch info about a specific photo.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const image = await getImageInfoById(req.params.id);
    if (image) {
      const responseBody = {
        _id: image._id,
        url: `/photos/media/images/${image.filename}`,
        contentType: image.metadata.contentType,
        userId: image.metadata.userId,
        size: image.metadata.size
      };
      res.status(200).send(responseBody);
    } else {
      next();
    }
  } catch (err) {
    console.error(err);
    res.status(500).send({
      error: "Unable to fetch photo.  Please try again later."
    });
  }
});

module.exports = router;
