const http = require('https');
const fs = require('fs');

const candidates = [
  'https://cdn.imweb.me/upload/S20230729dfefaf12f2713/33c296729aee7.png',
  'https://cdn.imweb.me/upload/S20230729dfefaf12f2713/3563efa679cea.png',
  'https://cdn.imweb.me/upload/S20230729dfefaf12f2713/37f3f8c269d16.png',
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
        fs.unlink(dest, () => {});
        reject(new Error(`Status: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function check() {
  for (const url of candidates) {
    const dest = `test_${url.split('/').pop()}`;
    console.log(`Checking: ${url}`);
    try {
      await download(url, dest);
      const buffer = Buffer.alloc(24);
      const fd = fs.openSync(dest, 'r');
      fs.readSync(fd, buffer, 0, 24, 0);
      fs.closeSync(fd);

      if (buffer.readUInt32BE(0) === 0x89504E47 && buffer.readUInt32BE(4) === 0x0D0A1A0A) {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        console.log(` -> SUCCESS! Dimensions: ${width}x${height}`);
      } else {
        console.log(` -> Failed: Not a valid PNG`);
        fs.unlinkSync(dest);
      }
    } catch (e) {
      console.log(` -> Failed: ${e.message}`);
    }
  }
}

check();
