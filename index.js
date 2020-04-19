
const 
  commander       = require('commander'),
  fastify         = require('fastify')({
    //logger: true
  }),
  redis           = require('redis'),
  path            = require('path'),
  { promisify }   = require('util'),
  _               = require('lodash'),
  fnv1a           = require('@sindresorhus/fnv1a'),
  products        = require('./products.js'),
  users           = require('./users.js'),
  purchases       = require('./purchases.js');

//** Setup command line arguments */
commander
  .requiredOption('-i, --input <path>', 'Path to JSON file product metadata')
  .requiredOption('-c, --count <count of products>', 'Number of products to include')
  .requiredOption('-h, --redishost <Redis host IP>', 'Host for Redis')
  .requiredOption('-p, --redisport <port for Redis>','Port for Redis')
  .option('-a, --redisauth <redis password>','Password for Redis instance')
  .option('-t, --temporary <seconds>','Number of seconds for the RediSearch index',60);
const args = commander.parse(process.argv);

//** Setup Redis / RediSearch */
['ft.search','ft.add','ft.create','ft.info']
  .forEach(redis.add_command);

const client  = redis.createClient({
  host      : args.redishost,
  port      : args.redisport,
  password  : args.redispauth
});

// create Async functions out of Redis Commands
const
  ft_create = promisify(client.ft_create).bind(client),
  ft_add    = promisify(client.ft_add).bind(client),
  ft_search = promisify(client.ft_search).bind(client),
  ft_info    = promisify(client.ft_info).bind(client),
  scan      = promisify(client.scan).bind(client);

//** Load the products from the text file */
console.log('loading products...');
products.load(args.input, args.count);
console.log('loaded.');


/** helper functions */ 
const indexName = (email) => `user:${fnv1a(email)}`;
const byIdentifer = (src,param) => async (request) => {
  let one = src.get(request.params[param]);
  if (!one) {
    const err = new Error();
    err.statusCode = 404;
    err.message = 'Product Not Found';
    throw err;
  }
  return one;
}
const searchToItems = (results) => results.filter((_,index) => index % 2)
  .map((el) => _(el)
    .chunk(2)
    .fromPairs()
    .value()
  );
const list = (src) => async (request) => src.list(request.params.start,request.params.end);

/** Abstracted search operations */
// index a single purchase
const indexPurchase = async (idx,itemId,purchaseTime) => {
  let details = products.get(itemId);
  return ft_add(
    idx,  // RediSearch index name
    fnv1a(idx+[purchaseTime,itemId]), // document ID
    1, // doc score
    'FIELDS',
      'purchased', purchaseTime,
      'title', details.title,
      'price', details.price,
      'desc', details.description,
      'itemid', itemId
  );
}
// Get purchases and index them
const indexAllPurchases = async (email) => {
  const
    // get the purchase history from the storage of record
    purchaseHistory = await purchases.history(email),
    // generate the index name from the email
    usersIndex = indexName(email);

  const indexPurchases = async (history) => Promise.all(
    history.map(
      (item) =>  indexPurchase(usersIndex,item[1],item[0])
    )
  );

  let existingIndex = false;
  try {
    await ft_create(
      usersIndex, //name of index
      'TEMPORARY', args.temporary, // make it ephemeral for # seconds specified in the command line
      'SCHEMA',
        'purchased', 'NUMERIC',
        'title','TEXT',
        'desc','TEXT',
        'price', 'NUMERIC',
        'itemid','TEXT'
    );
  } catch(err) {
    if (String(err).includes('Index already exists')) {
      existingIndex = true;
    } else {
      throw err;
    }
  }
  if (!existingIndex) {
    await indexPurchases(purchaseHistory);
  }
  return {
    items  : purchaseHistory.length,
    existingIndex
  }
};


/** Routes */

// Get list of products
fastify.get('/product/:start/:end', list(products) );
// Get a single product
fastify.get('/product/:id', byIdentifer(products,'id'));

// Get a lis of users
fastify.get('/user/:start/:end',list(users));
// Get a single user
fastify.get('/user/:email',byIdentifer(users,'email'));

// User login
fastify.put('/user/:email', async (request) => ({ 
    status : 'OK', 
    meta : await indexAllPurchases(request.params.email) 
  })
);

// Buy an item
fastify.get('/buy/:user/:id',async (request) => {
  let 
    purchaseTime = new Date().getTime(),
    idx = indexName(request.params.user);

  await purchases.buy(request.params.user,request.params.id,purchaseTime);
  try {
    // first we try to index the purchase
    await indexPurchase(idx,request.params.id,purchaseTime);
  } catch(err) {
    // if this fails because there is no index...
    if (String(err).includes('Unknown index name')) {
      // we reindex everything.
      console.log(`${idx} not found, reindexing.`);
      await indexAllPurchases(request.params.user);
      console.log(`${idx} reindexed.`);
    } else {
      throw err;
    }
  }

  return { id : request.params.id };
});

// get the user history (or search it)
fastify.get('/buy-history/:user/:offset/:search?', async (request) => {
  const
    idx = indexName(request.params.user)
    getSearch = () => ft_search(
      idx, 
      request.params['search?'] || '*' // if the search param exists, use it otherwise get everything
    );
  let searchResults;
  try {
    searchResults   = await getSearch();
  } catch (err) {
    if (String(err).includes('no such index')) {
      console.log(`${idx} not found, reindexing.`);
      await indexAllPurchases(request.params.user);
      console.log(`${idx} reindexed.`);
      searchResults = await getSearch();
    } else { throw err; }
  }
  const resultCount = searchResults.shift();
  return { 
    search    : request.params['search?'],
    offset    : request.params.offset,
    count     : resultCount,
    items     : searchToItems(searchResults)
  };
});

fastify.get('/indexes',async () => {
  let cursor = 0, allResults = [];
  do {
    let scanResults = await scan(cursor,'MATCH','idx:*');
    cursor = scanResults[0];
    if (scanResults[1]) {
      allResults = allResults.concat(scanResults[1])
    }
  } while(cursor !== '0');
  return Promise.all(
    allResults
      .map((s) => s.substring(4))
      .map((idx) => ft_info(idx))
  )
});
// start the web server process
fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'public')
});
const start = async () => {
  try {
    await fastify.listen(3379);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();