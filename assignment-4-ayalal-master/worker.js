
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
                const dimensions = sizeOf(Buffer.concat(imageChunks));
                console.log(`== Dimensions for image ${id}:`, dimensions);
                jimp.read(buffer)
                    .then(image => {
                        if(dimensions.height > 0){
                            image.write('/usr/src/app/api/uploads/' + id + '--orig.jpg');
                            const imageToSend = {
                                contentType: 'image/jpeg',
                                filename: id + '--orig.jpg',
                                path: '/usr/src/app/api/uploads/' + id + '--orig.jpg'
                            };
                            console.log("image to be saved: " + imageToSend);
                            saveResizedImageFile(imageToSend);
                        }
                        if(dimensions.height > 1024){
                            image.resize(1024, 1024).write('/usr/src/app/api/uploads/' + id + '--1024.jpg');
                            const imageToSend = {
                                contentType: 'image/jpeg',
                                filename: id + '--1024.jpg',
                                path: '/usr/src/app/api/uploads/' + id + '--1024.jpg'
                            };
                            console.log("image to be saved: " + imageToSend);
                            saveResizedImageFile(imageToSend);
                        }
                        if(dimensions.height > 640){
                            image.resize(640, 640).write('/usr/src/app/api/uploads/' + id + '--640.jpg');
                            const imageToSend = {
                                contentType: 'image/jpeg',
                                filename: id + '--640.jpg',
                                path: '/usr/src/app/api/uploads/' + id + '--640.jpg'
                            };
                            console.log("image to be saved: " + imageToSend);
                            saveResizedImageFile(imageToSend);
                        }
                        if (dimensions.height > 256) {
                            image.resize(256, 256).write('/usr/src/app/api/uploads/' + id + '--256.jpg');
                            const imageToSend = {
                                contentType: 'image/jpeg',
                                filename: id + '--256.jpg',
                                path: '/usr/src/app/api/uploads/' + id + '--256.jpg'
                            };
                            console.log("image to be saved: " + imageToSend);
                            saveResizedImageFile(imageToSend);
                        }
                        if (dimensions.height > 128) {
                            image.resize(128, 128).write('/usr/src/app/api/uploads/' + id + '--128.jpg');
                            const imageToSend = {
                                contentType: 'image/jpeg',
                                filename: id + '--128.jpg',
                                path: '/usr/src/app/api/uploads/' + id + '--128.jpg'
                            };
                            console.log("image to be saved: " + imageToSend);
                            saveResizedImageFile(imageToSend);
                        }
                    })
                    .catch(err => {
                        console.log(err);
                    });
            });
        channel.ack(msg);
    });
});


