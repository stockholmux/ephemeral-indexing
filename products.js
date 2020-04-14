const
  fs      = require('fs'),
  parse   = require('loose-json'),
  Entities = require('html-entities').XmlEntities,
  entities = new Entities();

let
  allProductCount,
  productsByAsin = {},
  productIndex = [];
  
function loadProducts(productsFile,count) {
  let products = fs.readFileSync(productsFile,'utf8').split('\n');

  allProductCount = products.length;
  products = products.slice(0,count).map((p) => parse(p));
  products.forEach((p) => {
    productsByAsin[p.asin] = {
      description : entities.decode(p.description),
      title       : entities.decode(p.title),
      price       : (Math.floor(Math.random() * 99) + 1) + 0.99
    };
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

module.exports = {
  load  : loadProducts,
  get   : getProduct,
  list  : (start,end) => productIndex.slice(start,end)
};