const 
  fnv1a = require('@sindresorhus/fnv1a'),
  fs = require('fs').promises,
  filename = (user) => `users/${fnv1a(user)}.txt`;

module.exports = {
  buy       : (user,itemId) => fs.appendFile(
    filename(user), 
    `${new Date().getTime()},${itemId}\r\n`
  ),
  history   : async (user) => {
    try {
      const purchases = await fs.readFile(filename(user),'utf8');
      return purchases.split('\r\n').filter((row) => row.length > 0).map((row) => row.split(','));
    } catch(err) {
      if (err.code !== 'ENOENT') {
        console.log(`Error reading purchase history of ${user}`);
      }
      return [];
    }
  }
};