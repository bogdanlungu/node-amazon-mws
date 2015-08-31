var https = require('https'),
	qs = require("querystring"),
	crypto = require('crypto'),
	xml2js = require('xml2js');


var MARKETPLACE_IDS = {

};

/**
 * Constructor for the main MWS client interface used to make api calls and
 * various data structures to encapsulate MWS requests, definitions, etc.
 * 
 * @param {String} accessKeyId     Id for your secret Access Key (required)
 * @param {String} secretAccessKey Secret Access Key provided by Amazon (required)
 * @param {String} merchantId      Aka SellerId, provided by Amazon (required)
 * @param {Object} options         Additional configuration options for this instance
 */
function AmazonMwsClient(accessKeyId, secretAccessKey, merchantId, options) {
	this.host = options.host || 'mws.amazonservices.com';
	this.port = options.port || 443;
	this.conn = options.conn || https;
	this.creds = crypto.createCredentials(options.creds || {});
	this.appName = options.appName || 'mws-js';
	this.appVersion = options.appVersion || '0.1.0';
	this.appLanguage = options.appLanguage || 'JavaScript';
	this.accessKeyId = accessKeyId || null;
	this.secretAccessKey = secretAccessKey || null;
	this.merchantId = merchantId || null;
}

/**
 * The method used to invoke calls against MWS Endpoints. Recommended usage is
 * through the invoke wrapper method when the api call you're invoking has a
 * request defined in one of the submodules. However, you can use call() manually
 * when a lower level of control is necessary (custom or new requests, for example).
 * 
 * @param  {Object}   api      Settings object unique to each API submodule
 * @param  {String}   action   Api `Action`, such as GetServiceStatus or GetOrder
 * @param  {Object}   query    Any parameters belonging to the current action
 * @param  {Function} callback Callback function to send any results recieved
 */
AmazonMwsClient.prototype.call = function(api, action, query, callback) {
	if (this.secretAccessKey == null || this.accessKeyId == null || this.merchantId == null) {
	  throw("accessKeyId, secretAccessKey, and merchantId must be set");
	}

	if(process.env.NODE_ENV === 'development') {
		console.log("=================== API ===================");
	  console.log(JSON.stringify(api));
	  console.log("================ QUERY ==============");
	  console.log(JSON.stringify(query));
	  console.log("==============================");
	}

	// Check if we're dealing with a file (such as a feed) upload
	if (api.upload) {
		var body = query._BODY_,
			bformat = query._FORMAT_;
		delete query._BODY_;
		delete query._FORMAT_;
	} 

	// Add required parameters and sign the query
	query['Action'] = action;
	query['Version'] = api.version;
	query["Timestamp"] = (new Date()).toISOString();
	query["AWSAccessKeyId"] = this.accessKeyId;
	if (api.legacy) { 
    query['Merchant'] = this.merchantId; 
  } else {
    query['SellerId'] = this.merchantId; 
  }
	query = this.sign(api.path, query);

	if (!api.upload) {
		var body = qs.stringify(query);
	}

	// Setup our HTTP headers and connection options
	var headers = {
		'Host': this.host,
		'User-Agent': this.appName + '/' + this.appVersion + ' (Language=' + this.appLanguage + ')',
		'Content-Type': bformat || 'application/x-www-form-urlencoded; charset=utf-8',
		'Content-Length': body.length
	};
	if (api.upload) {
		headers['Content-MD5'] = crypto.createHash('md5').update(body).digest("base64");
	}

  var pathReq = api.path + (api.upload ? '?' + qs.stringify(query) : '');
  
  console.log("************ ACTUAL PATH2: ***************");
  console.log(pathReq);
	
	var options = {
	  host: this.host,
	  port: this.port,
	  path: pathReq,
	  method: "POST",
	  headers: headers
	};

	// Make the initial request and define callbacks
	var req = this.conn.request(options, function (res) {
    console.log('Here is the Headers: ' + body);
	  var data = '';
	  // Append each incoming chunk to data variable
	  res.addListener('data', function (chunk) {
		data += chunk.toString();
	  });
	  // When response is complete, parse the XML and pass it to callback
	  res.addListener('end', function() { 
		var parser = new xml2js.Parser();
		parser.addListener('end', function (result) {
		  // Throw an error if there was a problem reported
		  if (result.Error != null) {
		  	if(process.env.NODE_ENV === 'development') {
	        console.log("--------------------------------");
	        console.log("ERROR:");
	        console.log(JSON.stringify(result.Error));
	      }
        throw("ERROR");
      }
		  callback(result);
		});
		if (data.slice(0, 5) == '<?xml')
		  parser.parseString(data);
		else
		  callback(data);
	  });
	});
	req.write(body);
	req.end();
};

/**
 * Calculates the HmacSHA256 signature and appends it with additional signature
 * parameters to the provided query object.
 * 
 * @param  {String} path  Path of API call (used to build the string to sign)
 * @param  {Object} query Any non-signature parameters that will be sent
 * @return {Object}       Finalized object used to build query string of request
 */
AmazonMwsClient.prototype.sign = function(path, query) {
	var keys = [], 
		sorted = {},
		hash = crypto.createHmac("sha256", this.secretAccessKey);

	// Configure the query signature method/version
	query["SignatureMethod"] = "HmacSHA256";
	query["SignatureVersion"] = "2";

	// Copy query keys, sort them, then copy over the values
	for(var key in query)
	  keys.push(key);
	keys = keys.sort();
	for(n in keys) {
	  var key = keys[n];
	  sorted[key] = query[key];
	}

  //var newUrl = "ASINList.ASIN.1=B007I5JT4S&AWSAccessKeyId=AKIAIONL3LXB4CWZNSYA&Action=GetMatchingProduct&MarketplaceId=ATVPDKIKX0DER&SellerId=A2DZIYTW0R2T65&SignatureMethod=HmacSHA256&SignatureVersion=2&Timestamp=2015-08-27T09%3A41%3A49.019Z&Version=2011-10-01";
  var stringToSign = ["POST", this.host, path, qs.stringify(sorted)].join("\n");
  //var stringToSign = ["POST", this.host, path, newUrl].join("\n");
  
  console.log('--------------------The path to sign----------------------');
  console.log(qs.stringify(sorted));
  console.log('--------------------The path to sign----------------------');

	// An RFC (cannot remember which one) requires these characters also be changed:
	stringToSign = stringToSign.replace(/'/g,"%27");
	stringToSign = stringToSign.replace(/\*/g,"%2A");
	stringToSign = stringToSign.replace(/\(/g,"%28");
	stringToSign = stringToSign.replace(/\)/g,"%29");

	query['Signature'] = hash.update(stringToSign).digest("base64");
  
  
  console.log('--------------------Signature----------------------');
  console.log(query['Signature']);
  console.log('--------------------Signature----------------------');

	return query;
};

/**
 * Suggested method for invoking a pre-defined mws request object.
 * 
 * @param  {Object}   request  An instance of AmazonMwsRequest with params, etc.
 * @param  {Function} callback Callback function used to process results/errors
 */
AmazonMwsClient.prototype.invoke = function(request, callback) {
  if(process.env.NODE_ENV === 'development') {
  	console.log('++++++++++++++++++++++++++++++++++++');
  	console.log('INVOKE');
  	console.log(JSON.stringify(request));
	}
	this.call(request.api, request.action, request.query(), callback);
};


/**
 * Constructor for general MWS request objects, wrapped by api submodules to keep
 * things DRY, yet familiar despite whichever api is being implemented.
 * 
 * @param {Object} options Settings to apply to new request instance.
 */
function AmazonMwsRequest(options) {
	this.api = {
		path: options.path || '/',
		version: options.version || '2009-01-01',
		legacy: options.legacy || false,
    upload: options.upload
	};
	this.action = options.action || 'GetServiceStatus';
	this.params = options.params || {};
}

/**
 * Handles the casting, renaming, and setting of individual request params.
 * 
 * @param {String} param Key of parameter (not ALWAYS the same as the param name!)
 * @param {Mixed} value Value to assign to parameter
 * @return {Object} Current instance to allow function chaining	
 */
AmazonMwsRequest.prototype.set = function(param, value) {
	var p = this.params[param],
		v = p.value = {};

	// Handles the actual setting based on type
	var setValue = function(name, val) {
		if (p.type == 'Timestamp') {
			v[name] = val.toISOString();
		} else if (p.type == 'Boolean') {
			v[name] = val ? 'true' : 'false';
		} else {
			v[name] = val;
		}
	}

	// Lists need to be sequentially numbered and we take care of that here
	if (p.list) {
		var i = 0;
		if ((typeof(value) == "string") || (typeof(value) == "number")) {
			setValue(p.name + '.1', value);
		} 
		if (typeof(value) == "object") {
			if (Array.isArray(value)) {
				for (i = value.length - 1; i >= 0; i--) {
					setValue(p.name + '.' + (i+1), value[i]);
				}
			} else {
				for (var key in value) {
					setValue(p.name +  '.' + (++i), value[key]);
				}
			}
		}
	} else {
		setValue(p.name, value)
	}

	return this;
};

/**
 * Builds a query object and checks for required parameters.
 * 
 * @return {Object} KvP's of all provided parameters (used by invoke())
 */
AmazonMwsRequest.prototype.query = function() {
	var q = {};
	if(process.env.NODE_ENV === 'development') {
  	console.log("AMR.proto.query !!!!!!!!!!!!!!!!!!!!!!!");
  	console.log(JSON.stringify(this));
  	console.log(JSON.stringify(this.params));
	}
	for (var param in this.params) {
		var value = this.params[param].value,
			  name = this.params[param].name,
			  complex = (this.params[param].type === 'Complex'),
		    required = this.params[param].required;
		console.log("v  " + value + "\nn " + name + "\nr " + required);
		if ((value !== undefined) && (value !== null)) {
			if (complex) {
        var theName = this.params[param].name;
        var theArray = this.params[param].value;
        for(var i = 0; i < theArray.length; i++){
          q[theName + '.' + (i+1)] = theArray[i];
        }
			} else {
				q[name] = value;
			}
		} else {
			if (param.required === true) {
				throw("ERROR: Missing required parameter, " + name + "!")
			}
		}
	};
	if(process.env.NODE_ENV === 'development') {
  	console.log("query() about to return this:");
  	console.log(q);
  	console.log("----------------------------------");
	}
	return q;
};


/**
 * Contructor for objects used to represent enumeration states. Useful
 * when you need to make programmatic updates to an enumerated data type or
 * wish to encapsulate enum states in a handy, re-usable variable.
 * 
 * @param {Array} choices An array of any possible values (choices)
 */
function EnumType(choices) {
	for (var choice in choices) {
		this[choices[choice]] = false;
	}
	this._choices = choices;
}

/**
 * Enable one or more choices (accepts a variable number of arguments)
 * @return {Object} Current instance of EnumType for chaining
 */
EnumType.prototype.enable = function() {
	for (var arg in arguments) {
		this[arguments[arg]] = true;
	}
	return this;
};

/**
 * Disable one or more choices (accepts a variable number of arguments)
 * @return {Object} Current instance of EnumType for chaining
 */
EnumType.prototype.disable = function() {
	for (var arg in arguments) {
		this[arguments[arg]] = false;
	}
	return this;
};

/**
 * Toggles one or more choices (accepts a variable number of arguments)
 * @return {Object} Current instance of EnumType for chaining
 */
EnumType.prototype.toggle = function() {
	for (var arg in arguments) {
		this[arguments[arg]] = ! this[arguments[arg]];
	}
	return this;
};

/**
 * Return all possible values without regard to current state
 * @return {Array} Choices passed to EnumType constructor
 */
EnumType.prototype.all = function() {
	return this._choices;
};

/**
 * Return all enabled choices as an array (used to set list params, usually)
 * @return {Array} Choice values for each choice set to true 
 */
EnumType.prototype.values = function() {
	var value = [];
	for (var choice in this._choices) {
		if (this[this._choices[choice]] === true) {
			value.push(this._choices[choice]);
		}
	}
	return value;
};


// /**
//  * Takes an object and adds an appendTo function that will add
//  * each kvp of object to a query. Used when dealing with complex
//  * parameters that need to be built in an abnormal or unique way.
//  * 
//  * @param {String} name Name of parameter, prefixed to each key
//  * @param {Object} obj  Parameters belonging to the complex type
//  */
// function ComplexType(name) {
// 	this.pre = name;
// 	var _obj = obj;
// 	obj.appendTo = function(query) {
// 		for (var k in _obj) {
// 			query[name + '.' k] = _obj[k];
// 		}
// 		return query;
// 	}
// 	return obj;
// }

// ComplexType.prototype.appendTo = function(query) {
// 	for (var k in value)
// }

/**
 * Complex List helper object. Once initialized, you should set
 * an add(args) method which pushes a new complex object to members.
 * 
 * @param {String} name Name of Complex Type (including .member or subtype)
 */
function ComplexListType(name) {
	this.pre = name;
	this.members = [];
}

/**
 * Appends each member object as a complex list item
 * @param  {Object} query Query object to append to
 * @return {Object}       query
 */
ComplexListType.prototype.appendTo = function(query) {
	var members = this.members;
	for (var i = 0; i < members.length; i++) {
		for (var j in members[i]) {
			query[this.pre + '.' + (i+1) + '.' + j] = members[i][j]
		}
	}
	return query;
};

exports.Client = AmazonMwsClient;
exports.Request = AmazonMwsRequest;
exports.Enum = EnumType;
exports.ComplexList = ComplexListType;
exports.Orders = require('./orders');
exports.Sellers = require('./sellers');
exports.Feeds = require('./feeds');
exports.Products = require('./products');
exports.Reports = require('./reports');

