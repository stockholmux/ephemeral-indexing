
const 
  commander = require('commander'),
  fastify   = require('fastify')({
    //logger: true
  }),
  path      = require('path'),
  products  = require('./products.js'),
  users     = require('./users.js'),
  purchases = require('./purchases.js');

fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'public')
});
commander
  .requiredOption('-i, --input <path>', 'Path to JSON file product metadata')
  .requiredOption('-c, --count <count of products>', 'Number of products to include');

const 
  args = commander.parse(process.argv);

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
fastify.put('/user/:email',async (request) => {
  // User login
  return { status : 'OK' };
});

fastify.get('/buy/:user/:id',async (request) => {
  await purchases.buy(request.params.user,request.params.id);
  return { id : request.params.id };
});

fastify.get('/buy-history/:user/:offset/:search?', async (request) => {
  // Display user purchase history + search
  const purchaseHistory = await purchases.history(request.params.user);
  const purchaseHistoryItems = purchaseHistory.map((pair) => {
    const itemDetails = products.get(pair[1]);
    return {
      purchaseTime  : Number(pair[0]),
      id            : pair[1],
      title         : itemDetails.title,
      description   : itemDetails.description,
      price         : itemDetails.price 
    };
  });

  return {
    search  : request.params['search?'],
    offset  : request.params.offset,
    items   : purchaseHistoryItems 
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