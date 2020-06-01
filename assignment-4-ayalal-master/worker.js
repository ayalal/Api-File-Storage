
const sizeOf = require('image-size');
const sharp = require('sharp');
var jimp = require('jimp');

const { connectToDB } = require('./lib/mongo');
const { connectToRabbitMQ, getChannel } = require('./lib/rabbitmq');
const { getDownloadStreamById, updateImageSizeById, getImageInfoById, saveResizedImageFile } = require('./models/photo');



connectToDB(async () => {
    await connectToRabbitMQ('images');
    const channel = getChannel();
    channel.consume('images', async (msg) => {
        const id = msg.content.toString();
        const image = await getImageInfoById(id);
        console.log("id: " + id);
        const imageChunks = [];
        getDownloadStreamById(id)
            .on('data', chunk => {
                imageChunks.push(chunk);
            })
            .on('end', async () => {
                const buffer = Buffer.concat(imageChunks);
                jimp.read(buffer)
                .then(image => {
                    image.resize(256,256).write('/usr/src/app/api/uploads/'+id+'--256.jpg');
                    const imageToSend = {
                        contentType: 'image/jpeg',
                        filename: id+'--256.jpg',
                        path: '/usr/src/app/api/uploads/'+id+'--256.jpg'
                      };
                    console.log("image to be saved: " + imageToSend);
                    saveResizedImageFile(imageToSend);
                })
                .catch(err => {
                    console.log(err);
                });
            });
        channel.ack(msg);
    });
});


