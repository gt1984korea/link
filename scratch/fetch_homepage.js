const http = require('https');

http.get('https://victorychurch.nz', (res) => {
  let html = '';
  res.on('data', (chunk) => { html += chunk; });
  res.on('end', () => {
    // Find all image tags or logo/brand references
    const imgRegex = /<img[^>]+src="([^">]+)"/g;
    let match;
    const images = [];
    while ((match = imgRegex.exec(html)) !== null) {
      images.push(match[1]);
    }
    console.log('Found images on homepage:');
    images.forEach(img => {
      if (img.includes('logo') || img.includes('brand') || img.includes('imweb.me') || img.includes('33c296729aee7')) {
        console.log(' - ' + img);
      }
    });
  });
}).on('error', (e) => {
  console.error(e);
});
