function has(obj) {
  const arr = Object.keys(obj);
  for(let i = 1; i < arguments.length; i += 1) {
     if (arr.indexOf(arguments[i]) === -1) { return false; }
  }
  return true;
}
const fetchOK = response => {
  if (!response.ok) { throw response; }
  return response.json(); 
};
const fetchErr = err => {
  err.text().then( errorMessage => {
    console.log(errorMessage);
  });
};
var router = new VueRouter({
  routes: [
    { name : 'item',    path: '/item/:id' },
    { name : 'page',    path: '/page/:page'},
    { name : 'user',    path: '/user/:userpage' },
    { name : 'history', path: '/purchase-history/:historypage/:historysearch?'}
  ]
});

var shopApp = new Vue({
  router, 
  el: '#app-shop',
  mounted: function() { this.pageSwitcher(); },
  watch: {
    '$route.params' :  function(newVal, oldVal) { this.pageSwitcher(newVal,oldVal); }
  },
  data: {
    view : 'page',
    products : [],
    product : {
      title : ''
    },
    errorMessage : '',
    offset : 0,
    perPage : 25,
    page : 0,
    user : {
      current : {},
      perPage : 10,
      offset  : 0,
      page    : 0,
      list    : []
    },
    purchase : {
      message : ''
    },
    history : {
      results   : {
        items   : [],
        query   : ''
      },
      query   : ''
    }
  },
  methods: {
    pageSwitcher(newParam, oldParam) {
      if (Object.keys(this.$route.params).length === 0) {
        this.view = 'page';
        this.page = 0;
        this.offset = 0;
        this.loadPage();
      } else if (has(this.$route.params,'historypage') && this.user.current.email) {
        this.history.query = this.$route.params.historysearch || '';
        this.view = 'history';
        this.loadHistory();
        
      } else if (has(this.$route.params,'userpage')) {
        this.view = 'user';
        this.user.page = Number(this.$route.params.userpage);
        this.user.offset = this.user.perPage * this.user.page;
        this.loadUsers();
      } else if (has(this.$route.params,'historypage') && !this.user.current.email) {
        //guard against pages that require a user
        console.log('email',this.user.current.email);
        router.push({ name: 'page', params: { page : this.page }});
      } else if (has(this.$route.params,'id')) {
        this.productId = this.$route.params.id;
        this.view = 'product';
        this.loadProduct(); 
        if (oldParam && oldParam.page) {
          this.page = Number(oldParam.page);
        }
      } else if (has(this.$route.params,'page')) {
        this.view = 'page';
        this.page = Number(this.$route.params.page);
        this.offset = this.perPage * Number(this.$route.params.page);
        this.loadPage();
      }
    },
    selectUser(user) {
      this.user.current = user;

      fetch(new Request(`/user/${this.user.current.email}`, { method: 'PUT' }))
        .then(fetchOK)
        .then(json => {
          window.scrollTo(0,0);
        });
    },
    loadHistory() {
      fetch(new Request(`/buy-history/${this.user.current.email}/0/${this.history.query}`))
        .then(fetchOK)
        .then( json => {
          this.history.results.query = json.search;
          //this.history.results.items.splice(0,this.history.results.items);
          this.history.results.items = [];
          json.items.forEach((aPurchase) => {
            console.log(aPurchase);
            this.history.results.items.push(aPurchase);
          });
        })
        .catch(fetchErr);
    },
    loadUsers() {
      this.user.list.splice(0,this.user.list.length);
      fetch(new Request(`/user/${Number(this.user.offset)}/${Number(this.user.offset)+this.user.perPage}`))
        .then(fetchOK)
        .then(json => {
          json.forEach((user) => this.user.list.push(user));
        });
    },
    loadProduct() {
      this.showProduct = true;
      let id = this.productId;
      let product = this.product;
      fetch(new Request(`/product/${id}`))
        .then(fetchOK)
        .then( json => {
          product.id = id;
          product.title = json.title;
          product.description = json.description;
          product.price = json.price;
        })
        .catch(fetchErr);
    },
    buyProduct(id) {
      window.scrollTo(0,0);
      fetch(new Request(`/buy/${this.user.current.email}/${id}`))
        .then(fetchOK)
        .then(json => {
          console.log(`buy json `,json);
          this.purchase.message = 'Purchased!';
          setTimeout(() => this.purchase.message = '', 2000);
        })
        .catch(fetchErr);
    },
    loadPage() {
      let products = this.products;
      products.splice(0,products.length);

      fetch(
        new Request(`/product/${this.offset}/${Number(this.offset)+this.perPage}`)
      )
        .then(fetchOK)
        .then(json => {
          json.forEach(function(aProductId,index) {
            fetch(
              new Request(`/product/${aProductId}`)
            )
            .then(fetchOK)
            .then(json => {
              products.push({
                id    : aProductId,
                title : json.title,
                price : json.price
              });
            })
            .catch(fetchErr);
            
          });
        })
        .catch(fetchErr);
    }
  }
}).$mount('#app-shop');