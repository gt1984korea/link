const http = require('https');
const fs = require('fs');

const urls = [
  'https://cdn.imweb.me/upload/20260516/33c296729aee7.png',
  'https://cdn.imweb.me/thumbnail/20260516/33c296729aee7.png'
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    http.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      } else {
        file.close();
        fs.unlink(dest, () => {}); // Delete the empty file
        reject(new Error(`Status code: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function run() {
  for (const url of urls) {
    console.log(`Trying to download: ${url}...`);
    try {
      const dest = 'temp_logo.png';
      await download(url, dest);
      
      const buffer = Buffer.alloc(24);
      const fd = fs.openSync(dest, 'r');
      fs.readSync(fd, buffer, 0, 24, 0);
      fs.closeSync(fd);

      if (buffer.readUInt32BE(0) === 0x89504E47 && buffer.readUInt32BE(4) === 0x0D0A1A0A) {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        console.log(`SUCCESS! Downloaded image dimensions: ${width}x${height}`);
        fs.renameSync(dest, 'logo_original.png');
        return;
      } else {
        console.log(`Failed: Not a valid PNG.`);
        fs.unlinkSync(dest);
      }
    } catch (err) {
      console.log(`Failed: ${err.message}`);
    }
  }
  console.log('No valid image found on CDN paths.');
}

run();
