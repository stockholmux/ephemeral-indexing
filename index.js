
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

redis.add_command('ft.search');
redis.add_command('ft.add');
redis.add_command('ft.create');
redis.add_command('ft.info'); // do we need this?
  
fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'public')
});
commander
  .requiredOption('-i, --input <path>', 'Path to JSON file product metadata')
  .requiredOption('-c, --count <count of products>', 'Number of products to include')
  .requiredOption('-h, --redishost <Redis host IP>', 'Host for Redis')
  .requiredOption('-p, --redisport <port for Redis>','Port for Redis')
  .option('-a, --redisauth <redis password>','Password for Redis instance');

const 
  args    = commander.parse(process.argv),
  client  = redis.createClient({
    host      : args.redishost,
    port      : args.redisport,
    password  : args.redispauth
  });

// create Async functions out of Redis Commands
const
  ft_create = promisify(client.ft_create).bind(client),
  ft_add    = promisify(client.ft_add).bind(client),
  ft_search = promisify(client.ft_search).bind(client);

console.log('loading products...');
products.load(args.input, args.count);
console.log('loaded.');

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

const list = (src) => async (request) => src.list(request.params.start,request.params.end);

fastify.get('/product/:start/:end', list(products) );
fastify.get('/product/:id', byIdentifer(products,'id'));

fastify.get('/user/:start/:end',list(users));
fastify.get('/user/:email',byIdentifer(users,'email'));

const indexPurchase = (indexName,itemId,purchaseTime) => {
  let details = products.get(itemId);
  return ft_add(
    indexName,
    fnv1a(indexName+[purchaseTime,itemId]),
    1,
    'FIELDS',
    'purchased', purchaseTime,
    'title', details.title,
    'price', details.price,
    'desc', details.description,
    'itemid', itemId
  );
}

fastify.put('/user/:email',async (request) => {
  // User login
  const
    hashedEmail     = fnv1a(request.params.email),
    purchaseHistory = await purchases.history(request.params.email),
    indexName       = `user:${hashedEmail}`;

  let createResult;
  const indexPurchases = async (history) => history.map(
    (item) =>  indexPurchase(indexName,item[1],item[0])
  );
      
      /*let details = products.get(item[1]);

      return ft_add(
        indexName,
        fnv1a(indexName+item),
        1,
        'FIELDS',
        'purchased', item[0],
        'title', details.title,
        'price', details.price,
        'desc', details.description,
        'itemid', item[1]
      )*/




  let userPurchases;
  try {
    createResult = await ft_create(
      indexName,    //name of index
      'TEMPORARY','60',
      'SCHEMA',
        'purchased', 'NUMERIC',
        'title','TEXT',
        'desc','TEXT',
        'price', 'NUMERIC',
        'itemid','TEXT'
    );
    console.log('purchase history',purchaseHistory)
    userPurchases = await indexPurchases(purchaseHistory);
    console.log(userPurchases);
  } catch(err) {
    if (!String(err).includes('Index already exists')) {
      throw err;
    }
  }
  
 
  return { status : 'OK' };
});

fastify.get('/buy/:user/:id',async (request) => {
  await purchases.buy(request.params.user,request.params.id);

  return { id : request.params.id };
});

fastify.get('/buy-history/:user/:offset/:search?', async (request) => {
  const
    hashedEmail     = fnv1a(request.params.user),
    indexName       = `user:${hashedEmail}`,
    searchResults   = await ft_search(indexName, request.params['search?'] || '*'),
    resultCount     = searchResults.shift();
  let
    items   = searchResults
      .filter((_,index) => index % 2)
      .map((el) => _(el)
        .chunk(2)
        .fromPairs()
        .value()
      );

  return { 
    search    : request.params['search?'],
    offset    : request.params.offset,
    items 
  };
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