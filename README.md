mws-sdk
======

Originally forked from [dfsklar/mws-js](https://github.com/dfsklar/mws-js). This is another continuation of mws-js with a more standarized node module setup.


Examples
--------------------


Initiation

```javascript
var MWS = require('mws-sdk'),
    client = new MWS.Client('accessKeyId', 'secretAccessKey', 'merchantId', {}),
    marketPlaceId = "ATVPDKIKX0DER";
```


```javascript
var sf = new MWS.Orders.requests.ListOrders({"marketPlaceId": marketPlaceId});
sf.params.MarketplaceId.value = marketPlaceId;
sf.params.CreatedAfter.value = "2014-07-13";
client.invoke(sf, function(RESULT){
  console.log("--------");
  console.log(JSON.stringify(RESULT));
  console.log("--------");
});
```

```javascript


var sf = new MWS.Orders.requests.ListOrderItems();
sf.params.AmazonOrderId.value = "111-1715221-5800265";
client.invoke(sf, function(RESULT){
  console.log("--------");
  console.log(JSON.stringify(RESULT));
  console.log("--------");
});
```
