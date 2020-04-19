# Ephemeral Indexing Demo

This demo shows an e-commerce use of [RediSearch](https://redisearch.io) Ephemeral Indexing. It is written in Node.js on the backend and Vue on the front end.

## Architecture

To make this demo agnostic to any particular database, it uses text files as a mock database to load products and fake users, as well as to store/load user purchases. These are abstracted as interfaces in `products.js`, `users.js` and `purchases.js` respectively. As a consequence, these files are not very interesting and could be swapped out with another database or storage engine quite easily.

Each user has it's own compartmentalized RediSearch index that is temporary. 
When a user makes a purchase, it is stored in our mock database (text file) and indexed with RediSearch to the user's index. When a user logs in, the purchase history is read from the mock database and instantly indexed into the  user's ephemeral index. Searches of purchase history are always retrieved instantly from RediSearch. 

## Setup

The products data is not included in this repo (for license reasons). You can download a data set from [Julian McAuley's site](http://jmcauley.ucsd.edu/data/amazon/links.html). Select a metadata set from the "Per-category files" section, download an decompress it. I would avoid the books category becuase it is so large.

Alternately, you can use CURL:

```
$ curl --compressed -o products.gz http://snap.stanford.edu/data/amazon/productGraph/categoryFiles/meta_Patio_Lawn_and_Garden.json.gz
$ gzip -d products.gz
```

You will also need Node 12.13.x+ and RediSearch 1.6.x

To get all the Node.js dependencies, execute:
```
$ npm install
```

## Running

To start the web server:

```
$ node index.js -i /path/to/products/file/products -c 1000 -h <redishost> -p <redisport>  -a <redispassword>`
```

`-c 1000` controls how many products will be loaded.

`-t 90` controls how many seconds the RediSearch indexes will last. Defaults to 60 seconds.

Once running, point your browser to http://localhost:3379/

## UI

The UI is a very basic e-commerce site. There is no cart nor payment flow implemented, instead it's a "buy it now" type of site - as soon as you click "Buy Now" it's added to your purchase history. 

There is no login mechanism, instead you can freely change users by clicking the "Change User" button in the header.

Clicking the "Purchase History" button will show you the users' past purchased items. This page also has a keypress based search of the purchase history.

In the footer, there is a link for "information about current indexes" which will show you the state of all the indexes RediSearch is currently managing. 

## License

MIT