
const 
  commander = require('commander'),
  fs      = require('fs'),
  parse   = require('loose-json'),
  fastify = require('fastify')({
    logger: true
  })

commander
  .requiredOption('-i, --input <path>', 'Path to JSON file product metadata')
  .requiredOption('-c, --count <count of products>', 'Number of products to include')

const 
  args = commander.parse(process.argv);

let
  allProductCount,
  productsByAsin = {};
  productIndex = [];
function loadProducts() {
  let products = fs.readFileSync(args.input,'utf8').split('\n');
  allProductCount = products.length;
  products = products.slice(0,args.count).map((p) => parse(p));
  products.forEach((p) => {
    productsByAsin[p.asin] = {
      description : p.description,
      title       : p.title,
      price       : (Math.floor(Math.random() * 99) + 1) + 0.99
    }
  });
  productIndex = products.map((product) => product.asin);
}
function getProduct(asin) {
  if (!productsByAsin[asin]) {
    return false;
  } else {
    return productsByAsin[asin];
  }
}

console.log('loading products...');
loadProducts();

console.log(`Loaded ${allProductCount} products, using ${productIndex.length}`);


fastify.get('/product/:id', async (request, reply) => {
  let product = getProduct(request.params.id);
  if (!product) {
    const err = new Error();
    err.statusCode = 404;
    err.message = 'Product Not Found';
    throw err;
  }
  return product;
  /*if (!productsByAsin[request.params.asin]) {
    const err = new Error();
    err.statusCode = 404;
    err.message = 'Product Not Found';
    throw err;
  } else {
    return 
  }*/
});
fastify.get('/product/:start/:end', async (request, reply) => {
  return productIndex.slice(request.params.start,request.params.end);
});



const start = async () => {
  try {
    await fastify.listen(3379)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start();