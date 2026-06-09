const http = require('https');

http.get('https://www.youtube.com/@nzvictory', (res) => {
  let html = '';
  res.on('data', (chunk) => { html += chunk; });
  res.on('end', () => {
    // Find yt3.ggpht.com URLs (YouTube's image CDN)
    const regex = /https:\/\/yt3\.[a-z0-9.-]+\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+=s[0-9]+-c-k-c0x00ffffff-no-rj/g;
    const matches = html.match(regex);
    if (matches && matches.length > 0) {
      console.log('Found YouTube avatar candidate URLs:');
      // De-duplicate
      const unique = [...new Set(matches)];
      unique.forEach(url => {
        // We can request a larger size by replacing the =sXX parameter with =s800
        const highResUrl = url.replace(/=s[0-9]+/, '=s800');
        console.log(` - ${highResUrl}`);
      });
    } else {
      console.log('No YouTube avatar URLs found in HTML. Trying simpler regex...');
      const simpleRegex = /https:\/\/yt3\.[a-z0-9.-]+\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/g;
      const simpleMatches = html.match(simpleRegex);
      if (simpleMatches) {
        const unique = [...new Set(simpleMatches)];
        unique.forEach(url => {
          console.log(` - ${url}=s800-c-k-c0x00ffffff-no-rj`);
        });
      } else {
        console.log('No matches at all.');
      }
    }
  });
}).on('error', (e) => {
  console.error(e);
});
