
const sizeOf = require('image-size');

const { connectToDB } = require('./lib/mongo');
const { connectToRabbitMQ, getChannel } = require('./lib/rabbitmq');
const { getDownloadStreamById, updateImageSizeById } = require('./models/photo');

connectToDB(async () => {
  await connectToRabbitMQ('images');
  const channel = getChannel();
  channel.consume('images', msg => {
    const id = msg.content.toString();
    const imageChunks = [];
    getDownloadStreamById(id)
      .on('data', chunk => {
        imageChunks.push(chunk);
      })
      .on('end', async () => {
        const dimensions = sizeOf(Buffer.concat(imageChunks));
        console.log(`== Dimensions for image ${id}:`, dimensions);
        const result = await updateImageSizeById(id, dimensions);
      });
      channel.ack(msg);
  });
});